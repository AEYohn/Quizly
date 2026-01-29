"""
WebSocket Routes for real-time game synchronization.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from uuid import UUID
import json

from ..database import async_session
from ..models.game import Player
from ..websocket_manager import manager, GameTimer, active_timers

router = APIRouter()


@router.websocket("/ws/game/{game_id}/player")
async def player_websocket(
    websocket: WebSocket,
    game_id: str,
    player_id: str = Query(...)
):
    """
    WebSocket endpoint for players to receive real-time game updates.

    Events sent to players:
    - game_started: Game has begun
    - question_start: New question to display (without correct answer)
    - timer_tick: Timer countdown update (includes time_remaining)
    - question_end: Time's up for current question
    - results: Show question results
    - game_end: Game is over
    - player_joined: Another player joined (for lobby)
    - host_disconnected: Host has left the game
    """
    try:
        await manager.connect_player(websocket, game_id, player_id)
    except Exception as e:
        print(f"Failed to connect player WebSocket: {e}")
        return

    # Query player nickname from DB
    player_nickname = None
    player_avatar = None
    try:
        async with async_session() as db:
            result = await db.execute(
                select(Player).where(Player.id == UUID(player_id))
            )
            player = result.scalars().first()
            if player:
                player_nickname = player.nickname
                player_avatar = player.avatar
    except Exception as e:
        print(f"Failed to query player nickname: {e}")

    try:
        # Send initial connection confirmation
        await manager.send_to_player(websocket, {
            "type": "connected",
            "game_id": game_id,
            "player_id": player_id
        })

        # Notify host of player connection (with nickname if available)
        await manager.send_to_host(game_id, {
            "type": "player_connected",
            "player_id": player_id,
            "nickname": player_nickname,
            "avatar": player_avatar,
            "player_count": manager.get_player_count(game_id)
        })

        # Keep connection alive and handle incoming messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                # Handle player messages (e.g., answer submission could go through here)
                if message.get("type") == "ping":
                    await manager.send_to_player(websocket, {"type": "pong"})
            except Exception as e:
                # Connection may have been closed unexpectedly
                print(f"WebSocket receive error: {e}")
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket, game_id)
        # Notify host of disconnection
        try:
            await manager.send_to_host(game_id, {
                "type": "player_disconnected",
                "player_id": player_id,
                "player_count": manager.get_player_count(game_id)
            })
        except Exception:
            pass


@router.websocket("/ws/game/{game_id}/host")
async def host_websocket(
    websocket: WebSocket,
    game_id: str,
    token: str = Query(...)
):
    """
    WebSocket endpoint for the game host to control the game.
    
    Events received from host:
    - start_game: Begin the game
    - next_question: Move to next question
    - show_results: Display results for current question
    - end_game: End the game early
    
    Events sent to host:
    - player_connected/disconnected: Player joined/left
    - answer_submitted: A player submitted an answer
    - all_answered: All players have answered
    """
    # TODO: Validate token for host authentication
    await manager.connect_host(websocket, game_id)

    try:
        # Send connection confirmation to host (not to players)
        await websocket.send_text(json.dumps({
            "type": "connected",
            "role": "host",
            "game_id": game_id,
            "player_count": manager.get_player_count(game_id)
        }))

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle host commands
            msg_type = message.get("type")

            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

            # Host commands - acknowledge and process
            elif msg_type in ["start_game", "next_question", "show_results", "end_game"]:
                await websocket.send_text(json.dumps({
                    "type": "command_received",
                    "command": msg_type,
                    "status": "acknowledged"
                }))
                # Note: Actual game state changes are handled via REST API
                # This is intentional - REST provides proper DB transactions
                # WebSocket is for real-time sync only

            # Host requesting current player count
            elif msg_type == "get_player_count":
                await websocket.send_text(json.dumps({
                    "type": "player_count",
                    "count": manager.get_player_count(game_id)
                }))

    except WebSocketDisconnect:
        manager.disconnect(websocket, game_id)
        # Notify all players that host disconnected
        await manager.broadcast_to_game(game_id, {
            "type": "host_disconnected",
            "message": "The host has left the game"
        })


async def broadcast_game_state(game_id: str, event_type: str, data: dict):
    """
    Helper function to broadcast game state updates.
    Called from game_routes when game state changes.
    """
    message = {"type": event_type, **data}
    await manager.broadcast_to_game(game_id, message)


async def start_question_timer(game_id: str, duration: int, db_session_factory):
    """
    Start a synchronized timer for a question.
    When timer completes, automatically transition to results.
    """
    async def on_timer_complete():
        # Timer completed - broadcast to show results
        await manager.broadcast_to_game(game_id, {
            "type": "time_up"
        })
        # Remove from active timers
        if game_id in active_timers:
            del active_timers[game_id]
    
    # Stop any existing timer
    if game_id in active_timers:
        await active_timers[game_id].stop()
    
    # Create and start new timer
    timer = GameTimer(game_id, duration, on_timer_complete)
    active_timers[game_id] = timer
    await timer.start()


async def stop_game_timer(game_id: str):
    """Stop the timer for a game."""
    if game_id in active_timers:
        await active_timers[game_id].stop()
        del active_timers[game_id]
