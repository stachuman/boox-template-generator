"""
WebSocket endpoint for real-time preview updates.

Provides real-time preview generation as users edit templates.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import json
import logging
from typing import Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
from websockets.exceptions import ConnectionClosed

from .services import PDFService, EinkPDFServiceError
from .models import WebSocketMessage

logger = logging.getLogger(__name__)

# Initialize PDF service for preview generation
pdf_service = PDFService()


class ConnectionManager:
    """Manages WebSocket connections for real-time preview updates."""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        """
        Accept WebSocket connection and store it.
        
        Args:
            websocket: WebSocket connection
            client_id: Unique client identifier
        """
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"WebSocket client {client_id} connected")
    
    def disconnect(self, client_id: str) -> None:
        """
        Remove WebSocket connection.
        
        Args:
            client_id: Unique client identifier
        """
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"WebSocket client {client_id} disconnected")
    
    async def send_message(self, client_id: str, message: Dict[str, Any]) -> None:
        """
        Send message to specific client.
        
        Args:
            client_id: Target client identifier
            message: Message to send
        """
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_text(json.dumps(message))
            except ConnectionClosed:
                self.disconnect(client_id)
    
    async def send_error(self, client_id: str, error_message: str) -> None:
        """
        Send error message to client.
        
        Args:
            client_id: Target client identifier
            error_message: Error message to send
        """
        await self.send_message(client_id, {
            "type": "error",
            "data": {
                "message": error_message
            }
        })


# Global connection manager
connection_manager = ConnectionManager()


async def handle_websocket_connection(websocket: WebSocket, client_id: str) -> None:
    """
    Handle WebSocket connection for real-time preview updates.
    
    Args:
        websocket: WebSocket connection
        client_id: Unique client identifier
    """
    await connection_manager.connect(websocket, client_id)
    
    try:
        while True:
            # Receive message from client
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
            except json.JSONDecodeError:
                await connection_manager.send_error(client_id, "Invalid JSON message format")
                continue
            
            # Validate message structure
            if not isinstance(message_data, dict) or "type" not in message_data:
                await connection_manager.send_error(client_id, "Message must contain 'type' field")
                continue
            
            message_type = message_data.get("type")
            message_payload = message_data.get("data", {})
            
            if message_type == "preview_request":
                await handle_preview_request(client_id, message_payload)
            else:
                await connection_manager.send_error(client_id, f"Unknown message type: {message_type}")
                
    except WebSocketDisconnect:
        connection_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        await connection_manager.send_error(client_id, f"Server error: {str(e)}")
        connection_manager.disconnect(client_id)


async def handle_preview_request(client_id: str, payload: Dict[str, Any]) -> None:
    """
    Handle preview generation request.
    
    Args:
        client_id: Client identifier
        payload: Request payload containing template data
    """
    # Validate required fields
    required_fields = ["yaml_content", "profile"]
    for field in required_fields:
        if field not in payload:
            await connection_manager.send_error(client_id, f"Missing required field: {field}")
            return
    
    yaml_content = payload["yaml_content"]
    profile = payload["profile"]
    page_number = payload.get("page_number", 1)
    scale = payload.get("scale", 2.0)
    
    # Validate field types
    if not isinstance(yaml_content, str) or not yaml_content.strip():
        await connection_manager.send_error(client_id, "yaml_content must be a non-empty string")
        return
    
    if not isinstance(profile, str) or not profile.strip():
        await connection_manager.send_error(client_id, "profile must be a non-empty string")
        return
    
    if not isinstance(page_number, int) or page_number < 1:
        await connection_manager.send_error(client_id, "page_number must be a positive integer")
        return
    
    if not isinstance(scale, (int, float)) or scale <= 0:
        await connection_manager.send_error(client_id, "scale must be a positive number")
        return
    
    try:
        # Generate preview
        preview_bytes = pdf_service.generate_preview(
            yaml_content=yaml_content,
            profile=profile,
            page_number=page_number,
            scale=scale
        )
        
        # Convert to base64 for JSON transmission
        import base64
        preview_base64 = base64.b64encode(preview_bytes).decode('utf-8')
        
        # Send response
        await connection_manager.send_message(client_id, {
            "type": "preview_response",
            "data": {
                "preview_base64": preview_base64,
                "page_number": page_number,
                "scale": scale,
                "size_bytes": len(preview_bytes)
            }
        })
        
    except EinkPDFServiceError as e:
        await connection_manager.send_error(client_id, str(e))
    except Exception as e:
        logger.error(f"Preview generation error for client {client_id}: {e}")
        await connection_manager.send_error(client_id, f"Preview generation failed: {str(e)}")