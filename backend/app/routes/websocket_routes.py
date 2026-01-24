"""
WebSocket Routes for real-time game synchronization.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
import json

from ..database import get_db
from ..models.game import GameSession, Quiz, Player
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
    - question_show: New question to display (without correct answer)
    - timer_tick: Timer countdown update
    - timer_complete: Time's up
    - results_show: Show question results
    - game_finished: Game is over
    - player_joined: Another player joined (for lobby)
    """
    await manager.connect_player(websocket, game_id, player_id)
    
    try:
        # Send initial connection confirmation
        await manager.send_to_player(websocket, {
            "type": "connected",
            "game_id": game_id,
            "player_id": player_id
        })
        
        # Notify host of player connection
        await manager.send_to_host(game_id, {
            "type": "player_connected",
            "player_id": player_id,
            "player_count": manager.get_player_count(game_id)
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle player messages (e.g., answer submission could go through here)
            if message.get("type") == "ping":
                await manager.send_to_player(websocket, {"type": "pong"})
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, game_id)
        # Notify host of disconnection
        await manager.send_to_host(game_id, {
            "type": "player_disconnected",
            "player_id": player_id,
            "player_count": manager.get_player_count(game_id)
        })


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
        await manager.send_to_player(websocket, {
            "type": "connected",
            "role": "host",
            "game_id": game_id,
            "player_count": manager.get_player_count(game_id)
        })
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle host commands
            msg_type = message.get("type")
            
            if msg_type == "ping":
                await manager.send_to_player(websocket, {"type": "pong"})
            
            # Other host commands are handled via REST API for simplicity
            # but we acknowledge them here
            elif msg_type in ["start_game", "next_question", "show_results", "end_game"]:
                await manager.send_to_player(websocket, {
                    "type": "command_received",
                    "command": msg_type
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, game_id)
        # If host disconnects, optionally notify players
        await manager.broadcast_to_game(game_id, {
            "type": "host_disconnected"
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
