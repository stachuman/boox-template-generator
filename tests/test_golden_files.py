#!/usr/bin/env python3
"""Test golden file testing framework."""

import sys
sys.path.insert(0, 'src')

from einkpdf.testing.golden_files import GoldenFileManager, run_golden_file_tests


def test_golden_file_workflow():
    """Test the complete golden file workflow."""
    print("=== Golden File Testing Framework Demo ===")
    
    # Initialize manager
    manager = GoldenFileManager("tests/golden")
    
    # Test 1: Capture golden file
    print("\n1. Capturing golden file...")
    try:
        entry = manager.capture_golden_file(
            name="basic_template_test",
            template_file="test_template.yaml",
            profile="Boox-Note-Air-4C",
            metadata={"test_type": "basic_functionality", "version": "1.0"}
        )
        print(f"✅ Golden file captured successfully!")
        print(f"   - PDF hash: {entry.pdf_hash[:16]}...")
        print(f"   - Preview hash: {entry.preview_hash[:16]}...")
        print(f"   - File size: {entry.file_size} bytes")
    except Exception as e:
        print(f"❌ Failed to capture golden file: {e}")
        return False
    
    # Test 2: Validate against golden file
    print("\n2. Validating against golden file...")
    try:
        is_valid, differences = manager.validate_against_golden(
            name="basic_template_test",
            template_file="test_template.yaml",
            profile="Boox-Note-Air-4C"
        )
        
        if is_valid:
            print("✅ Validation passed - output matches golden file!")
        else:
            print(f"❌ Validation failed: {differences}")
            return False
    except Exception as e:
        print(f"❌ Validation error: {e}")
        return False
    
    # Test 3: List golden files
    print("\n3. Listing golden files...")
    golden_files = manager.list_golden_files()
    print(f"Found {len(golden_files)} golden file(s):")
    for gf in golden_files:
        print(f"   - {gf.name} (profile: {gf.profile}, size: {gf.file_size} bytes)")
    
    # Test 4: Run golden file test suite
    print("\n4. Running golden file test suite...")
    passed, total, failures = run_golden_file_tests()
    print(f"Results: {passed}/{total} tests passed")
    
    if failures:
        print("Failures:")
        for failure in failures:
            print(f"   - {failure}")
        return False
    
    return True


def test_golden_file_update():
    """Test updating a golden file."""
    print("\n=== Testing Golden File Update ===")
    
    manager = GoldenFileManager("tests/golden")
    
    try:
        # Update the golden file
        updated_entry = manager.update_golden_file(
            name="basic_template_test",
            template_file="test_template.yaml", 
            profile="Boox-Note-Air-4C",
            reason="Testing update functionality"
        )
        
        print("✅ Golden file updated successfully!")
        print(f"   - Update reason: {updated_entry.metadata.get('update_reason')}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to update golden file: {e}")
        return False


if __name__ == "__main__":
    print("🧪 E-ink PDF Templates - Golden File Testing")
    
    success1 = test_golden_file_workflow()
    success2 = test_golden_file_update()
    
    if success1 and success2:
        print("\n🎉 All golden file tests passed!")
    else:
        print("\n💥 Some golden file tests failed!")
        sys.exit(1)