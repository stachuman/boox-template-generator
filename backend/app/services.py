"""
Business logic services for the FastAPI backend.

These services wrap the core einkpdf library and provide
the business logic for the web interface.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import sys
import uuid
import json
import hashlib
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timezone

# Add parent directory to path to import einkpdf
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

try:
    from einkpdf.validation.yaml_validator import parse_yaml_template, TemplateParseError, SchemaValidationError
    from einkpdf.core.renderer import render_template, RenderingError
    from einkpdf.core.preview import generate_ground_truth_preview, PreviewError
    from einkpdf.core.profiles import load_device_profile, list_available_profiles, DeviceProfileError
    from einkpdf.core.schema import Template
except ImportError as e:
    raise ImportError(f"Failed to import einkpdf library: {e}. Ensure the parent project is properly set up.")

from .models import TemplateResponse, DeviceProfileResponse


class EinkPDFServiceError(Exception):
    """Base exception for service layer errors."""
    pass


class TemplateService:
    """Service for template management operations."""
    
    def __init__(self, storage_dir: str = "data/templates"):
        """
        Initialize template service.
        
        Args:
            storage_dir: Directory to store template files
        """
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        # Index file to track templates
        self.index_file = self.storage_dir / "index.json"
        self._load_index()
    
    def _load_index(self) -> None:
        """Load template index from disk."""
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r') as f:
                    self._index = json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                raise EinkPDFServiceError(f"Failed to load template index: {e}")
        else:
            self._index = {}
    
    def _save_index(self) -> None:
        """Save template index to disk."""
        try:
            with open(self.index_file, 'w') as f:
                json.dump(self._index, f, indent=2, default=str)
        except IOError as e:
            raise EinkPDFServiceError(f"Failed to save template index: {e}")
    
    def create_template(self, name: str, description: str, profile: str, yaml_content: str) -> TemplateResponse:
        """
        Create a new template.
        
        Args:
            name: Template name
            description: Template description  
            profile: Device profile name
            yaml_content: YAML template content
            
        Returns:
            TemplateResponse with created template info
            
        Raises:
            EinkPDFServiceError: If creation fails
        """
        # Validate YAML content first
        try:
            template = parse_yaml_template(yaml_content)
        except (TemplateParseError, SchemaValidationError) as e:
            raise EinkPDFServiceError(f"Invalid template YAML: {e}")
        
        # Validate device profile exists
        try:
            load_device_profile(profile)
        except DeviceProfileError as e:
            raise EinkPDFServiceError(f"Invalid device profile '{profile}': {e}")
        
        # Generate unique ID
        template_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        # Save template file
        template_file = self.storage_dir / f"{template_id}.yaml"
        try:
            with open(template_file, 'w') as f:
                f.write(yaml_content)
        except IOError as e:
            raise EinkPDFServiceError(f"Failed to save template file: {e}")
        
        # Update index
        self._index[template_id] = {
            "id": template_id,
            "name": name,
            "description": description,
            "profile": profile,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "file_path": str(template_file)
        }
        
        self._save_index()
        
        return TemplateResponse(
            id=template_id,
            name=name,
            description=description,
            profile=profile,
            created_at=now,
            updated_at=now,
            yaml_content=yaml_content
        )
    
    def get_template(self, template_id: str) -> Optional[TemplateResponse]:
        """
        Get template by ID.
        
        Args:
            template_id: Template unique identifier
            
        Returns:
            TemplateResponse if found, None otherwise
            
        Raises:
            EinkPDFServiceError: If retrieval fails
        """
        if template_id not in self._index:
            return None
        
        template_info = self._index[template_id]
        template_file = Path(template_info["file_path"])
        
        if not template_file.exists():
            raise EinkPDFServiceError(f"Template file missing for ID {template_id}")
        
        try:
            with open(template_file, 'r') as f:
                yaml_content = f.read()
        except IOError as e:
            raise EinkPDFServiceError(f"Failed to read template file: {e}")
        
        return TemplateResponse(
            id=template_info["id"],
            name=template_info["name"],
            description=template_info["description"],
            profile=template_info["profile"],
            created_at=datetime.fromisoformat(template_info["created_at"]),
            updated_at=datetime.fromisoformat(template_info["updated_at"]),
            yaml_content=yaml_content
        )
    
    def list_templates(self) -> List[TemplateResponse]:
        """
        List all templates.
        
        Returns:
            List of TemplateResponse objects
            
        Raises:
            EinkPDFServiceError: If listing fails
        """
        templates = []
        
        for template_id in self._index:
            template = self.get_template(template_id)
            if template:
                templates.append(template)
        
        # Sort by creation date, newest first
        templates.sort(key=lambda t: t.created_at, reverse=True)
        return templates
    
    def update_template(self, template_id: str, name: Optional[str] = None, 
                       description: Optional[str] = None, profile: Optional[str] = None,
                       yaml_content: Optional[str] = None) -> Optional[TemplateResponse]:
        """
        Update existing template.
        
        Args:
            template_id: Template unique identifier
            name: New template name (optional)
            description: New template description (optional)
            profile: New device profile (optional)
            yaml_content: New YAML content (optional)
            
        Returns:
            Updated TemplateResponse if found, None otherwise
            
        Raises:
            EinkPDFServiceError: If update fails
        """
        if template_id not in self._index:
            return None
        
        template_info = self._index[template_id]
        
        # Validate new YAML content if provided
        if yaml_content is not None:
            try:
                parse_yaml_template(yaml_content)
            except (TemplateParseError, SchemaValidationError) as e:
                raise EinkPDFServiceError(f"Invalid template YAML: {e}")
        
        # Validate new profile if provided
        if profile is not None:
            try:
                load_device_profile(profile)
            except DeviceProfileError as e:
                raise EinkPDFServiceError(f"Invalid device profile '{profile}': {e}")
        
        # Update fields
        if name is not None:
            template_info["name"] = name
        if description is not None:
            template_info["description"] = description
        if profile is not None:
            template_info["profile"] = profile
        
        template_info["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Update YAML file if content changed
        if yaml_content is not None:
            template_file = Path(template_info["file_path"])
            try:
                with open(template_file, 'w') as f:
                    f.write(yaml_content)
            except IOError as e:
                raise EinkPDFServiceError(f"Failed to update template file: {e}")
        
        self._save_index()
        
        return self.get_template(template_id)
    
    def delete_template(self, template_id: str) -> bool:
        """
        Delete template by ID.
        
        Args:
            template_id: Template unique identifier
            
        Returns:
            True if deleted, False if not found
            
        Raises:
            EinkPDFServiceError: If deletion fails
        """
        if template_id not in self._index:
            return False
        
        template_info = self._index[template_id]
        template_file = Path(template_info["file_path"])
        
        # Delete file if it exists
        if template_file.exists():
            try:
                template_file.unlink()
            except OSError as e:
                raise EinkPDFServiceError(f"Failed to delete template file: {e}")
        
        # Remove from index
        del self._index[template_id]
        self._save_index()
        
        return True


class PDFService:
    """Service for PDF generation operations."""
    
    def generate_pdf(self, yaml_content: str, profile: str, 
                    deterministic: bool = True, strict_mode: bool = False) -> bytes:
        """
        Generate PDF from YAML template.
        
        Args:
            yaml_content: YAML template content
            profile: Device profile name
            deterministic: Generate deterministic PDF
            strict_mode: Fail on constraint violations
            
        Returns:
            PDF content as bytes
            
        Raises:
            EinkPDFServiceError: If generation fails
        """
        try:
            template = parse_yaml_template(yaml_content)
        except (TemplateParseError, SchemaValidationError) as e:
            raise EinkPDFServiceError(f"Invalid template YAML: {e}")
        
        try:
            pdf_bytes = render_template(
                template=template,
                profile_name=profile,
                strict_mode=strict_mode,
                deterministic=deterministic
            )
            return pdf_bytes
        except RenderingError as e:
            raise EinkPDFServiceError(f"PDF generation failed: {e}")
    
    def generate_preview(self, yaml_content: str, profile: str, 
                        page_number: int = 1, scale: float = 2.0) -> bytes:
        """
        Generate PNG preview from YAML template.
        
        Args:
            yaml_content: YAML template content
            profile: Device profile name
            page_number: Page number to preview
            scale: Preview scale factor
            
        Returns:
            PNG image bytes
            
        Raises:
            EinkPDFServiceError: If preview generation fails
        """
        # First generate PDF
        pdf_bytes = self.generate_pdf(yaml_content, profile, deterministic=True)
        
        try:
            preview_bytes = generate_ground_truth_preview(
                pdf_bytes=pdf_bytes,
                page_number=page_number,
                scale=scale
            )
            return preview_bytes
        except PreviewError as e:
            raise EinkPDFServiceError(f"Preview generation failed: {e}")


class ProfileService:
    """Service for device profile operations."""
    
    def _create_profile_response(self, profile) -> DeviceProfileResponse:
        """Create DeviceProfileResponse from DeviceProfile."""
        return DeviceProfileResponse(
            name=profile.name,
            display=profile.display,
            pdf_settings=profile.pdf_settings,
            constraints={
                "min_font_pt": profile.constraints.min_font_pt,
                "min_stroke_pt": profile.constraints.min_stroke_pt,
                "min_touch_target_pt": profile.constraints.min_touch_target_pt,
                "grayscale_levels": profile.constraints.grayscale_levels,
                "max_gray_fill_area": profile.constraints.max_gray_fill_area
            }
        )
    
    def get_available_profiles(self) -> List[DeviceProfileResponse]:
        """
        Get list of available device profiles.
        
        Returns:
            List of DeviceProfileResponse objects
            
        Raises:
            EinkPDFServiceError: If profile loading fails
        """
        try:
            profile_names = list_available_profiles()
            profiles = []
            
            for name in profile_names:
                try:
                    profile = load_device_profile(name)
                    profiles.append(self._create_profile_response(profile))
                except DeviceProfileError:
                    continue  # Skip invalid profiles
            
            return profiles
        except Exception as e:
            raise EinkPDFServiceError(f"Failed to load device profiles: {e}")
    
    def get_profile(self, profile_name: str) -> Optional[DeviceProfileResponse]:
        """
        Get specific device profile by name.
        
        Args:
            profile_name: Name of the device profile
            
        Returns:
            DeviceProfileResponse if found, None otherwise
            
        Raises:
            EinkPDFServiceError: If profile loading fails
        """
        try:
            profile = load_device_profile(profile_name)
            return self._create_profile_response(profile)
        except DeviceProfileError:
            return None