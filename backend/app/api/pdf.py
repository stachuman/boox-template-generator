"""
PDF generation API endpoints.

Provides PDF and preview generation from templates.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response

from ..models import PDFGenerateRequest, PreviewGenerateRequest
from ..services import PDFService, EinkPDFServiceError

router = APIRouter(prefix="/pdf", tags=["pdf"])

# Initialize PDF service
pdf_service = PDFService()


@router.post("/generate")
async def generate_pdf(request: PDFGenerateRequest) -> Response:
    """
    Generate PDF from YAML template.
    
    Args:
        request: PDF generation request
        
    Returns:
        PDF file as binary response
        
    Raises:
        HTTPException: If generation fails
    """
    try:
        pdf_bytes = pdf_service.generate_pdf(
            yaml_content=request.yaml_content,
            profile=request.profile,
            deterministic=request.deterministic,
            strict_mode=request.strict_mode
        )
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=template.pdf",
                "Content-Length": str(len(pdf_bytes))
            }
        )
    except EinkPDFServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/preview")
async def generate_preview(request: PreviewGenerateRequest) -> Response:
    """
    Generate PNG preview from YAML template.
    
    Args:
        request: Preview generation request
        
    Returns:
        PNG image as binary response
        
    Raises:
        HTTPException: If generation fails
    """
    try:
        preview_bytes = pdf_service.generate_preview(
            yaml_content=request.yaml_content,
            profile=request.profile,
            page_number=request.page_number,
            scale=request.scale
        )
        
        return Response(
            content=preview_bytes,
            media_type="image/png",
            headers={
                "Content-Disposition": "inline; filename=preview.png",
                "Content-Length": str(len(preview_bytes))
            }
        )
    except EinkPDFServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )