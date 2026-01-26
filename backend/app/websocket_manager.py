"""
WebSocket Manager for real-time game synchronization.
Handles broadcasting game state to all connected players.

Supports two modes:
- In-memory (default): Single server, no Redis required
- Redis pub/sub: Multi-server, requires Redis for cross-instance messaging
"""

from typing import Dict, Set, Optional, Callable, Awaitable, Protocol
from fastapi import WebSocket
from datetime import datetime, timezone, timedelta
import json
import asyncio
import os
import logging

logger = logging.getLogger(__name__)


class ConnectionManagerProtocol(Protocol):
    """Protocol defining the ConnectionManager interface."""

    async def connect_player(self, websocket: WebSocket, game_id: str, player_id: str) -> None: ...
    async def connect_host(self, websocket: WebSocket, game_id: str) -> None: ...
    def disconnect(self, websocket: WebSocket, game_id: str) -> None: ...
    async def broadcast_to_game(self, game_id: str, message: dict) -> None: ...
    async def send_to_host(self, game_id: str, message: dict) -> None: ...
    async def send_to_player(self, websocket: WebSocket, message: dict) -> None: ...
    def get_player_count(self, game_id: str) -> int: ...


class ConnectionManager:
    """Manages WebSocket connections for game rooms (in-memory, single server)."""

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


class RedisConnectionManager:
    """Manages WebSocket connections with Redis pub/sub for multi-server support.

    Local WebSocket connections are stored in-memory (WebSocket objects can't be serialized).
    Redis pub/sub is used to broadcast messages across all server instances.
    """

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._redis: Optional["Redis"] = None
        self._pubsub: Optional["PubSub"] = None
        self._subscriber_task: Optional[asyncio.Task] = None

        # Local connections (same as ConnectionManager)
        self.game_connections: Dict[str, Set[WebSocket]] = {}
        self.host_connections: Dict[str, WebSocket] = {}
        self.player_map: Dict[WebSocket, str] = {}

        # Track subscribed channels
        self._subscribed_games: Set[str] = set()

    async def initialize(self):
        """Initialize Redis connection and start subscriber."""
        try:
            import redis.asyncio as redis
            self._redis = redis.from_url(self.redis_url, decode_responses=True)
            await self._redis.ping()
            logger.info("Redis connection established for WebSocket manager")
        except Exception as e:
            logger.warning(f"Redis connection failed, falling back to in-memory: {e}")
            self._redis = None

    async def close(self):
        """Close Redis connections."""
        if self._subscriber_task:
            self._subscriber_task.cancel()
            try:
                await self._subscriber_task
            except asyncio.CancelledError:
                pass

        if self._pubsub:
            await self._pubsub.close()

        if self._redis:
            await self._redis.close()

    async def _ensure_subscribed(self, game_id: str):
        """Ensure we're subscribed to the game's Redis channel."""
        if not self._redis or game_id in self._subscribed_games:
            return

        if self._pubsub is None:
            self._pubsub = self._redis.pubsub()
            self._subscriber_task = asyncio.create_task(self._subscriber_loop())

        channel = f"game:{game_id}"
        await self._pubsub.subscribe(channel)
        self._subscribed_games.add(game_id)
        logger.debug(f"Subscribed to Redis channel: {channel}")

    async def _unsubscribe(self, game_id: str):
        """Unsubscribe from a game's Redis channel if no local connections."""
        if game_id not in self._subscribed_games:
            return

        # Only unsubscribe if no local connections for this game
        has_players = game_id in self.game_connections and self.game_connections[game_id]
        has_host = game_id in self.host_connections

        if not has_players and not has_host:
            if self._pubsub:
                channel = f"game:{game_id}"
                await self._pubsub.unsubscribe(channel)
                self._subscribed_games.discard(game_id)
                logger.debug(f"Unsubscribed from Redis channel: {channel}")

    async def _subscriber_loop(self):
        """Listen for messages from Redis and forward to local WebSockets."""
        try:
            async for message in self._pubsub.listen():
                if message["type"] != "message":
                    continue

                channel = message["channel"]
                if not channel.startswith("game:"):
                    continue

                game_id = channel.replace("game:", "")
                data = json.loads(message["data"])

                # Forward to local connections (don't re-publish)
                await self._broadcast_local(game_id, data)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Redis subscriber error: {e}")

    async def _broadcast_local(self, game_id: str, message: dict):
        """Broadcast to local WebSocket connections only."""
        if game_id not in self.game_connections:
            return

        message_json = json.dumps(message)
        dead_connections = set()

        for connection in self.game_connections[game_id]:
            try:
                await connection.send_text(message_json)
            except Exception:
                dead_connections.add(connection)

        for conn in dead_connections:
            self.disconnect(conn, game_id)

    async def connect_player(self, websocket: WebSocket, game_id: str, player_id: str):
        """Connect a player to a game room."""
        await websocket.accept()
        if game_id not in self.game_connections:
            self.game_connections[game_id] = set()
        self.game_connections[game_id].add(websocket)
        self.player_map[websocket] = player_id

        # Subscribe to Redis channel for this game
        await self._ensure_subscribed(game_id)

    async def connect_host(self, websocket: WebSocket, game_id: str):
        """Connect a host to a game room."""
        await websocket.accept()
        self.host_connections[game_id] = websocket
        if game_id not in self.game_connections:
            self.game_connections[game_id] = set()

        # Subscribe to Redis channel for this game
        await self._ensure_subscribed(game_id)

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

        # Schedule unsubscribe check (don't await in sync method)
        asyncio.create_task(self._unsubscribe(game_id))

    async def broadcast_to_game(self, game_id: str, message: dict):
        """Broadcast a message to all players in a game across all servers."""
        if self._redis:
            # Publish to Redis - all servers (including this one) will receive it
            channel = f"game:{game_id}"
            await self._redis.publish(channel, json.dumps(message))
        else:
            # Fallback to local-only broadcast
            await self._broadcast_local(game_id, message)

    async def send_to_host(self, game_id: str, message: dict):
        """Send a message to the game host (local only - host is always on one server)."""
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
        """Get number of connected players in a game (local server only)."""
        if game_id not in self.game_connections:
            return 0
        return len(self.game_connections[game_id])


def create_connection_manager() -> ConnectionManager | RedisConnectionManager:
    """Factory function to create the appropriate connection manager.

    Uses Redis if REDIS_URL is set, otherwise falls back to in-memory.
    """
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        logger.info(f"Creating Redis-backed ConnectionManager")
        return RedisConnectionManager(redis_url)
    else:
        logger.info("Creating in-memory ConnectionManager (no REDIS_URL set)")
        return ConnectionManager()


# Global connection manager instance
# Will be initialized properly in app startup
manager: ConnectionManager | RedisConnectionManager = create_connection_manager()


async def initialize_manager():
    """Initialize the connection manager (call during app startup)."""
    global manager
    if isinstance(manager, RedisConnectionManager):
        await manager.initialize()


async def close_manager():
    """Close the connection manager (call during app shutdown)."""
    global manager
    if isinstance(manager, RedisConnectionManager):
        await manager.close()


class GameTimer:
    """Handles synchronized countdown timer for a game.

    Supports persistence for server restart recovery:
    - Stores end_at timestamp in database via persist_callback
    - Can resume from remaining time on server restart
    """

    def __init__(
        self,
        game_id: str,
        duration: int,
        on_complete: Optional[Callable[[], Awaitable[None]]],
        persist_callback: Optional[Callable[[str, Optional[datetime], Optional[int]], Awaitable[None]]] = None,
    ):
        self.game_id = game_id
        self.duration = duration
        self.remaining = duration
        self.on_complete = on_complete
        self.persist_callback = persist_callback
        self.task: Optional[asyncio.Task] = None
        self.running = False
        self.end_at: Optional[datetime] = None

    async def start(self):
        """Start the countdown timer."""
        self.running = True
        self.remaining = self.duration
        self.end_at = datetime.now(timezone.utc).replace(microsecond=0)
        self.end_at = self.end_at + timedelta(seconds=self.duration)

        # Persist timer state to database
        if self.persist_callback:
            await self.persist_callback(self.game_id, self.end_at, self.duration)

        self.task = asyncio.create_task(self._countdown())

    async def start_from_remaining(self, remaining_seconds: int):
        """Start timer with specific remaining time (for recovery)."""
        self.running = True
        self.remaining = remaining_seconds
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

        # Clear persisted timer state
        if self.persist_callback:
            await self.persist_callback(self.game_id, None, None)

    async def _countdown(self):
        """Internal countdown loop."""
        while self.remaining > 0 and self.running:
            # Broadcast timer update every second
            await manager.broadcast_to_game(self.game_id, {
                "type": "timer_tick",
                "time_remaining": self.remaining,
                "remaining": self.remaining  # Keep for backward compatibility
            })
            await asyncio.sleep(1)
            self.remaining -= 1

        if self.running:
            # Timer completed - send question_end event
            await manager.broadcast_to_game(self.game_id, {
                "type": "question_end",
                "time_remaining": 0
            })

            # Clear persisted timer state
            if self.persist_callback:
                await self.persist_callback(self.game_id, None, None)

            if self.on_complete:
                await self.on_complete()


# Active timers by game_id
active_timers: Dict[str, GameTimer] = {}


async def recover_timer(
    game_id: str,
    timer_end_at: datetime,
    on_complete: Optional[Callable[[], Awaitable[None]]],
    persist_callback: Optional[Callable[[str, Optional[datetime], Optional[int]], Awaitable[None]]] = None,
) -> Optional[GameTimer]:
    """Recover a timer from persisted state after server restart.

    Returns the recovered timer if there's time remaining, None otherwise.
    """
    now = datetime.now(timezone.utc)

    # Ensure timer_end_at is timezone-aware
    if timer_end_at.tzinfo is None:
        timer_end_at = timer_end_at.replace(tzinfo=timezone.utc)

    remaining_seconds = int((timer_end_at - now).total_seconds())

    if remaining_seconds <= 0:
        # Timer already expired - trigger completion
        if on_complete:
            await on_complete()
        if persist_callback:
            await persist_callback(game_id, None, None)
        return None

    # Create and start timer with remaining time
    timer = GameTimer(
        game_id=game_id,
        duration=remaining_seconds,
        on_complete=on_complete,
        persist_callback=persist_callback,
    )
    await timer.start_from_remaining(remaining_seconds)
    active_timers[game_id] = timer
    return timer
