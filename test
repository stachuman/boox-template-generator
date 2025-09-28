#!/usr/bin/env python3
"""
Debug script to check user authentication issues.

Usage:
    python debug_user_auth.py --username admin --password your_password

Follows CLAUDE.md coding standards - no dummy implementations.
"""

import argparse
import os
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from backend.app.auth import AuthService, AuthServiceError, InvalidCredentialsError, UserInactiveError


def debug_auth(username: str, password: str, data_root: Path = None):
    """Debug authentication issues."""

    if not data_root:
        # Use the same logic as AuthService for consistency
        env_data_dir = os.getenv("EINK_DATA_DIR")
        if env_data_dir:
            data_root = Path(env_data_dir) / "users"
        else:
            data_root = Path("backend/data/users")

    print(f"🔍 Debugging authentication for user: {username}")
    print(f"📁 Data root: {data_root.absolute()}")
    print(f"📄 Users file: {data_root / 'users.json'}")

    try:
        # Initialize auth service
        auth_service = AuthService(storage_root=data_root)

        # Check if users.json exists
        users_file = data_root / "users.json"
        if not users_file.exists():
            print(f"❌ Users file does not exist: {users_file}")
            return False

        # Load and display users
        import json
        try:
            with open(users_file, 'r') as f:
                users_data = json.load(f)
            print(f"✅ Users file loaded, contains {len(users_data)} users")

            for user_id, user_info in users_data.items():
                print(f"   User: {user_info.get('username')} ({user_info.get('email')})")
                print(f"   ID: {user_id}")
                print(f"   Active: {user_info.get('is_active', 'Unknown')}")
                print(f"   Created: {user_info.get('created_at', 'Unknown')}")
                print()
        except Exception as e:
            print(f"❌ Failed to read users file: {e}")
            return False

        # Test finding user by username
        print(f"🔍 Looking up user by username: {username}")
        try:
            user_by_username = auth_service.get_user_by_username(username)
            if user_by_username:
                print(f"✅ Found user by username:")
                print(f"   ID: {user_by_username.id}")
                print(f"   Username: {user_by_username.username}")
                print(f"   Email: {user_by_username.email}")
                print(f"   Active: {user_by_username.is_active}")
                print(f"   Password hash length: {len(user_by_username.password_hash)}")
                print(f"   Password hash starts with: {user_by_username.password_hash[:20]}...")
            else:
                print(f"❌ User not found by username: {username}")
                return False
        except Exception as e:
            print(f"❌ Error looking up user by username: {e}")
            return False

        # Test password verification
        print(f"\n🔐 Testing password verification...")
        try:
            # Test direct password hash verification
            is_valid = auth_service.verify_password(password, user_by_username.password_hash)
            print(f"   Direct password verification: {'✅ VALID' if is_valid else '❌ INVALID'}")

            # Test password bytes length
            password_bytes = password.encode('utf-8')
            print(f"   Password length: {len(password)} characters, {len(password_bytes)} bytes")

            if len(password_bytes) > 72:
                print(f"   ⚠️  Password exceeds bcrypt 72-byte limit!")

        except Exception as e:
            print(f"❌ Error verifying password: {e}")

        # Test full authentication
        print(f"\n🔓 Testing full authentication...")
        try:
            authenticated_user = auth_service.authenticate_user(username, password)
            print(f"✅ Authentication successful!")
            print(f"   Authenticated as: {authenticated_user.username}")
            return True

        except InvalidCredentialsError as e:
            print(f"❌ Authentication failed: Invalid credentials")
            print(f"   Error: {e}")
            return False

        except UserInactiveError as e:
            print(f"❌ Authentication failed: User inactive")
            print(f"   Error: {e}")
            return False

        except Exception as e:
            print(f"❌ Authentication failed: {e}")
            return False

    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Debug user authentication issues"
    )

    parser.add_argument(
        "--username",
        required=True,
        help="Username to test"
    )

    parser.add_argument(
        "--password",
        required=True,
        help="Password to test"
    )

    parser.add_argument(
        "--data-root",
        type=Path,
        help="Data directory root (default: backend/data/users)"
    )

    args = parser.parse_args()

    success = debug_auth(args.username, args.password, args.data_root)

    if success:
        print(f"\n✅ Authentication debugging completed - user can login!")
    else:
        print(f"\n❌ Authentication debugging found issues!")
        print(f"\nTroubleshooting suggestions:")
        print(f"1. Verify the username and password are correct")
        print(f"2. Check if the user was created in the right location")
        print(f"3. Ensure the backend is using the same data directory")
        print(f"4. Try recreating the user with create_admin_user.py")


if __name__ == "__main__":
    main()