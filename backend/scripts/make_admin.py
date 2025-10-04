#!/usr/bin/env python3
"""
Script to nominate a user as admin.

Usage:
    python backend/scripts/make_admin.py <username>
    python backend/scripts/make_admin.py --revoke <username>

Examples:
    python backend/scripts/make_admin.py john@example.com
    python backend/scripts/make_admin.py --revoke john@example.com
"""

import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

import os
os.chdir(backend_path)

from app.db import get_db_context
from app.db.models import User


def make_admin(username: str, revoke: bool = False) -> None:
    """
    Make a user an admin or revoke admin status.

    Args:
        username: Username or email of the user
        revoke: If True, revoke admin status instead of granting it

    Raises:
        ValueError: If user not found
    """
    with get_db_context() as session:
        # Try to find user by username or email
        user = session.query(User).filter(
            (User.username == username) | (User.email == username)
        ).first()

        if not user:
            raise ValueError(f"User not found: {username}")

        if revoke:
            if not user.is_admin:
                print(f"✓ User {user.username} is not an admin")
                return

            user.is_admin = False
            session.commit()
            print(f"✓ Revoked admin status from {user.username} ({user.email})")
        else:
            if user.is_admin:
                print(f"✓ User {user.username} is already an admin")
                return

            user.is_admin = True
            session.commit()
            print(f"✓ Granted admin status to {user.username} ({user.email})")


def main():
    """Parse arguments and execute admin nomination."""
    if len(sys.argv) < 2:
        print("Usage: python backend/scripts/make_admin.py [--revoke] <username>")
        print("\nExamples:")
        print("  python backend/scripts/make_admin.py john@example.com")
        print("  python backend/scripts/make_admin.py --revoke john@example.com")
        sys.exit(1)

    revoke = False
    username = sys.argv[1]

    if username == "--revoke":
        revoke = True
        if len(sys.argv) < 3:
            print("Error: Username required after --revoke")
            sys.exit(1)
        username = sys.argv[2]

    try:
        make_admin(username, revoke)
    except ValueError as e:
        print(f"✗ Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
