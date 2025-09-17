"""
FastAPI main application entry point.

Main FastAPI application that brings together all API routes,
WebSocket endpoints, and middleware configuration.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
from pathlib import Path
from fastapi import FastAPI, WebSocket, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .models import HealthResponse, APIError
from .api import templates, pdf, profiles
from .websockets import handle_websocket_connection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="E-ink PDF Templates API",
    description="REST API for creating interactive PDF templates optimized for e-ink devices",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(templates.router, prefix="/api")
app.include_router(pdf.router, prefix="/api")
app.include_router(profiles.router, prefix="/api")


@app.get("/", response_model=HealthResponse)
async def root() -> HealthResponse:
    """
    Root endpoint - health check.
    
    Returns:
        Health status information
    """
    # Test if einkpdf library is available
    einkpdf_available = True
    try:
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))
        from einkpdf.core.schema import Template
    except ImportError:
        einkpdf_available = False
    
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        einkpdf_available=einkpdf_available
    )


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Health check endpoint.
    
    Returns:
        Detailed health status
    """
    return await root()


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str) -> None:
    """
    WebSocket endpoint for real-time preview updates.
    
    Args:
        websocket: WebSocket connection
        client_id: Unique client identifier
    """
    if not client_id or not client_id.strip():
        await websocket.close(code=4000, reason="Client ID is required")
        return
    
    await handle_websocket_connection(websocket, client_id)


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException) -> JSONResponse:
    """
    Global HTTP exception handler.
    
    Args:
        request: HTTP request
        exc: HTTP exception
        
    Returns:
        Standardized error response
    """
    return JSONResponse(
        status_code=exc.status_code,
        content=APIError(
            error="HTTP_ERROR",
            message=exc.detail
        ).model_dump()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception) -> JSONResponse:
    """
    Global exception handler for unhandled exceptions.
    
    Args:
        request: HTTP request
        exc: Unhandled exception
        
    Returns:
        Generic error response
    """
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=APIError(
            error="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred"
        ).model_dump()
    )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )