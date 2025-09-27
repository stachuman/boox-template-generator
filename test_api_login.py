#!/usr/bin/env python3
"""
Test script to verify API login endpoints work correctly.

Usage:
    python test_api_login.py --username admin --password your_password --backend-url http://localhost:8000

Follows CLAUDE.md coding standards - no dummy implementations.
"""

import argparse
import requests
import json
import sys
from pathlib import Path


def test_api_login(username: str, password: str, backend_url: str):
    """Test the actual API login endpoint that the frontend uses."""

    print(f"🔍 Testing API login for user: {username}")
    print(f"🌐 Backend URL: {backend_url}")

    # Test 1: Health check
    print(f"\n1️⃣ Testing backend health...")
    try:
        health_response = requests.get(f"{backend_url}/health", timeout=5)
        if health_response.status_code == 200:
            health_data = health_response.json()
            print(f"✅ Backend is healthy")
            print(f"   Status: {health_data.get('status')}")
            print(f"   Version: {health_data.get('version')}")
            print(f"   EinkPDF available: {health_data.get('einkpdf_available')}")
        else:
            print(f"❌ Backend health check failed: {health_response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to backend: {e}")
        print(f"   Make sure backend is running on {backend_url}")
        return False

    # Test 2: Login API endpoint
    print(f"\n2️⃣ Testing login API endpoint...")
    login_url = f"{backend_url}/api/auth/login"

    # Prepare login data (JSON format for UserLogin model)
    login_data = {
        "username": username,
        "password": password
    }

    headers = {
        "Content-Type": "application/json"
    }

    try:
        print(f"   Sending POST to: {login_url}")
        print(f"   Data: username={username}, password=[HIDDEN]")

        response = requests.post(
            login_url,
            json=login_data,
            headers=headers,
            timeout=10
        )

        print(f"   Response status: {response.status_code}")
        print(f"   Response headers: {dict(response.headers)}")

        if response.status_code == 200:
            token_data = response.json()
            print(f"✅ Login successful!")
            print(f"   Access token: {token_data.get('access_token', 'N/A')[:50]}...")
            print(f"   Token type: {token_data.get('token_type', 'N/A')}")

            # Test 3: Use token to get user info
            access_token = token_data.get('access_token')
            if access_token:
                print(f"\n3️⃣ Testing authenticated endpoint...")
                me_url = f"{backend_url}/api/auth/me"
                auth_headers = {
                    "Authorization": f"Bearer {access_token}"
                }

                me_response = requests.get(me_url, headers=auth_headers, timeout=5)
                if me_response.status_code == 200:
                    user_data = me_response.json()
                    print(f"✅ User info retrieved successfully!")
                    print(f"   Username: {user_data.get('username')}")
                    print(f"   Email: {user_data.get('email')}")
                    print(f"   ID: {user_data.get('id')}")
                    print(f"   Active: {user_data.get('is_active')}")
                else:
                    print(f"❌ Failed to get user info: {me_response.status_code}")
                    print(f"   Response: {me_response.text}")

            return True

        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"   Response: {response.text}")

            # Try to parse error details
            try:
                error_data = response.json()
                print(f"   Error details: {error_data}")
            except:
                pass

            return False

    except requests.exceptions.RequestException as e:
        print(f"❌ Login request failed: {e}")
        return False


def test_registration_endpoint(backend_url: str):
    """Test if registration endpoint is working."""
    print(f"\n4️⃣ Testing registration endpoint...")

    register_url = f"{backend_url}/api/auth/register"
    test_user_data = {
        "username": "testuser123",
        "email": "test123@example.com",
        "password": "testpassword123"
    }

    try:
        response = requests.post(
            register_url,
            json=test_user_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )

        print(f"   Registration response status: {response.status_code}")

        if response.status_code == 201:
            print(f"✅ Registration endpoint working")
            user_data = response.json()
            print(f"   Created user: {user_data.get('username')}")
        elif response.status_code == 400 and "already exists" in response.text:
            print(f"✅ Registration endpoint working (user already exists)")
        else:
            print(f"❌ Registration failed: {response.text}")

    except requests.exceptions.RequestException as e:
        print(f"❌ Registration test failed: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Test API login endpoints"
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
        "--backend-url",
        default="http://localhost:8000",
        help="Backend URL (default: http://localhost:8000)"
    )

    args = parser.parse_args()

    print(f"🧪 API Login Test")
    print(f"=" * 50)

    # Test login
    login_success = test_api_login(args.username, args.password, args.backend_url)

    # Test registration endpoint
    test_registration_endpoint(args.backend_url)

    print(f"\n" + "=" * 50)
    if login_success:
        print(f"✅ API login test PASSED - the backend authentication is working!")
        print(f"\nIf you still can't login through the frontend, the issue is likely:")
        print(f"1. Frontend not connecting to the correct backend URL")
        print(f"2. CORS issues between frontend and backend")
        print(f"3. Frontend JavaScript errors preventing login")
        print(f"4. Browser network issues or developer tools blocking requests")
        print(f"\nNext steps:")
        print(f"1. Check browser developer tools (F12) for JavaScript errors")
        print(f"2. Check Network tab to see if login request is being sent")
        print(f"3. Verify frontend VITE_API_BASE_URL points to {args.backend_url}")
    else:
        print(f"❌ API login test FAILED - there is a backend issue")


if __name__ == "__main__":
    main()