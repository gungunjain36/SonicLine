#!/usr/bin/env python3
"""
Test script for wallet creation functionality.
This script tests both the backend wallet creation and client-side wallet registration.
"""

import requests
import json
import time
import sys

# Configuration
API_URL = "https://e52f-2400-4f20-11-c00-31e9-c732-86d7-87c9.ngrok-free.app"
WALLET_CHAIN_TYPE = "ethereum"

def test_backend_wallet_creation():
    """Test wallet creation using the backend API"""
    print("\n=== Testing Backend Wallet Creation ===")
    
    try:
        # Create a wallet using the backend API
        response = requests.post(
            f"{API_URL}/agent/action",
            json={
                "connection": "sonic",
                "action": "create-wallet",
                "params": [WALLET_CHAIN_TYPE]
            }
        )
        
        # Check the response
        if response.status_code == 200:
            result = response.json()
            if result.get("status") == "success":
                wallet_data = result.get("result")
                print(f"✅ Wallet created successfully!")
                print(f"   ID: {wallet_data.get('id')}")
                print(f"   Address: {wallet_data.get('address')}")
                print(f"   Chain: {wallet_data.get('chain_type')}")
                return wallet_data
            else:
                print(f"❌ Failed to create wallet: {result.get('detail')}")
        else:
            print(f"❌ API request failed with status code {response.status_code}")
            print(response.text)
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    
    return None

def test_wallet_registration(wallet_data):
    """Test wallet registration using the backend API"""
    print("\n=== Testing Wallet Registration ===")
    
    if not wallet_data:
        print("❌ No wallet data available for registration test")
        return False
    
    try:
        # Register the wallet using the backend API
        response = requests.post(
            f"{API_URL}/agent/action",
            json={
                "connection": "sonic",
                "action": "register-wallet",
                "params": [wallet_data]
            }
        )
        
        # Check the response
        if response.status_code == 200:
            result = response.json()
            if result.get("status") == "success":
                print(f"✅ Wallet registered successfully!")
                return True
            else:
                print(f"❌ Failed to register wallet: {result.get('detail')}")
        else:
            print(f"❌ API request failed with status code {response.status_code}")
            print(response.text)
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    
    return False

def main():
    """Main test function"""
    print("Starting wallet functionality tests...")
    
    # Test backend wallet creation
    wallet_data = test_backend_wallet_creation()
    
    # Test wallet registration if wallet creation was successful
    if wallet_data:
        test_wallet_registration(wallet_data)
    
    print("\nTests completed!")

if __name__ == "__main__":
    main() 