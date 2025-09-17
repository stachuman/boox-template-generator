"""
Golden file testing framework for deterministic PDF validation.

This module provides utilities for capturing golden reference files
and comparing current output against them for regression testing.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass

from ..core.schema import Template
from ..core.renderer import render_template
from ..core.preview import generate_ground_truth_preview
from ..validation.yaml_validator import parse_yaml_template


@dataclass
class GoldenFileEntry:
    """Represents a single golden file test case."""
    name: str
    template_file: str
    profile: str
    pdf_hash: str
    preview_hash: str
    file_size: int
    creation_date: str
    metadata: Dict[str, Any]


class GoldenFileError(Exception):
    """Raised when golden file operations fail."""
    pass


class GoldenFileManager:
    """Manages golden file creation, validation, and comparison."""
    
    def __init__(self, golden_dir: str = "tests/golden"):
        """
        Initialize golden file manager.
        
        Args:
            golden_dir: Directory to store golden files
        """
        self.golden_dir = Path(golden_dir)
        self.golden_dir.mkdir(parents=True, exist_ok=True)
        
        # Subdirectories for organization
        self.pdf_dir = self.golden_dir / "pdfs"
        self.preview_dir = self.golden_dir / "previews"
        self.metadata_dir = self.golden_dir / "metadata"
        
        for directory in [self.pdf_dir, self.preview_dir, self.metadata_dir]:
            directory.mkdir(exist_ok=True)
    
    def capture_golden_file(self, 
                           name: str,
                           template_file: str, 
                           profile: str,
                           metadata: Optional[Dict[str, Any]] = None) -> GoldenFileEntry:
        """
        Capture a golden file from template.
        
        Args:
            name: Test case name (used for filenames)
            template_file: Path to template YAML file
            profile: Device profile name
            metadata: Additional test metadata
            
        Returns:
            GoldenFileEntry with captured information
            
        Raises:
            GoldenFileError: If capture fails
        """
        try:
            # Load and parse template
            with open(template_file, "r") as f:
                yaml_content = f.read()
            template = parse_yaml_template(yaml_content)
            
            # Generate deterministic PDF
            pdf_bytes = render_template(
                template, 
                profile, 
                strict_mode=False,
                deterministic=True
            )
            
            # Generate preview
            preview_bytes = generate_ground_truth_preview(
                pdf_bytes,
                page_number=1,
                scale=2.0
            )
            
            # Calculate hashes
            pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()
            preview_hash = hashlib.sha256(preview_bytes).hexdigest()
            
            # Save files
            pdf_file = self.pdf_dir / f"{name}.pdf"
            preview_file = self.preview_dir / f"{name}.png"
            
            pdf_file.write_bytes(pdf_bytes)
            preview_file.write_bytes(preview_bytes)
            
            # Create golden file entry
            entry = GoldenFileEntry(
                name=name,
                template_file=template_file,
                profile=profile,
                pdf_hash=pdf_hash,
                preview_hash=preview_hash,
                file_size=len(pdf_bytes),
                creation_date=datetime.now().isoformat(),
                metadata=metadata or {}
            )
            
            # Save metadata
            self._save_metadata(entry)
            
            return entry
            
        except Exception as e:
            raise GoldenFileError(f"Failed to capture golden file '{name}': {e}") from e
    
    def validate_against_golden(self, 
                               name: str,
                               template_file: str,
                               profile: str) -> Tuple[bool, List[str]]:
        """
        Validate current output against golden file.
        
        Args:
            name: Test case name
            template_file: Path to template YAML file
            profile: Device profile name
            
        Returns:
            Tuple of (is_valid, list_of_differences)
            
        Raises:
            GoldenFileError: If validation fails
        """
        try:
            # Load golden file metadata
            golden_entry = self._load_metadata(name)
            if not golden_entry:
                return False, [f"Golden file '{name}' not found"]
            
            # Generate current output
            with open(template_file, "r") as f:
                yaml_content = f.read()
            template = parse_yaml_template(yaml_content)
            
            current_pdf = render_template(
                template,
                profile,
                strict_mode=False,
                deterministic=True
            )
            
            current_preview = generate_ground_truth_preview(
                current_pdf,
                page_number=1,
                scale=2.0
            )
            
            # Calculate current hashes
            current_pdf_hash = hashlib.sha256(current_pdf).hexdigest()
            current_preview_hash = hashlib.sha256(current_preview).hexdigest()
            
            # Compare
            differences = []
            
            if current_pdf_hash != golden_entry.pdf_hash:
                differences.append(f"PDF hash mismatch: expected {golden_entry.pdf_hash}, got {current_pdf_hash}")
            
            if current_preview_hash != golden_entry.preview_hash:
                differences.append(f"Preview hash mismatch: expected {golden_entry.preview_hash}, got {current_preview_hash}")
            
            if len(current_pdf) != golden_entry.file_size:
                differences.append(f"File size mismatch: expected {golden_entry.file_size}, got {len(current_pdf)}")
            
            return len(differences) == 0, differences
            
        except Exception as e:
            raise GoldenFileError(f"Failed to validate against golden file '{name}': {e}") from e
    
    def list_golden_files(self) -> List[GoldenFileEntry]:
        """
        List all available golden files.
        
        Returns:
            List of GoldenFileEntry objects
        """
        entries = []
        
        for metadata_file in self.metadata_dir.glob("*.json"):
            try:
                entry = self._load_metadata(metadata_file.stem)
                if entry:
                    entries.append(entry)
            except Exception:
                continue  # Skip corrupted metadata files
        
        return sorted(entries, key=lambda x: x.name)
    
    def update_golden_file(self, 
                          name: str,
                          template_file: str,
                          profile: str,
                          reason: str) -> GoldenFileEntry:
        """
        Update an existing golden file with new output.
        
        Args:
            name: Test case name
            template_file: Path to template YAML file
            profile: Device profile name
            reason: Reason for update (for audit trail)
            
        Returns:
            Updated GoldenFileEntry
        """
        # Add update reason to metadata
        metadata = {"update_reason": reason, "updated_at": datetime.now().isoformat()}
        
        return self.capture_golden_file(name, template_file, profile, metadata)
    
    def _save_metadata(self, entry: GoldenFileEntry) -> None:
        """Save golden file metadata as JSON."""
        metadata_file = self.metadata_dir / f"{entry.name}.json"
        
        with open(metadata_file, "w") as f:
            json.dump({
                "name": entry.name,
                "template_file": entry.template_file,
                "profile": entry.profile,
                "pdf_hash": entry.pdf_hash,
                "preview_hash": entry.preview_hash,
                "file_size": entry.file_size,
                "creation_date": entry.creation_date,
                "metadata": entry.metadata
            }, f, indent=2)
    
    def _load_metadata(self, name: str) -> Optional[GoldenFileEntry]:
        """Load golden file metadata from JSON."""
        metadata_file = self.metadata_dir / f"{name}.json"
        
        if not metadata_file.exists():
            return None
        
        try:
            with open(metadata_file, "r") as f:
                data = json.load(f)
            
            return GoldenFileEntry(
                name=data["name"],
                template_file=data["template_file"],
                profile=data["profile"],
                pdf_hash=data["pdf_hash"],
                preview_hash=data["preview_hash"],
                file_size=data["file_size"],
                creation_date=data["creation_date"],
                metadata=data.get("metadata", {})
            )
        except Exception:
            return None


def run_golden_file_tests(golden_dir: str = "tests/golden", 
                         template_dir: str = "templates") -> Tuple[int, int, List[str]]:
    """
    Run all golden file tests.
    
    Args:
        golden_dir: Directory containing golden files
        template_dir: Directory containing template files
        
    Returns:
        Tuple of (passed_count, total_count, failure_messages)
    """
    manager = GoldenFileManager(golden_dir)
    golden_files = manager.list_golden_files()
    
    passed = 0
    total = len(golden_files)
    failures = []
    
    for entry in golden_files:
        try:
            template_path = Path(template_dir) / entry.template_file
            if not template_path.exists():
                template_path = Path(entry.template_file)  # Try absolute path
            
            is_valid, differences = manager.validate_against_golden(
                entry.name,
                str(template_path),
                entry.profile
            )
            
            if is_valid:
                passed += 1
                print(f"✅ {entry.name}: PASS")
            else:
                failures.append(f"{entry.name}: {'; '.join(differences)}")
                print(f"❌ {entry.name}: FAIL - {'; '.join(differences)}")
                
        except Exception as e:
            failures.append(f"{entry.name}: Exception - {e}")
            print(f"💥 {entry.name}: ERROR - {e}")
    
    return passed, total, failures