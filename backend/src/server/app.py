from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, Response
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import asyncio
import signal
import threading
from pathlib import Path
from src.cli import ZerePyCLI
from src.connections.twilio.twilio_connection import TwilioConnection
import json
import time
import io
import re
from datetime import datetime

# Custom log handler to capture logs in memory
class MemoryLogHandler(logging.Handler):
    def __init__(self, max_logs=1000):
        super().__init__()
        self.logs = []
        self.max_logs = max_logs
        
    def emit(self, record):
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": self.format(record)
        }
        self.logs.append(log_entry)
        
        # Keep only the most recent logs
        if len(self.logs) > self.max_logs:
            self.logs = self.logs[-self.max_logs:]

# Create memory log handler
memory_log_handler = MemoryLogHandler()
memory_log_handler.setFormatter(logging.Formatter('%(message)s'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("server/app")

# Add memory handler to root logger
root_logger = logging.getLogger()
root_logger.addHandler(memory_log_handler)

# Store active calls and their conversation history
active_calls = {}
call_logs = []

# Communication logs to track user-assistant interactions
communication_logs = []
MAX_COMM_LOGS = 1000

def add_communication_log(is_user, message, imageUrl=None):
    """Add a message to the communication logs"""
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "is_user": is_user,
        "message": message
    }
    
    if imageUrl:
        log_entry["imageUrl"] = imageUrl
        
    communication_logs.append(log_entry)
    if len(communication_logs) > MAX_COMM_LOGS:
        communication_logs.pop(0)
    logger.info(f"{'User' if is_user else 'Assistant'}: {message[:100]}{'...' if len(message) > 100 else ''}")

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
        self.agent_loaded = False
        self.twilio_connection = None

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
        
        # Configure CORS
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # In production, replace with specific origins
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        self.state = ServerState()
        self.setup_routes()
        # by default load sonicline agent
        self.state.cli._load_agent_from_file("sonicline")
        self.state.agent_loaded = True if self.state.cli.agent else False
        
        # Initialize Twilio connection
        self.setup_twilio()

    def setup_twilio(self):
        """Setup Twilio connection"""
        # Initialize Twilio connection directly
        from src.connections.twilio.twilio_connection import TwilioConnection
        
        # Create a new Twilio connection
        twilio_conn = TwilioConnection()
        
        # Store it in the server state
        self.state.twilio_connection = twilio_conn
        
        # Log the setup
        logger.info(f"Twilio connection initialized with phone number: {twilio_conn.get_phone_number()}")

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
            
            # Log the user message
            add_communication_log(True, chat_request.message)
            
            # Check if the message is asking to create a wallet
            message = chat_request.message.lower()
            wallet_keywords = [
                "create wallet", "make wallet", "new wallet", "generate wallet", 
                "wallet creation", "create a wallet", "make a wallet"
            ]
            
            if any(keyword in message for keyword in wallet_keywords):
                # Return a response with detailed instructions for the frontend
                response = "I'll create a new wallet for you right away. Please wait a moment while I set this up..."
                add_communication_log(False, response)
                return {
                    "status": "success",
                    "response": response,
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
                # Log the assistant response
                add_communication_log(False, response)
                return {"status": "success", "response": response}
            except Exception as e:
                error_msg = f"Error processing chat message: {str(e)}"
                logger.error(error_msg)
                add_communication_log(False, f"I'm sorry, but there was an error processing your request: {str(e)}")
                return {"status": "error", "detail": error_msg}

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

        @self.app.post("/api/mint-nft")
        async def mint_nft(request: Request):
            """
            Mint an NFT with the provided metadata URI
            """
            try:
                data = await request.json()
                uri = data.get("uri")
                description = data.get("description", "")
                
                if not uri:
                    return JSONResponse(
                        status_code=400,
                        content={"error": "URI is required"}
                    )
                
                # Call the agent to mint the NFT
                result = self.state.cli.agent.mint_nft(uri)
                
                if result.get("success"):
                    # Log the successful NFT minting with image URL
                    image_url = result.get("image_url") or uri
                    add_communication_log(
                        is_user=False, 
                        message=f"Successfully minted NFT with description: {description}",
                        imageUrl=image_url
                    )
                    
                    return JSONResponse(
                        status_code=200,
                        content={
                            "success": True,
                            "message": f"Successfully minted NFT with description: {description}",
                            "transaction_hash": result.get("transaction_hash"),
                            "explorer_link": result.get("explorer_link"),
                            "image_url": image_url
                        }
                    )
                else:
                    add_communication_log(
                        is_user=False, 
                        message=f"Failed to mint NFT: {result.get('message', 'Unknown error')}"
                    )
                    
                    return JSONResponse(
                        status_code=500,
                        content={
                            "success": False,
                            "error": result.get("message", "Failed to mint NFT")
                        }
                    )
            except Exception as e:
                logger.error(f"Error minting NFT: {e}")
                add_communication_log(
                    is_user=False, 
                    message=f"Error minting NFT: {str(e)}"
                )
                
                return JSONResponse(
                    status_code=500,
                    content={"error": f"Error minting NFT: {str(e)}"}
                )

        @self.app.post("/twilio/configure")
        async def configure_twilio(request: Request):
            """
            Configure Twilio connection with account SID, auth token, and phone number
            """
            try:
                data = await request.json()
                account_sid = data.get("account_sid")
                auth_token = data.get("auth_token")
                phone_number = data.get("phone_number")
                webhook_url = data.get("webhook_url")
                
                if not account_sid or not auth_token or not phone_number:
                    return JSONResponse(
                        status_code=400,
                        content={"error": "account_sid, auth_token, and phone_number are required"}
                    )
                
                # Get the Twilio connection
                twilio_conn = self.state.twilio_connection
                if not twilio_conn:
                    return JSONResponse(
                        status_code=404,
                        content={"error": "Twilio connection not found"}
                    )
                
                # Configure the connection
                config = {
                    "account_sid": account_sid,
                    "auth_token": auth_token,
                    "phone_number": phone_number
                }
                
                if webhook_url:
                    config["webhook_url"] = webhook_url
                
                twilio_conn.configure(config)
                
                return JSONResponse(
                    status_code=200,
                    content={
                        "success": True,
                        "message": "Twilio connection configured successfully",
                        "phone_number": twilio_conn.get_phone_number()
                    }
                )
            except Exception as e:
                logger.error(f"Error configuring Twilio: {e}")
                return JSONResponse(
                    status_code=500,
                    content={"error": f"Error configuring Twilio: {str(e)}"}
                )
                
        @self.app.get("/twilio/status")
        async def twilio_status():
            """
            Get Twilio connection status
            """
            try:
                # Get the Twilio connection
                twilio_conn = self.state.twilio_connection
                if not twilio_conn:
                    return JSONResponse(
                        status_code=404,
                        content={"error": "Twilio connection not found"}
                    )
                
                return JSONResponse(
                    status_code=200,
                    content={
                        "configured": twilio_conn.is_configured(),
                        "phone_number": twilio_conn.get_phone_number() if twilio_conn.is_configured() else None,
                        "webhook_url": twilio_conn.get_webhook_url() if twilio_conn.is_configured() else None
                    }
                )
            except Exception as e:
                logger.error(f"Error getting Twilio status: {e}")
                return JSONResponse(
                    status_code=500,
                    content={"error": f"Error getting Twilio status: {str(e)}"}
                )
                
        @self.app.post("/twilio/incoming-call")
        async def incoming_call(request: Request):
            """
            Handle incoming calls from Twilio
            """
            try:
                # Get form data from Twilio
                form_data = await request.form()
                call_sid = form_data.get("CallSid")
                caller = form_data.get("From", "Unknown")
                
                logger.info(f"Incoming call from {caller} with SID: {call_sid}")
                
                # Initialize conversation history for this call
                active_calls[call_sid] = {
                    "caller": caller,
                    "history": [],
                    "start_time": time.time()
                }
                
                # Add to call logs
                call_logs.append({
                    "call_sid": call_sid,
                    "caller": caller,
                    "direction": "incoming",
                    "status": "in-progress",
                    "start_time": time.time(),
                    "logs": []
                })
                
                # Create TwiML response
                if self.state.twilio_connection:
                    twiml = self.state.twilio_connection.create_twiml_response(
                        "Hello, welcome to Sonic Line. How can I help you today?"
                    )
                    
                    # Log the system message
                    log_message("system", call_sid, "Hello, welcome to Sonic Line. How can I help you today?")
                    
                    return Response(content=twiml, media_type="text/xml")
                else:
                    logger.error("Twilio connection not available")
                    return Response(
                        content="<Response><Say>We're sorry, but there was an error processing your call.</Say></Response>",
                        media_type="text/xml"
                    )
            
            except Exception as e:
                logger.error(f"Error handling incoming call: {str(e)}")
                return Response(
                    content="<Response><Say>We're sorry, but there was an error processing your call.</Say></Response>",
                    media_type="text/xml"
                )

        @self.app.post("/twilio/process-speech")
        async def process_speech(request: Request):
            """
            Process speech input from a call and generate a response using the agent
            """
            try:
                # Get form data from Twilio
                form_data = await request.form()
                call_sid = form_data.get("CallSid")
                speech_result = form_data.get("SpeechResult", "")
                
                logger.info(f"Processing speech for call {call_sid}: {speech_result}")
                
                # Check if we have an active call
                if call_sid not in active_calls:
                    logger.warning(f"Received speech for unknown call SID: {call_sid}")
                    active_calls[call_sid] = {
                        "caller": form_data.get("From", "Unknown"),
                        "history": [],
                        "start_time": time.time()
                    }
                
                # Log the user message
                log_message("user", call_sid, speech_result)
                
                # Add user message to history
                active_calls[call_sid]["history"].append({"role": "user", "content": speech_result})
                
                # Check if speech maps to a specific action
                action_request = None
                if self.state.twilio_connection:
                    action_request = self.state.twilio_connection.process_speech_to_action(speech_result)
                
                # Process the message with the agent or execute the action
                if action_request:
                    # Execute the action
                    logger.info(f"Executing action from speech: {action_request}")
                    
                    try:
                        # Get the connection
                        connection = self.state.cli.connection_manager.get_connection(action_request["connection"])
                        if not connection:
                            agent_response = f"I'm sorry, but the {action_request['connection']} connection is not available."
                        else:
                            # Execute the action
                            result = connection.perform_action(action_request["action"], action_request["params"])
                            
                            # Format the response
                            if isinstance(result, dict):
                                if "success" in result and result["success"]:
                                    if action_request["action"] == "get-sonic-balance":
                                        agent_response = f"Your current balance is {result.get('balance', 'unknown')} {result.get('token', 'tokens')}."
                                    elif action_request["action"] == "get-token-price":
                                        agent_response = f"The current price of {result.get('token', 'the token')} is {result.get('price', 'unknown')}."
                                    elif action_request["action"] == "get-transaction-history":
                                        agent_response = f"You have {len(result.get('transactions', []))} recent transactions. The most recent one was {result.get('transactions', [{}])[0].get('description', 'unknown')}."
                                    elif action_request["action"] == "create-wallet":
                                        agent_response = "I've created a new wallet for you. For security reasons, please check the web interface for your wallet details."
                                    else:
                                        agent_response = f"Action {action_request['action']} completed successfully."
                                else:
                                    agent_response = f"I'm sorry, but there was an error executing the {action_request['action']} action: {result.get('message', 'Unknown error')}."
                            else:
                                agent_response = str(result)
                    except Exception as e:
                        logger.error(f"Error executing action: {str(e)}")
                        agent_response = f"I'm sorry, but there was an error executing the {action_request['action']} action."
                else:
                    # Process with the agent
                    agent_response = await process_with_agent(speech_result, call_sid, self.state)
                
                # Log the agent response
                log_message("assistant", call_sid, agent_response)
                
                # Add agent response to history
                active_calls[call_sid]["history"].append({"role": "assistant", "content": agent_response})
                
                # Create TwiML response
                if self.state.twilio_connection:
                    twiml = self.state.twilio_connection.create_twiml_response(agent_response)
                    return Response(content=twiml, media_type="text/xml")
                else:
                    logger.error("Twilio connection not available")
                    return Response(
                        content=f"<Response><Say>{agent_response}</Say></Response>",
                        media_type="text/xml"
                    )
            
            except Exception as e:
                logger.error(f"Error processing speech: {str(e)}")
                return Response(
                    content="<Response><Say>I'm sorry, but there was an error processing your request.</Say><Gather input='speech' action='/twilio/process-speech' method='POST'><Say>What would you like to do?</Say></Gather></Response>",
                    media_type="text/xml"
                )

        @self.app.post("/twilio/call-status")
        async def call_status(request: Request):
            """
            Handle call status callbacks from Twilio
            """
            try:
                form_data = await request.form()
                call_sid = form_data.get("CallSid")
                call_status = form_data.get("CallStatus")
                
                logger.info(f"Call status update for {call_sid}: {call_status}")
                
                # Update call logs
                for log in call_logs:
                    if log["call_sid"] == call_sid:
                        log["status"] = call_status
                        if call_status in ['completed', 'failed', 'busy', 'no-answer', 'canceled']:
                            log["end_time"] = time.time()
                
                # If call is completed or failed, clean up resources
                if call_status in ['completed', 'failed', 'busy', 'no-answer', 'canceled']:
                    if call_sid in active_calls:
                        logger.info(f"Removing call data for {call_sid}")
                        del active_calls[call_sid]
                
                return Response(status_code=200)
            
            except Exception as e:
                logger.error(f"Error handling call status: {str(e)}")
                return Response(status_code=500)

        @self.app.post("/twilio/make-call")
        async def make_call(request: Request):
            """
            Make an outbound call using Twilio
            """
            try:
                data = await request.json()
                to_number = data.get("to_number")
                message = data.get("message", "Hello from Sonic Line. This is an automated call.")
                
                if not to_number:
                    return JSONResponse(
                        status_code=400,
                        content={"error": "to_number is required"}
                    )
                
                # Get the Twilio connection
                if not self.state.twilio_connection or not self.state.twilio_connection.is_configured():
                    return JSONResponse(
                        status_code=400,
                        content={"error": "Twilio connection not configured"}
                    )
                
                # Make the call
                result = self.state.twilio_connection.make_call(to_number, message)
                
                # Add to call logs if successful
                if result.get("status") == "success":
                    call_logs.append({
                        "call_sid": result.get("call_sid"),
                        "caller": to_number,
                        "direction": "outgoing",
                        "status": "initiated",
                        "start_time": time.time(),
                        "logs": [
                            {"role": "system", "content": message, "timestamp": time.time()}
                        ]
                    })
                
                if result.get("status") == "success":
                    return JSONResponse(
                        status_code=200,
                        content=result
                    )
                else:
                    return JSONResponse(
                        status_code=500,
                        content=result
                    )
            except Exception as e:
                logger.error(f"Error making call: {e}")
                return JSONResponse(
                    status_code=500,
                    content={"error": f"Error making call: {str(e)}"}
                )

        @self.app.get("/twilio/calls")
        async def get_calls():
            """
            Get all call logs
            """
            return JSONResponse(
                status_code=200,
                content={"calls": call_logs}
            )
            
        @self.app.get("/twilio/call/{call_sid}")
        async def get_call(call_sid: str):
            """
            Get details for a specific call
            """
            for call in call_logs:
                if call["call_sid"] == call_sid:
                    return JSONResponse(
                        status_code=200,
                        content=call
                    )
            
            return JSONResponse(
                status_code=404,
                content={"error": f"Call with SID {call_sid} not found"}
            )
            
        @self.app.get("/twilio/ui")
        async def twilio_ui():
            """
            Render a simple UI for monitoring calls
            """
            html_content = """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Sonic Line - Call Monitor</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background-color: #f5f5f5;
                        color: #333;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                    }
                    h1 {
                        color: #2c3e50;
                        border-bottom: 2px solid #3498db;
                        padding-bottom: 10px;
                    }
                    .call-list {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    .call-card {
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        padding: 15px;
                        width: calc(33% - 20px);
                        min-width: 300px;
                        cursor: pointer;
                        transition: transform 0.2s;
                    }
                    .call-card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                    }
                    .call-header {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 10px;
                    }
                    .call-title {
                        font-weight: bold;
                        font-size: 1.1em;
                    }
                    .call-status {
                        padding: 3px 8px;
                        border-radius: 12px;
                        font-size: 0.8em;
                        font-weight: bold;
                    }
                    .status-completed {
                        background-color: #2ecc71;
                        color: white;
                    }
                    .status-in-progress {
                        background-color: #3498db;
                        color: white;
                    }
                    .status-failed {
                        background-color: #e74c3c;
                        color: white;
                    }
                    .call-details {
                        color: #7f8c8d;
                        font-size: 0.9em;
                        margin-bottom: 10px;
                    }
                    .conversation {
                        display: none;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        padding: 20px;
                        margin-bottom: 30px;
                    }
                    .conversation-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                    }
                    .conversation-title {
                        font-size: 1.2em;
                        font-weight: bold;
                    }
                    .close-btn {
                        background: #e74c3c;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 5px 10px;
                        cursor: pointer;
                    }
                    .message-list {
                        display: flex;
                        flex-direction: column;
                        gap: 15px;
                    }
                    .message {
                        padding: 10px 15px;
                        border-radius: 8px;
                        max-width: 80%;
                    }
                    .user-message {
                        align-self: flex-end;
                        background-color: #3498db;
                        color: white;
                    }
                    .assistant-message {
                        align-self: flex-start;
                        background-color: #f1f1f1;
                        color: #333;
                    }
                    .system-message {
                        align-self: center;
                        background-color: #f8f9fa;
                        color: #6c757d;
                        font-style: italic;
                        border: 1px dashed #dee2e6;
                    }
                    .message-time {
                        font-size: 0.7em;
                        margin-top: 5px;
                        opacity: 0.7;
                    }
                    .refresh-btn {
                        background: #3498db;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 10px 15px;
                        cursor: pointer;
                        margin-bottom: 20px;
                    }
                    .make-call-section {
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        padding: 20px;
                        margin-bottom: 30px;
                    }
                    .form-group {
                        margin-bottom: 15px;
                    }
                    label {
                        display: block;
                        margin-bottom: 5px;
                        font-weight: bold;
                    }
                    input, textarea {
                        width: 100%;
                        padding: 8px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                    }
                    .submit-btn {
                        background: #2ecc71;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 10px 15px;
                        cursor: pointer;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Sonic Line - Call Monitor</h1>
                    
                    <div class="make-call-section">
                        <h2>Make a Call</h2>
                        <div class="form-group">
                            <label for="phone-number">Phone Number:</label>
                            <input type="text" id="phone-number" placeholder="+1234567890">
                        </div>
                        <div class="form-group">
                            <label for="message">Message:</label>
                            <textarea id="message" rows="3" placeholder="Hello from Sonic Line. This is an automated call."></textarea>
                        </div>
                        <button class="submit-btn" onclick="makeCall()">Make Call</button>
                    </div>
                    
                    <button class="refresh-btn" onclick="loadCalls()">Refresh Calls</button>
                    
                    <div id="call-list" class="call-list">
                        <!-- Call cards will be inserted here -->
                    </div>
                    
                    <div id="conversation" class="conversation">
                        <div class="conversation-header">
                            <div class="conversation-title">Call Conversation</div>
                            <button class="close-btn" onclick="closeConversation()">Close</button>
                        </div>
                        <div id="message-list" class="message-list">
                            <!-- Messages will be inserted here -->
                        </div>
                    </div>
                </div>
                
                <script>
                    // Load calls on page load
                    document.addEventListener('DOMContentLoaded', loadCalls);
                    
                    // Set up polling for active calls
                    let pollingInterval;
                    let currentCallSid = null;
                    
                    function loadCalls() {
                        fetch('/twilio/calls')
                            .then(response => response.json())
                            .then(data => {
                                const callList = document.getElementById('call-list');
                                callList.innerHTML = '';
                                
                                if (data.calls.length === 0) {
                                    callList.innerHTML = '<p>No calls found.</p>';
                                    return;
                                }
                                
                                // Sort calls by start time (newest first)
                                data.calls.sort((a, b) => b.start_time - a.start_time);
                                
                                data.calls.forEach(call => {
                                    const callCard = document.createElement('div');
                                    callCard.className = 'call-card';
                                    callCard.onclick = () => showConversation(call.call_sid);
                                    
                                    const duration = call.end_time 
                                        ? Math.round((call.end_time - call.start_time) / 60 * 10) / 10
                                        : Math.round((Date.now() / 1000 - call.start_time) / 60 * 10) / 10;
                                    
                                    const statusClass = call.status === 'completed' 
                                        ? 'status-completed' 
                                        : call.status === 'in-progress' || call.status === 'ringing'
                                            ? 'status-in-progress'
                                            : 'status-failed';
                                    
                                    callCard.innerHTML = `
                                        <div class="call-header">
                                            <div class="call-title">${call.direction === 'incoming' ? 'From: ' : 'To: '} ${call.caller}</div>
                                            <div class="call-status ${statusClass}">${call.status}</div>
                                        </div>
                                        <div class="call-details">
                                            <div>Call SID: ${call.call_sid}</div>
                                            <div>Direction: ${call.direction}</div>
                                            <div>Duration: ${duration} minutes</div>
                                            <div>Messages: ${call.logs ? call.logs.length : 0}</div>
                                        </div>
                                    `;
                                    
                                    callList.appendChild(callCard);
                                });
                                
                                // If we're viewing a conversation, refresh it
                                if (currentCallSid) {
                                    showConversation(currentCallSid);
                                }
                            })
                            .catch(error => {
                                console.error('Error loading calls:', error);
                            });
                    }
                    
                    function showConversation(callSid) {
                        currentCallSid = callSid;
                        
                        fetch(`/twilio/call/${callSid}`)
                            .then(response => response.json())
                            .then(call => {
                                const conversation = document.getElementById('conversation');
                                const messageList = document.getElementById('message-list');
                                
                                conversation.style.display = 'block';
                                messageList.innerHTML = '';
                                
                                document.querySelector('.conversation-title').textContent = 
                                    `Call with ${call.caller} (${call.status})`;
                                
                                if (!call.logs || call.logs.length === 0) {
                                    messageList.innerHTML = '<p>No messages in this conversation.</p>';
                                    return;
                                }
                                
                                call.logs.forEach(log => {
                                    const message = document.createElement('div');
                                    message.className = `message ${log.role}-message`;
                                    
                                    const date = new Date(log.timestamp * 1000);
                                    const timeStr = date.toLocaleTimeString();
                                    
                                    message.innerHTML = `
                                        <div>${log.content}</div>
                                        <div class="message-time">${timeStr}</div>
                                    `;
                                    
                                    messageList.appendChild(message);
                                });
                                
                                // Scroll to bottom of conversation
                                conversation.scrollTop = conversation.scrollHeight;
                                
                                // Set up polling for active calls
                                clearInterval(pollingInterval);
                                if (call.status === 'in-progress' || call.status === 'ringing') {
                                    pollingInterval = setInterval(() => showConversation(callSid), 5000);
                                }
                            })
                            .catch(error => {
                                console.error('Error loading conversation:', error);
                            });
                    }
                    
                    function closeConversation() {
                        document.getElementById('conversation').style.display = 'none';
                        currentCallSid = null;
                        clearInterval(pollingInterval);
                    }
                    
                    function makeCall() {
                        const phoneNumber = document.getElementById('phone-number').value;
                        const message = document.getElementById('message').value || "Hello from Sonic Line. This is an automated call.";
                        
                        if (!phoneNumber) {
                            alert('Please enter a phone number');
                            return;
                        }
                        
                        fetch('/twilio/make-call', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                to_number: phoneNumber,
                                message: message
                            })
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.status === 'success') {
                                alert('Call initiated successfully!');
                                loadCalls();
                            } else {
                                alert(`Error: ${data.message}`);
                            }
                        })
                        .catch(error => {
                            console.error('Error making call:', error);
                            alert('Error making call. See console for details.');
                        });
                    }
                </script>
            </body>
            </html>
            """
            
            return HTMLResponse(content=html_content)

        @self.app.get("/logs")
        async def get_logs():
            """
            Get server logs
            """
            try:
                return JSONResponse(
                    status_code=200,
                    content={"logs": memory_log_handler.logs}
                )
            except Exception as e:
                logger.error(f"Error getting logs: {e}")
                return JSONResponse(
                    status_code=500,
                    content={"error": f"Error getting logs: {str(e)}"}
                )

        @self.app.get("/communication-logs")
        async def get_communication_logs():
            """
            Get communication logs between users and the assistant
            """
            try:
                return JSONResponse(
                    status_code=200,
                    content={"logs": communication_logs}
                )
            except Exception as e:
                logger.error(f"Error getting communication logs: {e}")
                return JSONResponse(
                    status_code=500,
                    content={"error": f"Error getting communication logs: {str(e)}"}
                )

def create_app():
    server = ZerePyServer()
    return server.app

# Create a global server_state for use in the Twilio webhook
server = ZerePyServer()
server_state = server.state

async def process_with_agent(message: str, call_sid: str, state: ServerState) -> str:
    """
    Process a message with the agent and return a response
    
    Args:
        message: The user's message
        call_sid: The call SID for context
        state: The server state
        
    Returns:
        The agent's response as a string
    """
    try:
        if not state.agent_loaded:
            return "I'm sorry, but the agent is not currently loaded. Please try again later."
        
        # Get conversation history for this call
        history = active_calls.get(call_sid, {}).get("history", [])
        
        # Process the message with the agent
        response = state.cli.agent.process_message(message, history)
        
        # Check if the response is a dictionary (action) or string
        if isinstance(response, dict):
            # Handle action responses
            if response.get("action") == "create_wallet":
                return "I can help you create a wallet. To proceed with wallet creation, please end this call and continue in the chat interface for security reasons."
            else:
                # For other actions, provide a generic response
                return "I understand you want to perform an action. For security reasons, please use our chat interface for this operation."
        
        return response
    
    except Exception as e:
        logger.error(f"Error processing message with agent: {str(e)}")
        return "I'm sorry, but there was an error processing your request. Please try again."

def log_message(role: str, call_sid: str, content: str):
    """
    Log a message for a call
    
    Args:
        role: The role of the message sender (user, assistant, system)
        call_sid: The call SID
        content: The message content
    """
    # Add to call logs
    for log in call_logs:
        if log["call_sid"] == call_sid:
            log["logs"].append({
                "role": role,
                "content": content,
                "timestamp": time.time()
            })
            break