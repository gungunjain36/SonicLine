from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import os
import logging
from datetime import datetime

# Import the WebSocket manager
from app.websocket import websocket_endpoint
from app.llm_analyzer import action_detector, IntentAnalysisRequest, PromisedActionRequest

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Communication logs storage
communication_logs = []

class MessageRequest(BaseModel):
    message: str

class MessageResponse(BaseModel):
    message: str
    response: str
    logs: Optional[List[Dict[str, Any]]] = None
    tools: Optional[List[Dict[str, Any]]] = None

@app.get("/")
async def root():
    return {"message": "Welcome to SonicLine API"}

@app.post("/agent/chat")
async def agent_chat(request: Request):
    data = await request.json()
    message = data.get("message", "")
    
    # Log the user message
    log_message(message, is_user=True)
    
    # Check if this is an NFT generation request
    nft_keywords = ["nft", "generate nft", "create nft", "mint nft"]
    is_nft_request = any(keyword in message.lower() for keyword in nft_keywords)
    
    if is_nft_request:
        # Extract the description from the message
        description = message
        for keyword in ["nft", "generate", "create", "mint"]:
            description = description.replace(keyword, "").strip()
        
        # Log the NFT generation request
        log_message(f"NFT generation request detected: {description}", is_user=False)
        
        # Return a response that the frontend will use to trigger NFT generation
        response = f"I'll start generating your NFT with the description: \"{description}\". Please wait while I create this for you."
        log_message(response, is_user=False)
        
        return {
            "status": "success",
            "response": response,
            "action": {
                "type": "nft_generation",
                "description": description
            }
        }
    
    # For other messages, use a simple response
    try:
        # Generate a simple response
        response = "I'm your SonicLine assistant. I can help you generate NFTs, create wallets, and more. What would you like to do today?"
        
        # Log the assistant response
        log_message(response, is_user=False)
        
        return {
            "status": "success",
            "response": response
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

@app.get("/communication-logs")
async def get_communication_logs():
    return {"logs": communication_logs}

@app.post("/api/mint-nft")
async def mint_nft(request: Request):
    data = await request.json()
    uri = data.get("uri", "")
    description = data.get("description", "")
    
    # Log the NFT minting
    log_message(f"Minting NFT with description: {description}", is_user=False)
    
    # Simulate minting (placeholder)
    transaction_hash = "0x" + os.urandom(32).hex()
    explorer_link = f"https://explorer.sonic.com/tx/{transaction_hash}"
    
    return {
        "success": True,
        "transaction_hash": transaction_hash,
        "explorer_link": explorer_link,
        "description": description
    }

@app.post("/api/analyze-intent")
async def analyze_intent(request: Request):
    data = await request.json()
    message = data.get("message", "")
    
    # Log the intent analysis request
    log_message(f"Analyzing intent for message: {message}", is_user=False)
    
    # For now, we'll implement a simple detection for NFT generation
    nft_keywords = ["nft", "generate nft", "create nft", "mint nft"]
    is_nft_request = any(keyword in message.lower() for keyword in nft_keywords)
    
    return {
        "success": True,
        "intents": {
            "nft_generation": is_nft_request,
            "wallet_creation": "wallet" in message.lower() and "create" in message.lower(),
            "token_swap": "swap" in message.lower(),
            "token_price": "price" in message.lower() or "worth" in message.lower(),
            "transaction_history": "history" in message.lower() or "transactions" in message.lower()
        }
    }

@app.post("/api/detect-promised-actions")
async def detect_promised_actions(request: Request):
    data = await request.json()
    message = data.get("message", "")
    
    # Log the promised actions detection request
    log_message(f"Detecting promised actions in message: {message}", is_user=False)
    
    # Simple detection for NFT generation promises
    nft_keywords = ["generate", "create", "mint", "nft", "image"]
    nft_count = sum(1 for keyword in nft_keywords if keyword in message.lower())
    is_nft_promise = nft_count >= 2
    
    return {
        "success": True,
        "actions": [
            {
                "type": "nft_generation",
                "probability": 0.9 if is_nft_promise else 0.1,
                "description": "Generate and mint an NFT" if is_nft_promise else ""
            }
        ]
    }

def log_message(message: str, is_user: bool, image_url: Optional[str] = None):
    """Add a message to the communication logs"""
    communication_logs.append({
        "timestamp": datetime.now().isoformat(),
        "is_user": is_user,
        "message": message,
        "imageUrl": image_url
    })
    
    # Keep only the last 1000 messages
    if len(communication_logs) > 1000:
        communication_logs.pop(0)

# Add WebSocket endpoint
app.add_websocket_route("/ws/{session_id}", websocket_endpoint) 