from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List, Any, Optional
import json
import logging
import asyncio
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define event types
class SocketEventType:
    ACTION_USED = 'action_used'
    NEW_MESSAGE = 'new_message'
    VOICE_COMMAND = 'voice_command'
    CONTEXT_UPDATE = 'context_update'
    TOOL_USED = 'tool_used'
    SESSION_JOINED = 'session_joined'
    SESSION_LEFT = 'session_left'

class ConnectionManager:
    def __init__(self):
        # Map of session_id -> list of connected WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Map of session_id -> list of connected device_ids
        self.active_devices: Dict[str, List[str]] = {}
        # Map of session_id -> list of recent messages
        self.session_messages: Dict[str, List[Dict[str, Any]]] = {}
        # Map of session_id -> list of recent actions
        self.session_actions: Dict[str, List[Dict[str, Any]]] = {}
        # Map of session_id -> last activity timestamp
        self.session_activity: Dict[str, float] = {}
        
        # Start background task to clean up inactive sessions
        asyncio.create_task(self.cleanup_inactive_sessions())

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        
        # Initialize session data structures if needed
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
            self.active_devices[session_id] = []
            self.session_messages[session_id] = []
            self.session_actions[session_id] = []
        
        # Add connection to session
        self.active_connections[session_id].append(websocket)
        
        # Update session activity
        self.session_activity[session_id] = datetime.now().timestamp()
        
        logger.info(f"Client connected to session {session_id}. Total connections: {len(self.active_connections[session_id])}")
        
        # Send session history to the new connection
        await self.send_session_history(websocket, session_id)

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
                logger.info(f"Client disconnected from session {session_id}. Remaining connections: {len(self.active_connections[session_id])}")
            
            # Clean up empty sessions
            if not self.active_connections[session_id]:
                logger.info(f"Session {session_id} has no more connections. Keeping history for reconnection.")
                # We don't delete the session data immediately to allow for reconnection

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str, session_id: str, exclude: Optional[WebSocket] = None):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                if connection != exclude:
                    try:
                        await connection.send_text(message)
                    except Exception as e:
                        logger.error(f"Error broadcasting message: {e}")
                        # We'll handle disconnection in the main connection handler

    async def handle_event(self, data: Dict[str, Any], websocket: WebSocket, session_id: str):
        event_type = data.get('type')
        payload = data.get('payload', {})
        
        # Update session activity
        self.session_activity[session_id] = datetime.now().timestamp()
        
        if not event_type:
            logger.warning(f"Received message without event type: {data}")
            return
        
        # Process event based on type
        if event_type == SocketEventType.SESSION_JOINED:
            device_id = payload.get('deviceId')
            if device_id and device_id not in self.active_devices[session_id]:
                self.active_devices[session_id].append(device_id)
                logger.info(f"Device {device_id} joined session {session_id}")
            
            # Broadcast device joined to all connections in the session
            await self.broadcast(json.dumps({
                'type': SocketEventType.SESSION_JOINED,
                'payload': {
                    'deviceId': device_id,
                    'timestamp': payload.get('timestamp', datetime.now().isoformat()),
                    'sessionId': session_id,
                    'activeDevices': self.active_devices[session_id]
                }
            }), session_id)
        
        elif event_type == SocketEventType.SESSION_LEFT:
            device_id = payload.get('deviceId')
            if device_id and device_id in self.active_devices[session_id]:
                self.active_devices[session_id].remove(device_id)
                logger.info(f"Device {device_id} left session {session_id}")
            
            # Broadcast device left to all connections in the session
            await self.broadcast(json.dumps({
                'type': SocketEventType.SESSION_LEFT,
                'payload': {
                    'deviceId': device_id,
                    'timestamp': payload.get('timestamp', datetime.now().isoformat()),
                    'sessionId': session_id,
                    'activeDevices': self.active_devices[session_id]
                }
            }), session_id)
        
        elif event_type == SocketEventType.ACTION_USED:
            # Store action in session history
            self.session_actions[session_id].append(payload)
            
            # Limit history size
            if len(self.session_actions[session_id]) > 100:
                self.session_actions[session_id] = self.session_actions[session_id][-100:]
            
            # Broadcast action to all connections in the session
            await self.broadcast(json.dumps({
                'type': SocketEventType.ACTION_USED,
                'payload': payload
            }), session_id)
        
        elif event_type == SocketEventType.NEW_MESSAGE:
            # Store message in session history
            self.session_messages[session_id].append(payload)
            
            # Limit history size
            if len(self.session_messages[session_id]) > 100:
                self.session_messages[session_id] = self.session_messages[session_id][-100:]
            
            # Broadcast message to all connections in the session
            await self.broadcast(json.dumps({
                'type': SocketEventType.NEW_MESSAGE,
                'payload': payload
            }), session_id)
        
        elif event_type == SocketEventType.TOOL_USED:
            # Broadcast tool usage to all connections in the session
            await self.broadcast(json.dumps({
                'type': SocketEventType.TOOL_USED,
                'payload': payload
            }), session_id)
        
        else:
            # For other event types, just broadcast to all connections in the session
            await self.broadcast(json.dumps(data), session_id)

    async def send_session_history(self, websocket: WebSocket, session_id: str):
        """Send session history to a newly connected client"""
        try:
            # Send active devices
            await websocket.send_text(json.dumps({
                'type': 'session_info',
                'payload': {
                    'sessionId': session_id,
                    'activeDevices': self.active_devices[session_id],
                    'messageCount': len(self.session_messages[session_id]),
                    'actionCount': len(self.session_actions[session_id])
                }
            }))
            
            # Send recent messages
            for message in self.session_messages[session_id]:
                await websocket.send_text(json.dumps({
                    'type': SocketEventType.NEW_MESSAGE,
                    'payload': message
                }))
            
            # Send recent actions
            for action in self.session_actions[session_id]:
                await websocket.send_text(json.dumps({
                    'type': SocketEventType.ACTION_USED,
                    'payload': action
                }))
        
        except Exception as e:
            logger.error(f"Error sending session history: {e}")

    async def cleanup_inactive_sessions(self):
        """Background task to clean up inactive sessions"""
        while True:
            try:
                current_time = datetime.now().timestamp()
                inactive_sessions = []
                
                # Find inactive sessions (no activity for 24 hours)
                for session_id, last_activity in self.session_activity.items():
                    if current_time - last_activity > 24 * 60 * 60:  # 24 hours
                        inactive_sessions.append(session_id)
                
                # Clean up inactive sessions
                for session_id in inactive_sessions:
                    logger.info(f"Cleaning up inactive session {session_id}")
                    if session_id in self.active_connections:
                        del self.active_connections[session_id]
                    if session_id in self.active_devices:
                        del self.active_devices[session_id]
                    if session_id in self.session_messages:
                        del self.session_messages[session_id]
                    if session_id in self.session_actions:
                        del self.session_actions[session_id]
                    if session_id in self.session_activity:
                        del self.session_activity[session_id]
            
            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")
            
            # Run cleanup every hour
            await asyncio.sleep(60 * 60)

# Create a connection manager instance
manager = ConnectionManager()

async def websocket_endpoint(websocket: WebSocket, session_id: str = "default"):
    await manager.connect(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                json_data = json.loads(data)
                await manager.handle_event(json_data, websocket, session_id)
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received: {data}")
                await manager.send_personal_message(json.dumps({
                    "error": "Invalid JSON format"
                }), websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, session_id) 