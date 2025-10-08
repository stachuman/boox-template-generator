"""
Device profile management and constraint enforcement.

This module handles loading device profiles, validating constraints,
and applying auto-fix behavior as defined in the implementation plan.
Follows the coding standards in CLAUDE.md - no dummy implementations.
"""

import os
import yaml
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path

from .schema import DeviceProfile, DeviceConstraints
import logging
from ..validation.yaml_validator import ValidationError


class DeviceProfileError(Exception):
    """Raised when device profile operations fail."""
    pass

logger = logging.getLogger(__name__)


class ProfileNotFoundError(DeviceProfileError):
    """Raised when requested device profile cannot be found."""
    pass


class ConstraintViolation:
    """Represents a constraint violation with auto-fix information."""
    
    def __init__(self, field: str, original_value: float, fixed_value: float, reason: str):
        self.field = field
        self.original_value = original_value
        self.fixed_value = fixed_value
        self.reason = reason
    
    def __str__(self) -> str:
        return f"{self.field}: {self.original_value} → {self.fixed_value} ({self.reason})"


class ConstraintEnforcer:
    """Enforces device constraints with warn-and-fix or strict behavior."""
    
    def __init__(self, profile: DeviceProfile, strict_mode: bool = False):
        self.profile = profile
        self.strict_mode = strict_mode
        self.violations: List[ConstraintViolation] = []
    
    def check_font_size(self, size: float) -> float:
        """
        Check and optionally fix font size constraint.
        
        Args:
            size: Font size in points
            
        Returns:
            Fixed font size
            
        Raises:
            ValidationError: If strict mode and constraint violated
        """
        min_size = self.profile.constraints.min_font_pt
        
        if size < min_size:
            if self.strict_mode:
                raise ValidationError(
                    f"Font size {size}pt below minimum {min_size}pt "
                    f"for device profile '{self.profile.name}'"
                )
            
            # Auto-fix: bump to minimum
            violation = ConstraintViolation(
                "font_size", size, min_size, 
                f"bumped to device minimum"
            )
            self.violations.append(violation)
            return min_size
        
        return size
    
    def check_stroke_width(self, width: float) -> float:
        """
        Check and optionally fix stroke width constraint.
        
        Args:
            width: Stroke width in points
            
        Returns:
            Fixed stroke width
            
        Raises:
            ValidationError: If strict mode and constraint violated
        """
        min_width = self.profile.constraints.min_stroke_pt
        
        if width < min_width:
            if self.strict_mode:
                raise ValidationError(
                    f"Stroke width {width}pt below minimum {min_width}pt "
                    f"for device profile '{self.profile.name}'"
                )
            
            # Auto-fix: expand to minimum
            violation = ConstraintViolation(
                "stroke_width", width, min_width,
                f"expanded to device minimum"
            )
            self.violations.append(violation)
            return min_width
        
        return width
    
    def check_touch_target_size(self, width: float, height: float) -> Tuple[float, float]:
        """
        Check and optionally fix touch target size constraint.
        
        Args:
            width: Target width in points
            height: Target height in points
            
        Returns:
            Tuple of (fixed_width, fixed_height)
            
        Raises:
            ValidationError: If strict mode and constraint violated
        """
        min_size = self.profile.constraints.min_touch_target_pt
        
        fixed_width = width
        fixed_height = height
        
        if width < min_size:
            if self.strict_mode:
                raise ValidationError(
                    f"Touch target width {width}pt below minimum {min_size}pt "
                    f"for device profile '{self.profile.name}'"
                )
            
            violation = ConstraintViolation(
                "touch_target_width", width, min_size,
                "expanded for touch reliability"
            )
            self.violations.append(violation)
            fixed_width = min_size
        
        if height < min_size:
            if self.strict_mode:
                raise ValidationError(
                    f"Touch target height {height}pt below minimum {min_size}pt "
                    f"for device profile '{self.profile.name}'"
                )
            
            violation = ConstraintViolation(
                "touch_target_height", height, min_size,
                "expanded for touch reliability"
            )
            self.violations.append(violation)
            fixed_height = min_size
        
        return fixed_width, fixed_height
    
    def validate_color(self, color: str) -> str:
        """
        Validate color is within grayscale constraints.
        
        Args:
            color: Hex color string
            
        Returns:
            Validated/fixed color
            
        Raises:
            ValidationError: If color is not grayscale compatible
        """
        if not color.startswith('#') or len(color) != 7:
            raise ValidationError(f"Invalid color format: {color}")
        
        # Convert to RGB values
        try:
            r = int(color[1:3], 16)
            g = int(color[3:5], 16)
            b = int(color[5:7], 16)
        except ValueError:
            raise ValidationError(f"Invalid hex color: {color}")
        
        # Bypass grayscale conversion for color-capable devices
        try:
            disp = getattr(self.profile, 'display', {}) or {}
            if isinstance(disp, dict) and (disp.get('color') is True or 'color' in str(self.profile.name).lower()):
                return color
        except Exception:
            pass

        # Check if already grayscale (R=G=B)
        if r == g == b:
            return color
        
        # Convert to grayscale using luminance formula
        gray_value = int(0.299 * r + 0.587 * g + 0.114 * b)
        gray_color = f"#{gray_value:02x}{gray_value:02x}{gray_value:02x}"
        
        if not self.strict_mode:
            violation = ConstraintViolation(
                "color", color, gray_color,
                "converted to grayscale for e-ink"
            )
            self.violations.append(violation)
            return gray_color
        else:
            raise ValidationError(
                f"Color {color} is not grayscale-compatible. "
                f"Use {gray_color} for e-ink displays."
            )


def get_profile_directory() -> Path:
    """Get the directory containing device profiles."""
    # 1) Environment override
    env_dir = os.getenv("EINK_PROFILE_DIR")
    if env_dir:
        p = Path(env_dir)
        if p.exists():
            logger.debug("Using EINK_PROFILE_DIR: %s", p)
            return p
    # 2) Repo root: /config/profiles relative to project
    current_dir = Path(__file__).parent
    profile_dir = current_dir.parent.parent.parent / "config" / "profiles"
    if profile_dir.exists():
        logger.debug("Using repo profiles dir: %s", profile_dir)
        return profile_dir
    # 3) Package-relative fallback (src/einkpdf/config/profiles)
    pkg_dir = current_dir.parent / "config" / "profiles"
    if pkg_dir.exists():
        logger.debug("Using package profiles dir: %s", pkg_dir)
        return pkg_dir
    # Not found
    raise DeviceProfileError(
        f"Device profile directory not found: {profile_dir}"
    )


def list_available_profiles() -> List[str]:
    """
    List all available device profile names.
    
    Returns:
        List of profile names (without .yaml extension)
    """
    profile_dir = get_profile_directory()
    profiles: List[str] = []
    # Support both .yaml and .yml extensions
    for pattern in ("*.yaml", "*.yml"):
        for file_path in profile_dir.glob(pattern):
            if file_path.is_file():
                profiles.append(file_path.stem)
    # De-duplicate and sort
    return sorted(list(set(profiles)))


def load_device_profile(profile_name: str) -> DeviceProfile:
    """
    Load device profile by name.
    
    Args:
        profile_name: Profile name (e.g., "Boox-Note-Air-4C" or "boox-note-air-4c")
        
    Returns:
        Validated DeviceProfile instance
        
    Raises:
        ProfileNotFoundError: If profile file doesn't exist
        DeviceProfileError: If profile YAML is invalid
    """
    profile_dir = get_profile_directory()
    
    # Validate profile name input
    if not profile_name or not isinstance(profile_name, str):
        raise DeviceProfileError("Profile name must be a non-empty string")
    
    # Sanitize profile name to prevent path traversal
    import re
    if not re.match(r'^[a-zA-Z0-9_-]+$', profile_name):
        raise DeviceProfileError(
            f"Invalid profile name '{profile_name}'. Only alphanumeric characters, "
            f"underscores, and hyphens are allowed."
        )
    
    # Normalize primary candidate (lowercase slug)
    filename = profile_name.lower().replace("_", "-")
    if not filename.endswith(".yaml"):
        filename += ".yaml"

    profile_path = profile_dir / filename
    logger.debug("Resolving profile '%s' primary path: %s", profile_name, profile_path)

    # If normalized file is missing, try case-insensitive stem match as fallback
    if not profile_path.exists():
        match_path = None
        stem_target = Path(filename).stem.lower()
        for pattern in ("*.yaml", "*.yml"):
            for fp in profile_dir.glob(pattern):
                try:
                    if fp.is_file() and fp.stem.lower() == stem_target:
                        match_path = fp
                        break
                except Exception:
                    continue
            if match_path:
                break
        if match_path:
            profile_path = match_path
            logger.debug("Resolved profile via fallback match: %s", profile_path)
        else:
            available = list_available_profiles()
            raise ProfileNotFoundError(
                f"Device profile '{profile_name}' not found. Available profiles: {', '.join(available)}"
            )
    
    try:
        with open(profile_path, 'r', encoding='utf-8') as f:
            profile_data = yaml.safe_load(f)
    except yaml.YAMLError as e:
        raise DeviceProfileError(f"Invalid YAML in profile {profile_path}: {e}")
    except OSError as e:
        raise DeviceProfileError(f"Error reading profile {profile_path}: {e}")
    
    if not isinstance(profile_data, dict) or "profile" not in profile_data:
        raise DeviceProfileError(
            f"Profile file {profile_path} must contain a 'profile' root key"
        )
    
    try:
        return DeviceProfile.model_validate(profile_data["profile"])
    except Exception as e:
        raise DeviceProfileError(
            f"Invalid profile structure in {profile_path}: {e}"
        )


def calculate_canvas_dimensions(profile: DeviceProfile) -> Tuple[float, float]:
    """
    Calculate canvas dimensions in points from device profile.

    Respects the orientation setting:
    - If orientation is "portrait" but screen is landscape, dimensions are swapped
    - If orientation is "landscape" but screen is portrait, dimensions are swapped

    This ensures the PDF canvas matches the intended device orientation,
    preventing aspect ratio mismatches during PNG export.

    Args:
        profile: Device profile with display and pdf_settings

    Returns:
        Tuple of (width_pt, height_pt) in points

    Raises:
        DeviceProfileError: If profile has invalid display settings

    Formula: points = (pixels / ppi) * 72
    """
    try:
        screen_width_px, screen_height_px = profile.display["screen_size"]
        ppi = profile.display["ppi"]
        orientation = profile.pdf_settings["orientation"]
    except (KeyError, ValueError, TypeError) as e:
        raise DeviceProfileError(
            f"Device profile '{profile.name}' has invalid display settings: {e}"
        )

    # Convert pixel dimensions to points
    # Points = (pixels / ppi) * 72
    width_pt = (screen_width_px / ppi) * 72
    height_pt = (screen_height_px / ppi) * 72

    # Respect orientation setting - swap dimensions if needed
    screen_is_landscape = width_pt > height_pt
    wants_portrait = orientation == "portrait"

    if screen_is_landscape and wants_portrait:
        # Screen is landscape but user wants portrait - swap dimensions
        width_pt, height_pt = height_pt, width_pt
    elif not screen_is_landscape and not wants_portrait:
        # Screen is portrait but user wants landscape - swap dimensions
        width_pt, height_pt = height_pt, width_pt

    return (round(width_pt, 1), round(height_pt, 1))


def get_png_target_dimensions(profile: DeviceProfile) -> Tuple[int, int]:
    """
    Get PNG export target dimensions in pixels.

    Respects the orientation setting to match the PDF canvas orientation.
    If orientation differs from screen aspect ratio, dimensions are swapped.

    Args:
        profile: Device profile with display and pdf_settings

    Returns:
        Tuple of (width_px, height_px) in pixels for PNG export

    Raises:
        DeviceProfileError: If profile has invalid display settings
    """
    try:
        screen_width_px, screen_height_px = profile.display["screen_size"]
        orientation = profile.pdf_settings["orientation"]
    except (KeyError, ValueError, TypeError) as e:
        raise DeviceProfileError(
            f"Device profile '{profile.name}' has invalid display settings: {e}"
        )

    # Respect orientation setting - swap dimensions if needed
    screen_is_landscape = screen_width_px > screen_height_px
    wants_portrait = orientation == "portrait"

    target_width, target_height = screen_width_px, screen_height_px
    if screen_is_landscape and wants_portrait:
        # Screen is landscape but orientation is portrait - swap for PNG target
        target_width, target_height = screen_height_px, screen_width_px
    elif not screen_is_landscape and not wants_portrait:
        # Screen is portrait but orientation is landscape - swap for PNG target
        target_width, target_height = screen_height_px, screen_width_px

    return (target_width, target_height)


def get_default_canvas_config(profile: DeviceProfile) -> Dict[str, Any]:
    """
    Get complete default canvas configuration for a device profile.

    This is the single source of truth for canvas configuration.
    Returns a complete canvas dict ready to use in templates/projects.

    Args:
        profile: Device profile

    Returns:
        Complete canvas configuration dict with dimensions, coordinate_system, etc.

    Raises:
        DeviceProfileError: If profile has invalid settings
    """
    width_pt, height_pt = calculate_canvas_dimensions(profile)
    safe_margins = profile.pdf_settings.get("safe_margins", [36, 36, 36, 36])

    return {
        "dimensions": {
            "width": width_pt,
            "height": height_pt,
            "margins": safe_margins
        },
        "coordinate_system": "top_left",
        "background": "#FFFFFF",
        "grid_size": 10,
        "snap_enabled": True
    }



def create_constraint_enforcer(profile_name: str, strict_mode: bool = False) -> ConstraintEnforcer:
    """
    Create constraint enforcer for a device profile.
    
    Args:
        profile_name: Device profile name
        strict_mode: If True, fail on violations; if False, auto-fix with warnings
        
    Returns:
        ConstraintEnforcer instance
        
    Raises:
        ProfileNotFoundError: If profile not found
        DeviceProfileError: If profile invalid
    """
    profile = load_device_profile(profile_name)
    return ConstraintEnforcer(profile, strict_mode)
