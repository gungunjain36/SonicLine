#!/usr/bin/env python3
"""
Test script for making a call using the Twilio integration.
"""

import requests
import json
import sys
import time

def make_test_call(phone_number, message=None):
    """
    Make a test call to the specified phone number.
    
    Args:
        phone_number: The phone number to call
        message: Optional custom message
    """
    if not message:
        message = "Hello, this is a test call from Sonic Line. The Twilio integration is working correctly."
    
    url = "http://localhost:8000/twilio/make-call"
    payload = {
        "to_number": phone_number,
        "message": message
    }
    
    print(f"Making test call to {phone_number}...")
    
    try:
        response = requests.post(url, json=payload)
        response_data = response.json()
        
        if response.status_code == 200 and response_data.get("status") == "success":
            print("Call initiated successfully!")
            print(f"Call SID: {response_data.get('call_sid')}")
            
            # Wait for a moment and then check call status
            print("Waiting for call to connect...")
            time.sleep(5)
            
            # Check call logs
            logs_url = "http://localhost:8000/twilio/calls"
            logs_response = requests.get(logs_url)
            logs_data = logs_response.json()
            
            for call in logs_data.get("calls", []):
                if call.get("call_sid") == response_data.get("call_sid"):
                    print(f"Call status: {call.get('status')}")
                    break
            
            print("\nCall monitoring UI available at: http://localhost:8000/twilio/ui")
        else:
            print(f"Error: {response_data.get('message', 'Unknown error')}")
    
    except Exception as e:
        print(f"Error making call: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_call.py <phone_number> [message]")
        sys.exit(1)
    
    phone_number = sys.argv[1]
    message = sys.argv[2] if len(sys.argv) > 2 else None
    
    make_test_call(phone_number, message) 