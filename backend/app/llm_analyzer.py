import logging
import json
import os
from typing import Dict, List, Any, Optional, Tuple
import openai
from pydantic import BaseModel

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure OpenAI API
openai.api_key = os.getenv("OPENAI_API_KEY", "")

class IntentAnalysisRequest(BaseModel):
    message: str

class PromisedActionRequest(BaseModel):
    message: str

class ActionDetector:
    """
    Uses LLM to detect user intents and promised actions
    """
    
    def __init__(self):
        self.available_actions = [
            "get-token-by-ticker",
            "get-sonic-balance",
            "send-sonic",
            "swap-sonic",
            "get-token-price",
            "get-transaction-history",
            "create-wallet",
            "mint-nft"
        ]
        
        self.action_descriptions = {
            "get-token-by-ticker": "Get token address by ticker symbol",
            "get-sonic-balance": "Get $S or token balance",
            "send-sonic": "Send $S tokens to an address",
            "swap-sonic": "Swap tokens on Sonic DEX",
            "get-token-price": "Get current price of a token in USD or another base currency",
            "get-transaction-history": "Get transaction history for an address",
            "create-wallet": "Create a wallet using the Privy API",
            "mint-nft": "Mint an NFT on Sonic"
        }
    
    async def analyze_intent(self, message: str) -> Dict[str, Any]:
        """
        Analyze user message to determine intent
        """
        try:
            # Create a system prompt that describes available actions
            system_prompt = f"""
            You are an AI assistant that analyzes user messages to determine their intent.
            Available actions:
            {json.dumps(self.action_descriptions, indent=2)}
            
            Your task is to determine if the user's message is requesting one of these actions.
            If it is, respond with a JSON object containing:
            - intent: The action name (one of the available actions)
            - confidence: A number between 0 and 1 indicating your confidence
            - parameters: Any parameters needed for the action
            
            If the user's message doesn't match any action, respond with:
            {{"intent": "none", "confidence": 1.0, "parameters": {{}}}}
            
            Only respond with valid JSON. Do not include any explanations or additional text.
            """
            
            # Call the OpenAI API
            response = await openai.ChatCompletion.acreate(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                temperature=0.1,
                max_tokens=300
            )
            
            # Parse the response
            content = response.choices[0].message.content.strip()
            try:
                result = json.loads(content)
                logger.info(f"Intent analysis result: {result}")
                return result
            except json.JSONDecodeError:
                logger.error(f"Failed to parse LLM response as JSON: {content}")
                return {"intent": "none", "confidence": 0.0, "parameters": {}}
                
        except Exception as e:
            logger.error(f"Error analyzing intent: {e}")
            return {"intent": "none", "confidence": 0.0, "parameters": {}}
    
    async def detect_promised_actions(self, message: str) -> Dict[str, Any]:
        """
        Detect promised actions in an assistant's message
        """
        try:
            # Create a system prompt that describes available actions
            system_prompt = f"""
            You are an AI assistant that analyzes messages to detect promised actions.
            Available actions:
            {json.dumps(self.action_descriptions, indent=2)}
            
            Your task is to determine if the message contains promises to perform any of these actions.
            Respond with a JSON object containing an "actions" array. Each action should have:
            - type: The action name (one of the available actions)
            - confidence: A number between 0 and 1 indicating your confidence
            - parameters: Any parameters needed for the action
            
            If no actions are promised, respond with:
            {{"actions": []}}
            
            Only respond with valid JSON. Do not include any explanations or additional text.
            """
            
            # Call the OpenAI API
            response = await openai.ChatCompletion.acreate(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                temperature=0.1,
                max_tokens=500
            )
            
            # Parse the response
            content = response.choices[0].message.content.strip()
            try:
                result = json.loads(content)
                logger.info(f"Promised actions detection result: {result}")
                return result
            except json.JSONDecodeError:
                logger.error(f"Failed to parse LLM response as JSON: {content}")
                return {"actions": []}
                
        except Exception as e:
            logger.error(f"Error detecting promised actions: {e}")
            return {"actions": []}
    
    def detect_nft_request_fallback(self, message: str) -> Dict[str, Any]:
        """
        Fallback method to detect NFT generation requests without using LLM
        """
        lower_message = message.lower()
        
        # Check for explicit NFT requests
        if (
            ("create nft" in lower_message or 
             "mint nft" in lower_message or 
             "generate nft" in lower_message or
             "make nft" in lower_message) and
            ("for me" in lower_message or 
             "please" in lower_message or
             "can you" in lower_message)
        ):
            # Extract description if available
            description = "Abstract digital art"
            confidence = 0.7
            
            # Try to extract description
            import re
            description_patterns = [
                r'of ["\'"](.+?)["\']',
                r'showing ["\'"](.+?)["\']',
                r'with ["\'"](.+?)["\']'
            ]
            
            for pattern in description_patterns:
                match = re.search(pattern, message, re.IGNORECASE)
                if match:
                    description = match.group(1)
                    confidence = 0.9
                    break
            
            return {
                "intent": "mint-nft",
                "confidence": confidence,
                "parameters": {"description": description}
            }
        
        return {"intent": "none", "confidence": 0.0, "parameters": {}}

# Create a singleton instance
action_detector = ActionDetector() 