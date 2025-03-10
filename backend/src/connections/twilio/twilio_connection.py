import logging
from typing import Dict, Any, Optional
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Gather
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger("twilio_connection")

class TwilioConnection:
    """
    Connection class for Twilio services
    """

    def __init__(self):
        self.client = None
        
        
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.phone_number = os.getenv("TWILIO_PHONE_NUMBER")
        self.webhook_url = os.getenv("TWILIO_WEBHOOK_URL")
        self.configure()

    def is_configured(self) -> bool:
        """
        Check if the connection is configured
        """
        return self.client is not None

    def configure(self, config: Dict[str, Any] = None) -> bool:
        """
        Configure the Twilio connection
        
        Args:
            config: Optional configuration dictionary
        
        Returns:
            bool: True if configuration was successful
        """
        try:
            # Use provided config or default values
            if config:
                self.account_sid = config.get("account_sid", self.account_sid)
                self.auth_token = config.get("auth_token", self.auth_token)
                self.phone_number = config.get("phone_number", self.phone_number)
                self.webhook_url = config.get("webhook_url", self.webhook_url)
            
            # Initialize Twilio client
            self.client = Client(self.account_sid, self.auth_token)
            logger.info(f"Twilio connection configured with phone number {self.phone_number}")
            return True
        
        except Exception as e:
            logger.error(f"Error configuring Twilio connection: {str(e)}")
            self.client = None
            return False

    def get_phone_number(self) -> Optional[str]:
        """Get the configured phone number"""
        return self.phone_number if self.is_configured() else None

    def get_webhook_url(self) -> Optional[str]:
        """Get the configured webhook URL"""
        return self.webhook_url if self.is_configured() else None
        
    def create_twiml_response(self, message: str, gather_speech: bool = True) -> str:
        """
        Create a TwiML response with the given message
        
        Args:
            message: The message to say
            gather_speech: Whether to gather speech input after the message
            
        Returns:
            str: TwiML response as a string
        """
        response = VoiceResponse()
        
        if gather_speech:
            # Add a Gather verb to collect speech input
            gather = Gather(
                input='speech',
                action='/twilio/process-speech',
                method='POST',
                language='en-US',
                speechTimeout='auto'
            )
            gather.say(message)
            response.append(gather)
            
            # If no input is received, provide a message
            response.say("We didn't receive any input. Goodbye!")
        else:
            # Just say the message without gathering input
            response.say(message)
        
        return str(response)
        
    def make_call(self, to_number: str, message: str) -> Dict[str, Any]:
        """
        Make an outbound call
        
        Args:
            to_number: The phone number to call
            message: The message to say
            
        Returns:
            Dict with call details
        """
        try:
            if not self.is_configured():
                return {"status": "error", "message": "Twilio connection not configured"}
                
            # Create TwiML for the call
            twiml = self.create_twiml_response(message)
            
            # Make the call
            call = self.client.calls.create(
                to=to_number,
                from_=self.phone_number,
                twiml=twiml
            )
            
            return {
                "status": "success",
                "call_sid": call.sid,
                "to": to_number,
                "from": self.phone_number,
                "message": message
            }
            
        except Exception as e:
            logger.error(f"Error making call: {str(e)}")
            return {"status": "error", "message": f"Failed to make call: {str(e)}"}
            
    def process_speech_to_action(self, speech_result: str) -> Dict[str, Any]:
        """
        Process speech input to determine if it's an action request
        
        Args:
            speech_result: The speech input from the user
            
        Returns:
            Dict with action details if detected, or None
        """
        # Simple keyword detection for common actions
        speech_lower = speech_result.lower()
        
        # Check for balance requests
        if any(keyword in speech_lower for keyword in ["balance", "how much", "my wallet"]):
            return {
                "action": "get-sonic-balance",
                "connection": "sonic",
                "params": []
            }
            
        # Check for token price requests
        if any(keyword in speech_lower for keyword in ["price", "how much is", "value"]):
            # Try to extract token name
            tokens = ["sonic", "eth", "bitcoin", "btc", "ethereum"]
            for token in tokens:
                if token in speech_lower:
                    return {
                        "action": "get-token-price",
                        "connection": "sonic",
                        "params": [token]
                    }
            
        # Check for transaction history
        if any(keyword in speech_lower for keyword in ["history", "transactions", "activity"]):
            return {
                "action": "get-transaction-history",
                "connection": "sonic",
                "params": []
            }
            
        # Check for wallet creation
        if any(keyword in speech_lower for keyword in ["create wallet", "new wallet", "setup wallet"]):
            return {
                "action": "create-wallet",
                "connection": "sonic",
                "params": []
            }
            
        # No specific action detected
        return None 