#!/usr/bin/env python3
"""Test the FastAPI backend functionality."""

import sys
import json
import requests
import time
from pathlib import Path

# Test configuration
BASE_URL = "http://127.0.0.1:8000"
TEST_YAML = """schema_version: "1.0"

metadata:
  name: "Backend Test Template"
  description: "Template for testing the FastAPI backend"
  category: "test"
  version: "1.0"
  author: "Backend Test"
  created: "2024-01-15T10:30:00Z"
  profile: "Boox-Note-Air-4C"

canvas:
  dimensions:
    width: 595.2
    height: 841.8
    margins: [72, 72, 72, 72]
  background: "#FFFFFF"

widgets:
  - id: "test_title"
    type: "text_block"
    page: 1
    content: "Backend API Test"
    position:
      x: 72
      y: 100
      width: 400
      height: 30
    styling:
      font: "Helvetica-Bold"
      size: 18
      color: "#000000"

navigation:
  named_destinations: []
  outlines: []
"""

def test_health_check():
    """Test health check endpoint."""
    print("1. Testing health check...")
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Health check passed")
            print(f"   Status: {data['status']}")
            print(f"   Version: {data['version']}")
            print(f"   EinkPDF Available: {data['einkpdf_available']}")
            return data['einkpdf_available']
        else:
            print(f"   ❌ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("   ❌ Cannot connect to backend server")
        print("   Please start the server with: cd backend && python -m app.main")
        return False
    except Exception as e:
        print(f"   ❌ Health check error: {e}")
        return False

def test_profiles_api():
    """Test device profiles API."""
    print("\n2. Testing profiles API...")
    
    try:
        # List profiles
        response = requests.get(f"{BASE_URL}/api/profiles/")
        if response.status_code == 200:
            profiles = response.json()
            print(f"   ✅ Found {len(profiles)} device profiles")
            
            if profiles:
                profile_name = profiles[0]["name"]
                print(f"   Testing specific profile: {profile_name}")
                
                # Get specific profile
                response = requests.get(f"{BASE_URL}/api/profiles/{profile_name}")
                if response.status_code == 200:
                    profile = response.json()
                    print(f"   ✅ Profile details loaded successfully")
                    return True
                else:
                    print(f"   ❌ Failed to get profile details: {response.status_code}")
                    return False
            else:
                print("   ⚠️  No profiles found")
                return False
        else:
            print(f"   ❌ Failed to list profiles: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Profiles API error: {e}")
        return False

def test_pdf_generation():
    """Test PDF generation API."""
    print("\n3. Testing PDF generation...")
    
    try:
        # Generate PDF
        response = requests.post(f"{BASE_URL}/api/pdf/generate", json={
            "yaml_content": TEST_YAML,
            "profile": "Boox-Note-Air-4C",
            "deterministic": True,
            "strict_mode": False
        })
        
        if response.status_code == 200:
            pdf_size = len(response.content)
            print(f"   ✅ PDF generated successfully ({pdf_size} bytes)")
            
            # Verify it's a PDF
            if response.content.startswith(b"%PDF-"):
                print("   ✅ Valid PDF header detected")
                return True
            else:
                print("   ❌ Invalid PDF content")
                return False
        else:
            print(f"   ❌ PDF generation failed: {response.status_code}")
            if response.content:
                try:
                    error = response.json()
                    print(f"   Error: {error.get('detail', 'Unknown error')}")
                except:
                    print(f"   Error: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ PDF generation error: {e}")
        return False

def test_preview_generation():
    """Test preview generation API."""
    print("\n4. Testing preview generation...")
    
    try:
        # Generate preview
        response = requests.post(f"{BASE_URL}/api/pdf/preview", json={
            "yaml_content": TEST_YAML,
            "profile": "Boox-Note-Air-4C",
            "page_number": 1,
            "scale": 2.0
        })
        
        if response.status_code == 200:
            preview_size = len(response.content)
            print(f"   ✅ Preview generated successfully ({preview_size} bytes)")
            
            # Verify it's a PNG
            if response.content.startswith(b"\x89PNG"):
                print("   ✅ Valid PNG header detected")
                return True
            else:
                print("   ❌ Invalid PNG content")
                return False
        else:
            print(f"   ❌ Preview generation failed: {response.status_code}")
            if response.content:
                try:
                    error = response.json()
                    print(f"   Error: {error.get('detail', 'Unknown error')}")
                except:
                    print(f"   Error: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Preview generation error: {e}")
        return False

def test_template_management():
    """Test template CRUD operations."""
    print("\n5. Testing template management...")
    
    try:
        # Create template
        create_response = requests.post(f"{BASE_URL}/api/templates/", json={
            "name": "Test Template",
            "description": "Template created by backend test",
            "profile": "Boox-Note-Air-4C",
            "yaml_content": TEST_YAML
        })
        
        if create_response.status_code == 201:
            template = create_response.json()
            template_id = template["id"]
            print(f"   ✅ Template created with ID: {template_id}")
            
            # List templates
            list_response = requests.get(f"{BASE_URL}/api/templates/")
            if list_response.status_code == 200:
                templates = list_response.json()
                print(f"   ✅ Found {templates['total']} templates")
                
                # Get specific template
                get_response = requests.get(f"{BASE_URL}/api/templates/{template_id}")
                if get_response.status_code == 200:
                    retrieved_template = get_response.json()
                    print("   ✅ Template retrieved successfully")
                    
                    # Delete template
                    delete_response = requests.delete(f"{BASE_URL}/api/templates/{template_id}")
                    if delete_response.status_code == 204:
                        print("   ✅ Template deleted successfully")
                        return True
                    else:
                        print(f"   ❌ Template deletion failed: {delete_response.status_code}")
                        return False
                else:
                    print(f"   ❌ Template retrieval failed: {get_response.status_code}")
                    return False
            else:
                print(f"   ❌ Template listing failed: {list_response.status_code}")
                return False
        else:
            print(f"   ❌ Template creation failed: {create_response.status_code}")
            if create_response.content:
                try:
                    error = create_response.json()
                    print(f"   Error: {error.get('detail', 'Unknown error')}")
                except:
                    print(f"   Error: {create_response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Template management error: {e}")
        return False

def main():
    """Run all backend tests."""
    print("🧪 E-ink PDF Templates - Backend API Testing")
    print("=" * 50)
    
    tests = [
        test_health_check,
        test_profiles_api,
        test_pdf_generation,
        test_preview_generation,
        test_template_management
    ]
    
    passed = 0
    total = len(tests)
    
    einkpdf_available = True
    for i, test in enumerate(tests):
        # Skip einkpdf-dependent tests if library not available
        if not einkpdf_available and i > 0:
            print(f"\n{i+1}. Skipping test (einkpdf not available)")
            continue
            
        result = test()
        if result is True:
            passed += 1
        elif result is False and i == 0:  # Health check failed
            einkpdf_available = False
    
    print("\n" + "=" * 50)
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All backend tests passed!")
        print("\n✅ Backend API is ready for frontend integration")
    else:
        print("💥 Some backend tests failed!")
        if not einkpdf_available:
            print("⚠️  Note: einkpdf library integration issues detected")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)