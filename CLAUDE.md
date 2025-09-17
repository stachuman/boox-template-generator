# Claude Coding Rules for E-ink PDF Templates

This file contains mandatory coding standards and practices for the development of the e-ink PDF template system.

## Core Development Rules

### 1. No Dummy Implementations
- **NEVER** write placeholder code like `pass`, `# TODO: implement later`, or dummy return values
- **NEVER** return mock data or hardcoded responses that aren't real functionality
- If a feature isn't ready, raise a proper exception instead
- Every function must do exactly what its name and signature promise

### 2. No Overcomplicated Code
- Favor simple, readable solutions over clever optimizations
- Use standard library and well-established patterns
- Avoid deep inheritance hierarchies or complex abstractions
- One responsibility per function/class
- If you need comments to explain what code does, simplify the code first

### 3. No Default Fallbacks Without Confirmation
- **NEVER** silently default to arbitrary values when data is missing
- **NEVER** assume what the user wants if input is invalid
- Always validate inputs explicitly and fail fast with clear error messages
- If defaults are needed, they must be explicitly documented and intentional

### 4. Fail Fast with Meaningful Exceptions
- If functionality is not yet implemented, raise `NotImplementedError("Specific feature name")`
- If validation fails, raise specific exceptions with clear messages
- If external dependencies fail, don't mask the error - let it propagate with context
- Use custom exception types for domain-specific failures

## Specific Implementation Guidelines

### Error Handling
```python
# GOOD: Explicit validation with clear errors
def validate_font_size(size: float, profile: DeviceProfile) -> float:
    if size < profile.constraints.min_font_pt:
        raise ValidationError(
            f"Font size {size}pt below minimum {profile.constraints.min_font_pt}pt "
            f"for device profile '{profile.name}'"
        )
    return size

# BAD: Silent fallback
def validate_font_size(size: float, profile: DeviceProfile) -> float:
    return max(size, 10.0)  # Magic number fallback
```

### Unimplemented Features
```python
# GOOD: Clear exception for missing functionality
def generate_table_of_contents(template: Template) -> List[OutlineItem]:
    raise NotImplementedError(
        "Auto-generated TOC not implemented in Phase 1. "
        "Manual bookmark creation is available."
    )

# BAD: Dummy implementation
def generate_table_of_contents(template: Template) -> List[OutlineItem]:
    return []  # Empty list masks the missing feature
```

### Configuration and Defaults
```python
# GOOD: Explicit required parameters
def render_template(template_path: str, profile: DeviceProfile, mode: ExportMode) -> bytes:
    if not profile:
        raise ValueError("Device profile is required")
    if not mode:
        raise ValueError("Export mode must be specified")
    # ... actual implementation

# BAD: Hidden defaults
def render_template(template_path: str, profile: DeviceProfile = None, mode: ExportMode = None) -> bytes:
    profile = profile or get_default_profile()  # Which default?
    mode = mode or ExportMode.FLATTENED        # Why this default?
```

### Data Validation
```python
# GOOD: Comprehensive validation
def parse_yaml_template(yaml_content: str) -> Template:
    try:
        raw_data = yaml.safe_load(yaml_content)
    except yaml.YAMLError as e:
        raise TemplateParseError(f"Invalid YAML syntax: {e}")
    
    if not isinstance(raw_data, dict):
        raise TemplateParseError("Template must be a YAML object/dictionary")
    
    if "schema_version" not in raw_data:
        raise TemplateParseError("Missing required 'schema_version' field")
    
    return Template.model_validate(raw_data)

# BAD: Assumptions and silent failures
def parse_yaml_template(yaml_content: str) -> Template:
    raw_data = yaml.safe_load(yaml_content) or {}  # Empty dict if None
    return Template.model_validate(raw_data)       # Might fail silently
```

## Testing Requirements

### Test All Error Paths
- Every exception case must have a corresponding test
- Test invalid inputs, missing dependencies, malformed data
- Verify error messages are helpful and actionable

### No Mock Data in Production Paths
- Use real device profiles, real fonts, real templates in tests
- Mock only external services (file system, network) when necessary
- Golden file tests must use real PDF generation, not mocked output

### Clear Test Names
```python
# GOOD: Descriptive test names
def test_font_size_validation_fails_when_below_device_minimum():
    profile = load_device_profile("Boox-Note-Air-4C")
    with pytest.raises(ValidationError, match="Font size 8pt below minimum 10pt"):
        validate_font_size(8.0, profile)

# BAD: Vague test names  
def test_validate_font_size():
    # What exactly is being tested?
```

## Code Organization Rules

### File and Function Naming
- Use descriptive names that explain purpose: `convert_yaml_coordinates_to_pdf()` not `convert_coords()`
- Module names should be nouns: `schema.py`, `renderer.py`, `validation.py`
- Function names should be verbs: `validate_template()`, `render_pdf()`, `create_bookmark()`

### Import Organization
```python
# Standard library
import logging
from pathlib import Path
from typing import List, Dict, Optional

# Third-party packages
import yaml
from pydantic import BaseModel, Field
from reportlab.pdfgen import canvas

# Local imports
from einkpdf.core.schema import Template, DeviceProfile
from einkpdf.validation.constraints import ValidationError
```

### Documentation Requirements
- Every public function needs a docstring with parameters and return type
- Complex algorithms need explanation comments
- Configuration files need inline comments explaining choices
- Error messages must be actionable (tell user what to fix)

## Performance and Resource Rules

### Memory Management
- Close file handles explicitly or use context managers
- Don't load entire PDFs into memory unnecessarily
- Clean up ReportLab canvas objects after use

### Caching Strategy
- Cache expensive operations (PDF rendering, validation)
- Use content-based cache keys (hashes, not timestamps)  
- Implement cache size limits and TTL

### Logging
- Log at appropriate levels: ERROR for failures, INFO for major steps, DEBUG for details
- Include relevant context in log messages
- Never log sensitive information (file contents, user data)

## Security Rules

### Input Validation
- Treat all YAML input as untrusted
- Validate file paths to prevent traversal attacks
- Sanitize any user-provided strings used in PDF content
- Check file sizes before processing

### Asset Handling
- Use content-addressable storage (SHA256 hashes)
- Validate file types and magic bytes
- Restrict asset file sizes and total storage
- Never execute or eval user-provided content

## Additional Rules for Consideration

Based on the project requirements, these additional rules may be needed:

### Coordinate System Handling
- Always explicitly specify coordinate system in function signatures
- Convert between coordinate systems at module boundaries only
- Never mix coordinate systems within a single function

### Device Profile Compliance
- All rendering functions must accept a DeviceProfile parameter
- Never hardcode device-specific values
- Validate constraints before rendering, not during

### Deterministic Behavior
- Use fixed seeds for any random operations
- Sort collections before iteration when order affects output
- Use consistent floating-point precision

### Error Recovery
- For auto-fix mode: log what was changed and why
- For strict mode: fail immediately with specific constraint violation
- Never partially apply fixes (all-or-nothing)

## Enforcement

These rules are enforced through:
1. **Code review** - Every PR must follow these guidelines
2. **Pre-commit hooks** - Automated checks for common violations
3. **Tests** - Integration tests verify rule compliance
4. **CI/CD** - Build fails if rules are violated

## Challenge Incorrect Requests

### 5. Challenge User Requests When Necessary
- **ALWAYS** challenge user requests if you believe they are not correct
- **PROPOSE** different solutions whenever you believe they are better
- **EXPLAIN** why the proposed approach is superior
- **PROVIDE** clear reasoning and alternatives
- Don't blindly follow directions that lead to poor outcomes

## Rule Violations

If you encounter a situation where following these rules seems impossible or counterproductive:
1. **Stop implementation**
2. **Document the specific conflict**
3. **Propose an alternative approach**
4. **Get explicit approval before proceeding**

Never silently break these rules or work around them without discussion.
- Do not create any separate test scripts, instead connect to running backend and test directly functionality
- to manage service use manage-services.sh script