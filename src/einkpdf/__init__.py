"""
E-ink PDF Templates - Interactive PDF template system for Boox Onyx e-readers.

This package provides a production-ready system for creating interactive PDF templates
optimized for e-ink displays, featuring device profiles, dual export modes, and
ground-truth preview capabilities.

Copyright (C) 2024 E-ink PDF Templates
Licensed under AGPL v3.0 (compatible with PyMuPDF)
"""

__version__ = "0.1.0"
__license__ = "AGPL-3.0-or-later"
__author__ = "E-ink PDF Templates"

# Core exports for package users  
try:
    from .core.schema import Template, DeviceProfile, ExportMode
    from .validation.yaml_validator import ValidationError, TemplateParseError
    
    __all__ = [
        "__version__",
        "__license__", 
        "__author__",
        "Template",
        "DeviceProfile", 
        "ExportMode",
        "ValidationError",
        "TemplateParseError",
    ]
except ImportError as e:
    # During package installation, dependencies might not be available yet
    __all__ = ["__version__", "__license__", "__author__"]