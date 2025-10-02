#!/usr/bin/env python3
"""
Migrate users from JSON file storage to SQLite database.

This script:
1. Reads existing users from data/users/users.json
2. Reads password reset tokens from data/users/password_resets.json
3. Imports them into the SQLite database
4. Validates integrity (counts, sample user verification)
5. Creates a backup of the original files

Usage:
    python migrate_users_to_db.py [--dry-run] [--backup-dir PATH]

Options:
    --dry-run: Show what would be migrated without making changes
    --backup-dir: Directory to store JSON backups (default: data/users/backup)
"""

import argparse
import json
import logging
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db import get_db_context
from app.db.models import User, PasswordResetToken
from sqlalchemy import text

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class MigrationError(Exception):
    """Raised when migration fails."""


def load_json_users(users_file: Path) -> Dict[str, dict]:
    """Load users from JSON file."""
    if not users_file.exists():
        logger.warning(f"Users file not found: {users_file}")
        return {}

    try:
        with open(users_file, 'r') as f:
            users = json.load(f)
        logger.info(f"Loaded {len(users)} users from {users_file}")
        return users
    except json.JSONDecodeError as e:
        raise MigrationError(f"Failed to parse users JSON: {e}") from e


def load_json_password_resets(tokens_file: Path) -> Dict[str, dict]:
    """Load password reset tokens from JSON file."""
    if not tokens_file.exists():
        logger.warning(f"Password reset tokens file not found: {tokens_file}")
        return {}

    try:
        with open(tokens_file, 'r') as f:
            tokens = json.load(f)
        logger.info(f"Loaded {len(tokens)} password reset tokens from {tokens_file}")
        return tokens
    except json.JSONDecodeError as e:
        raise MigrationError(f"Failed to parse password reset tokens JSON: {e}") from e


def backup_files(users_file: Path, tokens_file: Path, backup_dir: Path) -> None:
    """Create backup of JSON files before migration."""
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if users_file.exists():
        backup_users = backup_dir / f"users_{timestamp}.json"
        shutil.copy2(users_file, backup_users)
        logger.info(f"Backed up users to: {backup_users}")

    if tokens_file.exists():
        backup_tokens = backup_dir / f"password_resets_{timestamp}.json"
        shutil.copy2(tokens_file, backup_tokens)
        logger.info(f"Backed up password reset tokens to: {backup_tokens}")


def migrate_users(users_data: Dict[str, dict], dry_run: bool = False) -> List[User]:
    """Migrate users to database."""
    migrated_users = []

    with get_db_context() as db:
        # Check if users already exist
        existing_count = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        if existing_count > 0:
            logger.warning(f"Database already contains {existing_count} users")
            response = input("Continue migration? This may create duplicates. (y/N): ")
            if response.lower() != 'y':
                logger.info("Migration cancelled by user")
                return []

        for user_id, user_data in users_data.items():
            try:
                # Parse datetime fields
                created_at = datetime.fromisoformat(user_data['created_at'])
                updated_at = datetime.fromisoformat(user_data['updated_at'])
                terms_accepted_at = None
                if user_data.get('terms_accepted_at'):
                    terms_accepted_at = datetime.fromisoformat(user_data['terms_accepted_at'])

                user = User(
                    id=user_data['id'],
                    username=user_data['username'],
                    email=user_data['email'].lower(),
                    password_hash=user_data['password_hash'],
                    is_active=user_data.get('is_active', True),
                    terms_accepted_at=terms_accepted_at,
                    created_at=created_at,
                    updated_at=updated_at
                )

                if dry_run:
                    logger.info(f"[DRY RUN] Would migrate user: {user.username} ({user.email})")
                else:
                    db.add(user)
                    logger.info(f"Migrating user: {user.username} ({user.email})")

                migrated_users.append(user)

            except Exception as e:
                logger.error(f"Failed to migrate user {user_id}: {e}")
                raise MigrationError(f"User migration failed for {user_id}") from e

        if not dry_run:
            db.commit()
            logger.info(f"Successfully migrated {len(migrated_users)} users")

    return migrated_users


def migrate_password_resets(tokens_data: Dict[str, dict], dry_run: bool = False) -> int:
    """Migrate password reset tokens to database."""
    migrated_count = 0

    with get_db_context() as db:
        for token_hash, token_data in tokens_data.items():
            try:
                # Parse datetime fields
                created_at = datetime.fromisoformat(token_data['created_at'])
                expires_at = datetime.fromisoformat(token_data['expires_at'])

                # Skip expired tokens
                if expires_at < datetime.now(created_at.tzinfo):
                    logger.info(f"Skipping expired token for user {token_data['user_id']}")
                    continue

                reset_token = PasswordResetToken(
                    token_hash=token_data['token_hash'],
                    user_id=token_data['user_id'],
                    email=token_data['email'],
                    created_at=created_at,
                    expires_at=expires_at
                )

                if dry_run:
                    logger.info(f"[DRY RUN] Would migrate reset token for: {reset_token.email}")
                else:
                    db.add(reset_token)
                    logger.info(f"Migrating reset token for: {reset_token.email}")

                migrated_count += 1

            except Exception as e:
                logger.error(f"Failed to migrate token {token_hash}: {e}")
                # Don't fail the entire migration for reset tokens
                continue

        if not dry_run:
            db.commit()
            logger.info(f"Successfully migrated {migrated_count} password reset tokens")

    return migrated_count


def validate_migration(original_users: Dict[str, dict], dry_run: bool = False) -> bool:
    """Validate that migration was successful."""
    if dry_run:
        logger.info("[DRY RUN] Skipping validation")
        return True

    with get_db_context() as db:
        # Count users
        db_user_count = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        json_user_count = len(original_users)

        logger.info(f"Validation: JSON users={json_user_count}, DB users={db_user_count}")

        if db_user_count < json_user_count:
            logger.error("Validation failed: Database has fewer users than JSON file")
            return False

        # Sample verification: check first user
        if original_users:
            first_user_id = next(iter(original_users.keys()))
            first_user_data = original_users[first_user_id]

            db_user = db.query(User).filter_by(id=first_user_id).first()
            if not db_user:
                logger.error(f"Validation failed: Sample user {first_user_id} not found in DB")
                return False

            # Verify critical fields
            if db_user.username != first_user_data['username']:
                logger.error(f"Validation failed: Username mismatch for {first_user_id}")
                return False

            if db_user.password_hash != first_user_data['password_hash']:
                logger.error(f"Validation failed: Password hash mismatch for {first_user_id}")
                return False

            logger.info(f"Validation: Sample user {db_user.username} verified successfully")

    logger.info("✅ Migration validation passed")
    return True


def main():
    parser = argparse.ArgumentParser(description="Migrate users from JSON to SQLite database")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be migrated without making changes")
    parser.add_argument("--backup-dir", type=Path, default=Path("data/users/backup"), help="Directory for backups")
    parser.add_argument("--data-dir", type=Path, default=Path("data/users"), help="Data directory containing JSON files")

    args = parser.parse_args()

    users_file = args.data_dir / "users.json"
    tokens_file = args.data_dir / "password_resets.json"

    logger.info("=" * 60)
    logger.info("User Migration to SQLite Database")
    logger.info("=" * 60)
    logger.info(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE MIGRATION'}")
    logger.info(f"Users file: {users_file}")
    logger.info(f"Tokens file: {tokens_file}")
    logger.info(f"Backup dir: {args.backup_dir}")
    logger.info("=" * 60)

    try:
        # Load data
        users_data = load_json_users(users_file)
        tokens_data = load_json_password_resets(tokens_file)

        if not users_data:
            logger.warning("No users found to migrate")
            return 0

        # Create backups (even in dry-run mode)
        if not args.dry_run:
            backup_files(users_file, tokens_file, args.backup_dir)

        # Migrate users
        logger.info("\n--- Migrating Users ---")
        migrated_users = migrate_users(users_data, dry_run=args.dry_run)

        # Migrate password reset tokens
        logger.info("\n--- Migrating Password Reset Tokens ---")
        migrated_tokens = migrate_password_resets(tokens_data, dry_run=args.dry_run)

        # Validate migration
        logger.info("\n--- Validating Migration ---")
        if not validate_migration(users_data, dry_run=args.dry_run):
            logger.error("Migration validation failed!")
            return 1

        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("Migration Summary")
        logger.info("=" * 60)
        logger.info(f"Users migrated: {len(migrated_users)}")
        logger.info(f"Password reset tokens migrated: {migrated_tokens}")
        if args.dry_run:
            logger.info("\n⚠️  This was a DRY RUN - no changes were made")
            logger.info("Run without --dry-run to perform actual migration")
        else:
            logger.info("\n✅ Migration completed successfully!")
            logger.info(f"Backups stored in: {args.backup_dir}")
        logger.info("=" * 60)

        return 0

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
