#!/usr/bin/env python3
"""
Basic functionality test to verify environment setup.

This script tests the core functionality we've implemented so far,
following the coding rules in CLAUDE.md.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from einkpdf.validation.yaml_validator import parse_yaml_template, TemplateParseError, SchemaValidationError
from einkpdf.core.schema import Template


def test_basic_yaml_validation():
    """Test basic YAML template validation functionality."""
    
    # Test 1: Valid minimal template
    valid_yaml = """
schema_version: "1.0"
metadata:
  name: "Test Template"
  category: "test"
  created: "2024-01-15T10:30:00Z"
  profile: "Boox-Note-Air-4C"
canvas:
  dimensions:
    width: 595.2
    height: 841.8
    margins: [72, 72, 72, 72]
"""
    
    print("Testing valid YAML template...")
    try:
        template = parse_yaml_template(valid_yaml)
        print(f"✅ Valid template parsed: {template.metadata.name}")
        print(f"   Schema version: {template.schema_version}")
        print(f"   Profile: {template.metadata.profile}")
    except Exception as e:
        print(f"❌ Unexpected error with valid template: {e}")
        return False
    
    # Test 2: Invalid YAML syntax
    print("\\nTesting invalid YAML syntax...")
    invalid_yaml = """
schema_version: "1.0
metadata:
  name: "Invalid Template"  # Missing quote above breaks YAML
"""
    
    try:
        parse_yaml_template(invalid_yaml)
        print("❌ Should have failed on invalid YAML syntax")
        return False
    except TemplateParseError as e:
        print(f"✅ Correctly caught YAML syntax error: {e}")
    except Exception as e:
        print(f"❌ Wrong exception type: {e}")
        return False
    
    # Test 3: Missing schema version
    print("\\nTesting missing schema version...")
    no_schema_yaml = """
metadata:
  name: "No Schema Template"
  category: "test"
  created: "2024-01-15T10:30:00Z"
  profile: "Boox-Note-Air-4C"
canvas:
  dimensions:
    width: 595.2
    height: 841.8
    margins: [72, 72, 72, 72]
"""
    
    try:
        parse_yaml_template(no_schema_yaml)
        print("❌ Should have failed on missing schema_version")
        return False
    except TemplateParseError as e:
        if "schema_version" in str(e):
            print(f"✅ Correctly caught missing schema version: {e}")
        else:
            print(f"❌ Wrong error message: {e}")
            return False
    except Exception as e:
        print(f"❌ Wrong exception type: {e}")
        return False
    
    # Test 4: Schema validation error
    print("\\nTesting schema validation...")
    invalid_schema_yaml = """
schema_version: "1.0"
metadata:
  name: ""  # Empty name should fail validation
  category: "test"
  created: "2024-01-15T10:30:00Z"
  profile: "Boox-Note-Air-4C"
canvas:
  dimensions:
    width: -100  # Negative width should fail
    height: 841.8
    margins: [72, 72, 72, 72]
"""
    
    try:
        parse_yaml_template(invalid_schema_yaml)
        print("❌ Should have failed on schema validation")
        return False
    except SchemaValidationError as e:
        print(f"✅ Correctly caught schema validation error: {e}")
    except Exception as e:
        print(f"❌ Wrong exception type: {e}")
        return False
    
    print("\\n🎉 All tests passed!")
    return True


def test_dependency_imports():
    """Test that all critical dependencies can be imported."""
    
    print("Testing dependency imports...")
    
    try:
        import reportlab
        print(f"✅ ReportLab {reportlab.__version__}")
    except ImportError as e:
        print(f"❌ ReportLab import failed: {e}")
        return False
    
    try:
        import pikepdf
        print(f"✅ pikepdf {pikepdf.__version__}")
    except ImportError as e:
        print(f"❌ pikepdf import failed: {e}")
        return False
    
    try:
        import fitz  # PyMuPDF
        print(f"✅ PyMuPDF {fitz.version[0]}")
    except ImportError as e:
        print(f"❌ PyMuPDF import failed: {e}")
        return False
        
    try:
        import pydantic
        print(f"✅ Pydantic {pydantic.version.VERSION}")
    except ImportError as e:
        print(f"❌ Pydantic import failed: {e}")
        return False
    
    return True


if __name__ == "__main__":
    print("🚀 E-ink PDF Templates - Basic Functionality Test")
    print("=" * 50)
    
    # Test dependency imports
    deps_ok = test_dependency_imports()
    print()
    
    # Test YAML validation
    yaml_ok = test_basic_yaml_validation()
    
    print("=" * 50)
    if deps_ok and yaml_ok:
        print("🎉 ALL TESTS PASSED - Environment is ready for Phase 1 development!")
        sys.exit(0)
    else:
        print("❌ SOME TESTS FAILED - Check errors above")
        sys.exit(1)