from typing import Dict, Set, List, Any
from fastapi import WebSocket
import logging
import json
import asyncio

logger = logging.getLogger(__name__)

class WebSocketService:
    def __init__(self):
        # Map symbol -> Set of WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Map WebSocket -> Set of symbols (for cleanup)
        self.socket_subscriptions: Dict[WebSocket, Set[str]] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.socket_subscriptions[websocket] = set()
        logger.info(f"WebSocket connected: {websocket.client}")

    def disconnect(self, websocket: WebSocket):
        # Remove from all subscriptions
        if websocket in self.socket_subscriptions:
            for symbol in self.socket_subscriptions[websocket]:
                if symbol in self.active_connections:
                    self.active_connections[symbol].discard(websocket)
                    if not self.active_connections[symbol]:
                        del self.active_connections[symbol]
            del self.socket_subscriptions[websocket]
        logger.info(f"WebSocket disconnected: {websocket.client}")

    async def subscribe(self, websocket: WebSocket, symbols: List[str]):
        for symbol in symbols:
            if symbol not in self.active_connections:
                self.active_connections[symbol] = set()
            self.active_connections[symbol].add(websocket)
            self.socket_subscriptions[websocket].add(symbol)
        logger.info(f"WebSocket subscribed to: {symbols}")

    async def unsubscribe(self, websocket: WebSocket, symbols: List[str]):
        for symbol in symbols:
            if symbol in self.active_connections:
                self.active_connections[symbol].discard(websocket)
            if websocket in self.socket_subscriptions:
                self.socket_subscriptions[websocket].discard(symbol)
        logger.info(f"WebSocket unsubscribed from: {symbols}")

    async def broadcast_to_symbol(self, symbol: str, message: Dict[str, Any]):
        if symbol in self.active_connections:
            # Convert to JSON string once
            json_message = json.dumps(message)
            # Create tasks for all sends
            tasks = [
                connection.send_text(json_message)
                for connection in self.active_connections[symbol]
            ]
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)

ws_manager = WebSocketService()
