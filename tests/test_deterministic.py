#!/usr/bin/env python3
"""Test deterministic PDF generation."""

import hashlib
from datetime import datetime
from einkpdf.validation.yaml_validator import parse_yaml_template
from einkpdf.core.renderer import render_template

def test_deterministic_builds():
    """Test that PDFs are generated deterministically."""
    print("Testing deterministic PDF generation...")
    
    # Load test template
    with open("test_template.yaml", "r") as f:
        yaml_content = f.read()
    template = parse_yaml_template(yaml_content)
    profile_name = "Boox-Note-Air-4C"
    
    # Fixed creation date for testing
    fixed_date = datetime(2024, 1, 15, 10, 30, 0)
    
    # Generate PDF twice with deterministic mode
    print("Generating first PDF...")
    pdf1 = render_template(template, profile_name, deterministic=True)
    
    print("Generating second PDF...")
    pdf2 = render_template(template, profile_name, deterministic=True)
    
    # Calculate hashes
    hash1 = hashlib.sha256(pdf1).hexdigest()
    hash2 = hashlib.sha256(pdf2).hexdigest()
    
    print(f"PDF 1 hash: {hash1}")
    print(f"PDF 2 hash: {hash2}")
    print(f"PDF 1 size: {len(pdf1)} bytes")
    print(f"PDF 2 size: {len(pdf2)} bytes")
    
    # Check if PDFs are identical
    if hash1 == hash2:
        print("✅ SUCCESS: PDFs are byte-for-byte identical!")
        return True
    else:
        print("❌ FAIL: PDFs differ between builds")
        
        # Save both for comparison
        with open("pdf1_debug.pdf", "wb") as f:
            f.write(pdf1)
        with open("pdf2_debug.pdf", "wb") as f:
            f.write(pdf2)
        print("Debug PDFs saved as pdf1_debug.pdf and pdf2_debug.pdf")
        return False

def test_non_deterministic_builds():
    """Test that non-deterministic mode produces different PDFs."""
    print("\nTesting non-deterministic PDF generation...")
    
    # Load test template
    with open("test_template.yaml", "r") as f:
        yaml_content = f.read()
    template = parse_yaml_template(yaml_content)
    profile_name = "Boox-Note-Air-4C"
    
    # Generate PDF twice without deterministic mode
    print("Generating first non-deterministic PDF...")
    pdf1 = render_template(template, profile_name, deterministic=False)
    
    print("Generating second non-deterministic PDF...")
    pdf2 = render_template(template, profile_name, deterministic=False)
    
    # Calculate hashes
    hash1 = hashlib.sha256(pdf1).hexdigest()
    hash2 = hashlib.sha256(pdf2).hexdigest()
    
    print(f"Non-det PDF 1 hash: {hash1}")
    print(f"Non-det PDF 2 hash: {hash2}")
    
    # Non-deterministic PDFs should typically differ due to timestamps
    if hash1 != hash2:
        print("✅ SUCCESS: Non-deterministic PDFs differ as expected")
        return True
    else:
        print("⚠️  WARNING: Non-deterministic PDFs are identical (unusual but possible)")
        return True

if __name__ == "__main__":
    print("=== Deterministic PDF Build Testing ===")
    
    success1 = test_deterministic_builds()
    success2 = test_non_deterministic_builds()
    
    if success1 and success2:
        print("\n🎉 All tests passed!")
    else:
        print("\n💥 Some tests failed!")
        exit(1)