#!/usr/bin/env python3
"""
Script to create the first admin user for the multi-user system.

Usage:
    python create_admin_user.py --username admin --email admin@example.com --password your_secure_password

Follows CLAUDE.md coding standards - no dummy implementations.
"""

import argparse
import os
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from backend.app.auth import AuthService, AuthServiceError


def create_admin_user(username: str, email: str, password: str, data_root: Path = None):
    """Create the first admin user."""

    if not data_root:
        # Use the same logic as AuthService for consistency
        env_data_dir = os.getenv("EINK_DATA_DIR")
        if env_data_dir:
            data_root = Path(env_data_dir) / "users"
        else:
            data_root = Path("backend/data/users")

    print(f"Creating admin user in: {data_root.absolute()}")

    try:
        # Initialize auth service
        auth_service = AuthService(storage_root=data_root)

        # Check if any users already exist
        try:
            existing_user = auth_service.get_user_by_email(email)
            if existing_user:
                print(f"❌ User with email {email} already exists!")
                return False
        except:
            pass  # User doesn't exist, which is what we want

        try:
            existing_user = auth_service.get_user_by_username(username)
            if existing_user:
                print(f"❌ User with username {username} already exists!")
                return False
        except:
            pass  # User doesn't exist, which is what we want

        # Create the user
        user = auth_service.register_user(username, email, password)

        print(f"✅ Admin user created successfully!")
        print(f"   Username: {user.username}")
        print(f"   Email: {user.email}")
        print(f"   User ID: {user.id}")
        print(f"   Created: {user.created_at}")

        # Create user directory structure
        user_dir = data_root.parent / "users" / user.id
        projects_dir = user_dir / "projects"
        projects_dir.mkdir(parents=True, exist_ok=True)

        # Create empty projects index
        index_file = projects_dir / "index.json"
        if not index_file.exists():
            import json
            index_data = {"projects": []}
            with open(index_file, 'w', encoding='utf-8') as f:
                json.dump(index_data, f, indent=2)

        print(f"✅ User workspace created at: {user_dir}")
        print(f"\n🎉 You can now:")
        print(f"   1. Use the migration script: python migrate_orphaned_projects.py --user-email {email}")
        print(f"   2. Login to the web interface with: {username} / {password}")

        return True

    except AuthServiceError as e:
        print(f"❌ Failed to create user: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Create the first admin user for the multi-user system"
    )

    parser.add_argument(
        "--username",
        required=True,
        help="Admin username (3-50 characters)"
    )

    parser.add_argument(
        "--email",
        required=True,
        help="Admin email address"
    )

    parser.add_argument(
        "--password",
        required=True,
        help="Admin password (8-64 characters)"
    )

    parser.add_argument(
        "--data-root",
        type=Path,
        help="Data directory root (default: backend/data)"
    )

    args = parser.parse_args()

    # Validate inputs
    if len(args.username) < 3 or len(args.username) > 50:
        print("❌ Username must be 3-50 characters")
        sys.exit(1)

    if len(args.password) < 8 or len(args.password) > 64:
        print("❌ Password must be 8-64 characters")
        sys.exit(1)

    # Create user
    success = create_admin_user(
        args.username,
        args.email,
        args.password,
        args.data_root
    )

    if success:
        print(f"\n✅ Admin user creation completed!")
        sys.exit(0)
    else:
        print(f"\n❌ Admin user creation failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()