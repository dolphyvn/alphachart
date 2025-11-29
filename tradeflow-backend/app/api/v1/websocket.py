from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List
import json
import logging

from app.services.websocket_service import ws_manager, WebSocketService

router = APIRouter()
logger = logging.getLogger(__name__)

@router.websocket("/stream")
async def websocket_endpoint(
    websocket: WebSocket,
    manager: WebSocketService = Depends(lambda: ws_manager)
):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                action = message.get("action")
                
                if action == "subscribe":
                    symbols = message.get("symbols", [])
                    await manager.subscribe(websocket, symbols)
                    await websocket.send_json({"status": "subscribed", "symbols": symbols})
                    
                elif action == "unsubscribe":
                    symbols = message.get("symbols", [])
                    await manager.unsubscribe(websocket, symbols)
                    await websocket.send_json({"status": "unsubscribed", "symbols": symbols})
                    
                elif action == "ping":
                    await websocket.send_json({"type": "pong"})
                    
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                await websocket.send_json({"error": str(e)})
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
