from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import asyncio
import signal
import threading
from pathlib import Path
from src.cli import ZerePyCLI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("server/app")

class ActionRequest(BaseModel):
    """Request model for agent actions"""
    connection: str
    action: str
    params: Optional[List[str]] = []

class ChatRequest(BaseModel):
    """Request model for chat messages"""
    message: str

class ConfigureRequest(BaseModel):
    """Request model for configuring connections"""
    connection: str
    params: Optional[Dict[str, Any]] = {}

class ServerState:
    """Simple state management for the server"""
    def __init__(self):
        self.cli = ZerePyCLI()
        self.agent_running = False
        self.agent_task = None
        self._stop_event = threading.Event()

    def _run_agent_loop(self):
        """Run agent loop in a separate thread"""
        try:
            log_once = False
            while not self._stop_event.is_set():
                if self.cli.agent:
                    try:
                        if not log_once:
                            logger.info("Loop logic not implemented")
                            log_once = True

                    except Exception as e:
                        logger.error(f"Error in agent action: {e}")
                        if self._stop_event.wait(timeout=30):
                            break
        except Exception as e:
            logger.error(f"Error in agent loop thread: {e}")
        finally:
            self.agent_running = False
            logger.info("Agent loop stopped")

    async def start_agent_loop(self):
        """Start the agent loop in background thread"""
        if not self.cli.agent:
            raise ValueError("No agent loaded")
        
        if self.agent_running:
            raise ValueError("Agent already running")

        self.agent_running = True
        self._stop_event.clear()
        self.agent_task = threading.Thread(target=self._run_agent_loop)
        self.agent_task.start()

    async def stop_agent_loop(self):
        """Stop the agent loop"""
        if self.agent_running:
            self._stop_event.set()
            if self.agent_task:
                self.agent_task.join(timeout=5)
            self.agent_running = False

class ZerePyServer:
    def __init__(self):
        self.app = FastAPI(title="ZerePy Server")
        self.state = ServerState()
        self.setup_routes()
        # by default load sonicline agent
        self.state.cli._load_agent_from_file("sonicline")

    def setup_routes(self):
        @self.app.get("/")
        async def root():
            """Server status endpoint"""
            return {
                "status": "running",
                "agent": self.state.cli.agent.name if self.state.cli.agent else None,
                "agent_running": self.state.agent_running
            }

        @self.app.get("/agents")
        async def list_agents():
            """List available agents"""
            try:
                agents = []
                agents_dir = Path("agents")
                if agents_dir.exists():
                    for agent_file in agents_dir.glob("*.json"):
                        if agent_file.stem != "general":
                            agents.append(agent_file.stem)
                return {"agents": agents}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/agents/{name}/load")
        async def load_agent(name: str):
            """Load a specific agent"""
            try:
                self.state.cli._load_agent_from_file(name)
                return {
                    "status": "success",
                    "agent": name
                }
            except Exception as e:
                raise HTTPException(status_code=400, detail=str(e))

        @self.app.get("/connections")
        async def list_connections():
            """List all available connections"""
            if not self.state.cli.agent:
                raise HTTPException(status_code=400, detail="No agent loaded")
            
            try:
                connections = {}
                for name, conn in self.state.cli.agent.connection_manager.connections.items():
                    connections[name] = {
                        "configured": conn.is_configured(),
                        "is_llm_provider": conn.is_llm_provider
                    }
                return {"connections": connections}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/agent/action")
        async def agent_action(request: Request):
            """
            Endpoint to perform an action with the agent.
            
            Request body should contain:
            - connection: The name of the connection to use
            - action: The name of the action to perform
            - params: Parameters for the action (can be a list or a dictionary)
            """
            try:
                data = await request.json()
                connection = data.get("connection")
                action = data.get("action")
                params = data.get("params", [])
                
                if not connection or not action:
                    return {"status": "error", "detail": "Missing connection or action"}
                
                # Handle different parameter formats
                kwargs = {}
                
                # If params is a list of dictionaries, extract the first one
                if isinstance(params, list):
                    if len(params) > 0:
                        if isinstance(params[0], dict):
                            # For register-wallet action, pass the wallet data directly
                            if action == "register-wallet":
                                kwargs = {"wallet_data": params[0]}
                            else:
                                # For other actions, unpack the dictionary
                                kwargs = params[0]
                        else:
                            # For actions with positional arguments (like create-wallet)
                            if action == "create-wallet":
                                kwargs = {"chain_type": params[0] if params else "ethereum"}
                            elif action == "register-wallet":
                                # This shouldn't happen, but handle it just in case
                                return {"status": "error", "detail": "Invalid wallet data format"}
                            else:
                                # For other actions with positional args
                                kwargs = {"params": params}
                elif isinstance(params, dict):
                    # If params is a dictionary, use it directly
                    kwargs = params
                
                # Perform the action
                logger.info(f"Performing action: {action} on {connection} with params: {kwargs}")
                result = self.state.cli.agent.perform_action(
                    connection_name=connection,
                    action_name=action,
                    **kwargs
                )
                
                return {"status": "success", "result": result}
            except Exception as e:
                logger.error(f"Error in agent_action: {str(e)}")
                return {"status": "error", "detail": str(e)}

        @self.app.post("/agent/chat")
        async def agent_chat(chat_request: ChatRequest):
            """Process a chat message and return a response"""
            if not self.state.cli.agent:
                raise HTTPException(status_code=400, detail="No agent loaded")
            
            # Check if the message is asking to create a wallet
            message = chat_request.message.lower()
            wallet_keywords = [
                "create wallet", "make wallet", "new wallet", "generate wallet", 
                "wallet creation", "create a wallet", "make a wallet"
            ]
            
            if any(keyword in message for keyword in wallet_keywords):
                # Return a response with detailed instructions for the frontend
                return {
                    "status": "success",
                    "response": "I'll create a new wallet for you right away. Please wait a moment while I set this up...",
                    "action": "create_wallet_directly",
                    "chain_type": "ethereum",  # Default to Ethereum
                    "wallet_details": {
                        "should_create": True,
                        "should_show_in_chat": True,
                        "should_notify_backend": True,
                        "no_auth_required": True  # Explicitly indicate no authentication is required
                    }
                }
            
            # Normal chat processing for other messages
            try:
                response = await asyncio.to_thread(
                    self.state.cli.agent.process_message,
                    chat_request.message
                )
                return {"status": "success", "response": response}
            except Exception as e:
                logger.error(f"Error processing chat message: {str(e)}")
                return {"status": "error", "detail": str(e)}

        @self.app.post("/agent/start")
        async def start_agent():
            """Start the agent loop"""
            if not self.state.cli.agent:
                raise HTTPException(status_code=400, detail="No agent loaded")
            
            try:
                await self.state.start_agent_loop()
                return {"status": "success", "message": "Agent loop started"}
            except Exception as e:
                raise HTTPException(status_code=400, detail=str(e))

        @self.app.post("/agent/stop")
        async def stop_agent():
            """Stop the agent loop"""
            try:
                await self.state.stop_agent_loop()
                return {"status": "success", "message": "Agent loop stopped"}
            except Exception as e:
                raise HTTPException(status_code=400, detail=str(e))
        
        @self.app.post("/connections/{name}/configure")
        async def configure_connection(name: str, config: ConfigureRequest):
            """Configure a specific connection"""
            if not self.state.cli.agent:
                raise HTTPException(status_code=400, detail="No agent loaded")
            
            try:
                connection = self.state.cli.agent.connection_manager.connections.get(name)
                if not connection:
                    raise HTTPException(status_code=404, detail=f"Connection {name} not found")
                
                success = connection.configure(**config.params)
                if success:
                    return {"status": "success", "message": f"Connection {name} configured successfully"}
                else:
                    raise HTTPException(status_code=400, detail=f"Failed to configure {name}")
                    
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/connections/{name}/status")
        async def connection_status(name: str):
            """Get configuration status of a connection"""
            if not self.state.cli.agent:
                raise HTTPException(status_code=400, detail="No agent loaded")
                
            try:
                connection = self.state.cli.agent.connection_manager.connections.get(name)
                if not connection:
                    raise HTTPException(status_code=404, detail=f"Connection {name} not found")
                    
                return {
                    "name": name,
                    "configured": connection.is_configured(verbose=True),
                    "is_llm_provider": connection.is_llm_provider
                }
                
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

def create_app():
    server = ZerePyServer()
    return server.app