"""
Device profile API endpoints.

Provides access to device profile information.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

from typing import List
from fastapi import APIRouter, HTTPException, status

from ..models import DeviceProfileResponse
from ..core_services import ProfileService, EinkPDFServiceError

router = APIRouter(prefix="/profiles", tags=["profiles"])

# Initialize profile service
profile_service = ProfileService()


@router.get("/", response_model=List[DeviceProfileResponse])
async def list_profiles() -> List[DeviceProfileResponse]:
    """
    List all available device profiles.
    
    Returns:
        List of device profiles
        
    Raises:
        HTTPException: If profile loading fails
    """
    try:
        profiles = profile_service.get_available_profiles()
        return profiles
    except EinkPDFServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{profile_name}", response_model=DeviceProfileResponse)
async def get_profile(profile_name: str) -> DeviceProfileResponse:
    """
    Get specific device profile by name.
    
    Args:
        profile_name: Name of the device profile
        
    Returns:
        Device profile information
        
    Raises:
        HTTPException: If profile not found
    """
    try:
        profile = profile_service.get_profile(profile_name)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device profile '{profile_name}' not found"
            )
        return profile
    except EinkPDFServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )