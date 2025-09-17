#!/usr/bin/env python3
"""Test the backend services directly without running the FastAPI server."""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

def test_services_import():
    """Test that all services can be imported successfully."""
    print("1. Testing service imports...")
    
    try:
        from app.services import TemplateService, PDFService, ProfileService
        print("   ✅ All services imported successfully")
        return True
    except Exception as e:
        print(f"   ❌ Service import failed: {e}")
        return False

def test_profile_service():
    """Test the profile service functionality."""
    print("\n2. Testing profile service...")
    
    try:
        from app.services import ProfileService
        
        profile_service = ProfileService()
        profiles = profile_service.get_available_profiles()
        
        print(f"   ✅ Found {len(profiles)} device profiles")
        
        if profiles:
            profile_name = profiles[0].name
            print(f"   Testing specific profile: {profile_name}")
            
            specific_profile = profile_service.get_profile(profile_name)
            if specific_profile:
                print(f"   ✅ Profile '{profile_name}' loaded successfully")
                return True
            else:
                print(f"   ❌ Failed to load profile '{profile_name}'")
                return False
        else:
            print("   ⚠️  No profiles found")
            return False
            
    except Exception as e:
        print(f"   ❌ Profile service error: {e}")
        return False

def test_pdf_service():
    """Test the PDF service functionality."""
    print("\n3. Testing PDF service...")
    
    try:
        from app.services import PDFService
        
        test_yaml = """schema_version: "1.0"

metadata:
  name: "Service Test Template"
  description: "Template for testing backend services"
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
    content: "Service Test"
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
        
        pdf_service = PDFService()
        
        # Test PDF generation
        pdf_bytes = pdf_service.generate_pdf(
            yaml_content=test_yaml,
            profile="Boox-Note-Air-4C",
            deterministic=True
        )
        
        print(f"   ✅ PDF generated successfully ({len(pdf_bytes)} bytes)")
        
        # Test preview generation
        preview_bytes = pdf_service.generate_preview(
            yaml_content=test_yaml,
            profile="Boox-Note-Air-4C",
            page_number=1,
            scale=2.0
        )
        
        print(f"   ✅ Preview generated successfully ({len(preview_bytes)} bytes)")
        return True
        
    except Exception as e:
        print(f"   ❌ PDF service error: {e}")
        return False

def test_template_service():
    """Test the template service functionality."""
    print("\n4. Testing template service...")
    
    try:
        from app.services import TemplateService
        import tempfile
        
        # Use temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            template_service = TemplateService(temp_dir)
            
            test_yaml = """schema_version: "1.0"

metadata:
  name: "Template Service Test"
  description: "Template for testing template service"
  category: "test"
  version: "1.0"
  author: "Template Service Test"
  created: "2024-01-15T10:30:00Z"
  profile: "Boox-Note-Air-4C"

canvas:
  dimensions:
    width: 595.2
    height: 841.8
    margins: [72, 72, 72, 72]
  background: "#FFFFFF"

widgets:
  - id: "test_widget"
    type: "text_block"
    page: 1
    content: "Template Service Test"
    position:
      x: 72
      y: 100
      width: 400
      height: 30

navigation:
  named_destinations: []
  outlines: []
"""
            
            # Create template
            template = template_service.create_template(
                name="Test Template",
                description="Template for testing",
                profile="Boox-Note-Air-4C",
                yaml_content=test_yaml
            )
            
            print(f"   ✅ Template created with ID: {template.id}")
            
            # List templates
            templates = template_service.list_templates()
            print(f"   ✅ Found {len(templates)} templates")
            
            # Get template
            retrieved = template_service.get_template(template.id)
            if retrieved:
                print("   ✅ Template retrieved successfully")
                
                # Delete template
                deleted = template_service.delete_template(template.id)
                if deleted:
                    print("   ✅ Template deleted successfully")
                    return True
                else:
                    print("   ❌ Template deletion failed")
                    return False
            else:
                print("   ❌ Template retrieval failed")
                return False
        
    except Exception as e:
        print(f"   ❌ Template service error: {e}")
        return False

def main():
    """Run all service tests."""
    print("🧪 E-ink PDF Templates - Backend Services Testing")
    print("=" * 55)
    
    tests = [
        test_services_import,
        test_profile_service,
        test_pdf_service,
        test_template_service
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 55)
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All backend service tests passed!")
        print("\n✅ Backend services are working correctly")
        print("✅ Ready to start FastAPI server")
    else:
        print("💥 Some backend service tests failed!")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)