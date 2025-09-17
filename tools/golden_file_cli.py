#!/usr/bin/env python3
"""
Command-line tool for managing golden files.

Usage:
    python golden_file_cli.py capture <name> <template> <profile>
    python golden_file_cli.py validate <name> <template> <profile>
    python golden_file_cli.py list
    python golden_file_cli.py run-tests
    python golden_file_cli.py update <name> <template> <profile> <reason>
"""

import sys
import argparse
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from einkpdf.testing.golden_files import GoldenFileManager, run_golden_file_tests


def main():
    parser = argparse.ArgumentParser(description="Golden File Manager CLI")
    parser.add_argument("--golden-dir", default="tests/golden", 
                       help="Golden files directory (default: tests/golden)")
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Capture command
    capture_parser = subparsers.add_parser("capture", help="Capture new golden file")
    capture_parser.add_argument("name", help="Test case name")
    capture_parser.add_argument("template", help="Template YAML file")
    capture_parser.add_argument("profile", help="Device profile name")
    
    # Validate command
    validate_parser = subparsers.add_parser("validate", help="Validate against golden file")
    validate_parser.add_argument("name", help="Test case name")
    validate_parser.add_argument("template", help="Template YAML file")
    validate_parser.add_argument("profile", help="Device profile name")
    
    # List command
    subparsers.add_parser("list", help="List all golden files")
    
    # Run tests command
    subparsers.add_parser("run-tests", help="Run all golden file tests")
    
    # Update command
    update_parser = subparsers.add_parser("update", help="Update existing golden file")
    update_parser.add_argument("name", help="Test case name")
    update_parser.add_argument("template", help="Template YAML file")
    update_parser.add_argument("profile", help="Device profile name")
    update_parser.add_argument("reason", help="Reason for update")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # Initialize manager
    manager = GoldenFileManager(args.golden_dir)
    
    try:
        if args.command == "capture":
            entry = manager.capture_golden_file(args.name, args.template, args.profile)
            print(f"✅ Captured golden file '{args.name}'")
            print(f"   PDF hash: {entry.pdf_hash}")
            print(f"   File size: {entry.file_size} bytes")
            
        elif args.command == "validate":
            is_valid, differences = manager.validate_against_golden(
                args.name, args.template, args.profile
            )
            if is_valid:
                print(f"✅ '{args.name}' validation passed")
            else:
                print(f"❌ '{args.name}' validation failed:")
                for diff in differences:
                    print(f"   - {diff}")
                return 1
                
        elif args.command == "list":
            golden_files = manager.list_golden_files()
            if not golden_files:
                print("No golden files found")
            else:
                print(f"Found {len(golden_files)} golden file(s):")
                for gf in golden_files:
                    print(f"   {gf.name}")
                    print(f"     Profile: {gf.profile}")
                    print(f"     Template: {gf.template_file}")
                    print(f"     Size: {gf.file_size} bytes")
                    print(f"     Created: {gf.creation_date}")
                    if gf.metadata:
                        print(f"     Metadata: {gf.metadata}")
                    print()
                    
        elif args.command == "run-tests":
            print("Running golden file test suite...")
            passed, total, failures = run_golden_file_tests(args.golden_dir)
            print(f"\nResults: {passed}/{total} tests passed")
            
            if failures:
                print("\nFailures:")
                for failure in failures:
                    print(f"   {failure}")
                return 1
            else:
                print("🎉 All tests passed!")
                
        elif args.command == "update":
            entry = manager.update_golden_file(
                args.name, args.template, args.profile, args.reason
            )
            print(f"✅ Updated golden file '{args.name}'")
            print(f"   Reason: {args.reason}")
            print(f"   New PDF hash: {entry.pdf_hash}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())