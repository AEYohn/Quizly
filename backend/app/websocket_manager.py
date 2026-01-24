"""
WebSocket Manager for real-time game synchronization.
Handles broadcasting game state to all connected players.
"""

from typing import Dict, List, Set
from fastapi import WebSocket
import json
import asyncio


class ConnectionManager:
    """Manages WebSocket connections for game rooms."""
    
    def __init__(self):
        # game_id -> set of connected WebSockets
        self.game_connections: Dict[str, Set[WebSocket]] = {}
        # game_id -> host WebSocket
        self.host_connections: Dict[str, WebSocket] = {}
        # websocket -> player_id (for players)
        self.player_map: Dict[WebSocket, str] = {}
    
    async def connect_player(self, websocket: WebSocket, game_id: str, player_id: str):
        """Connect a player to a game room."""
        await websocket.accept()
        if game_id not in self.game_connections:
            self.game_connections[game_id] = set()
        self.game_connections[game_id].add(websocket)
        self.player_map[websocket] = player_id
    
    async def connect_host(self, websocket: WebSocket, game_id: str):
        """Connect a host to a game room."""
        await websocket.accept()
        self.host_connections[game_id] = websocket
        if game_id not in self.game_connections:
            self.game_connections[game_id] = set()
    
    def disconnect(self, websocket: WebSocket, game_id: str):
        """Disconnect a WebSocket from a game room."""
        if game_id in self.game_connections:
            self.game_connections[game_id].discard(websocket)
            if not self.game_connections[game_id]:
                del self.game_connections[game_id]
        
        if game_id in self.host_connections and self.host_connections[game_id] == websocket:
            del self.host_connections[game_id]
        
        if websocket in self.player_map:
            del self.player_map[websocket]
    
    async def broadcast_to_game(self, game_id: str, message: dict):
        """Broadcast a message to all players in a game."""
        if game_id not in self.game_connections:
            return
        
        message_json = json.dumps(message)
        dead_connections = set()
        
        for connection in self.game_connections[game_id]:
            try:
                await connection.send_text(message_json)
            except Exception:
                dead_connections.add(connection)
        
        # Clean up dead connections
        for conn in dead_connections:
            self.disconnect(conn, game_id)
    
    async def send_to_host(self, game_id: str, message: dict):
        """Send a message to the game host."""
        if game_id not in self.host_connections:
            return
        
        try:
            await self.host_connections[game_id].send_text(json.dumps(message))
        except Exception:
            del self.host_connections[game_id]
    
    async def send_to_player(self, websocket: WebSocket, message: dict):
        """Send a message to a specific player."""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception:
            pass
    
    def get_player_count(self, game_id: str) -> int:
        """Get number of connected players in a game."""
        if game_id not in self.game_connections:
            return 0
        return len(self.game_connections[game_id])


# Global connection manager instance
manager = ConnectionManager()


class GameTimer:
    """Handles synchronized countdown timer for a game."""
    
    def __init__(self, game_id: str, duration: int, on_complete):
        self.game_id = game_id
        self.duration = duration
        self.remaining = duration
        self.on_complete = on_complete
        self.task: asyncio.Task = None
        self.running = False
    
    async def start(self):
        """Start the countdown timer."""
        self.running = True
        self.remaining = self.duration
        self.task = asyncio.create_task(self._countdown())
    
    async def stop(self):
        """Stop the countdown timer."""
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
    
    async def _countdown(self):
        """Internal countdown loop."""
        while self.remaining > 0 and self.running:
            # Broadcast timer update every second
            await manager.broadcast_to_game(self.game_id, {
                "type": "timer_tick",
                "remaining": self.remaining
            })
            await asyncio.sleep(1)
            self.remaining -= 1
        
        if self.running:
            # Timer completed
            await manager.broadcast_to_game(self.game_id, {
                "type": "timer_complete",
                "remaining": 0
            })
            if self.on_complete:
                await self.on_complete()


# Active timers by game_id
active_timers: Dict[str, GameTimer] = {}
