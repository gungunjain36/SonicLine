#!/usr/bin/env python3
"""
Simple client to interact with the ZerePy server.
"""
import requests
import argparse
import json
import sys

SERVER_URL = "https://e52f-2400-4f20-11-c00-31e9-c732-86d7-87c9.ngrok-free.app"

def get_server_status():
    """Get server status"""
    response = requests.get(f"{SERVER_URL}/")
    return response.json()

def list_agents():
    """List available agents"""
    response = requests.get(f"{SERVER_URL}/agents")
    return response.json()

def load_agent(agent_name):
    """Load a specific agent"""
    response = requests.post(f"{SERVER_URL}/agents/{agent_name}/load")
    return response.json()

def list_connections():
    """List available connections"""
    response = requests.get(f"{SERVER_URL}/connections")
    return response.json()

def send_chat_message(message):
    """Send a chat message to the agent"""
    response = requests.post(
        f"{SERVER_URL}/agent/chat",
        json={"message": message}
    )
    return response.json()

def execute_action(connection, action, params=None):
    """Execute a specific action"""
    if params is None:
        params = []
    
    response = requests.post(
        f"{SERVER_URL}/agent/action",
        json={
            "connection": connection,
            "action": action,
            "params": params
        }
    )
    return response.json()

def interactive_chat():
    """Start an interactive chat session"""
    print("Starting chat with SonicLine agent. Type 'exit' to quit.")
    print("-" * 50)
    
    while True:
        try:
            message = input("\nYou: ").strip()
            if message.lower() == "exit":
                break
                
            response = send_chat_message(message)
            if "response" in response:
                print(f"\nSonicLine: {response['response']}")
            else:
                print(f"\nError: {json.dumps(response, indent=2)}")
                
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error: {str(e)}")
    
    print("\nChat session ended.")

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="ZerePy Client")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Status command
    subparsers.add_parser("status", help="Get server status")
    
    # List agents command
    subparsers.add_parser("list-agents", help="List available agents")
    
    # Load agent command
    load_parser = subparsers.add_parser("load-agent", help="Load a specific agent")
    load_parser.add_argument("name", help="Agent name")
    
    # List connections command
    subparsers.add_parser("list-connections", help="List available connections")
    
    # Chat command
    chat_parser = subparsers.add_parser("chat", help="Send a chat message")
    chat_parser.add_argument("message", nargs="?", help="Message to send")
    
    # Interactive chat command
    subparsers.add_parser("interactive", help="Start interactive chat session")
    
    # Action command
    action_parser = subparsers.add_parser("action", help="Execute a specific action")
    action_parser.add_argument("connection", help="Connection name")
    action_parser.add_argument("action", help="Action name")
    action_parser.add_argument("params", nargs="*", help="Action parameters")
    
    args = parser.parse_args()
    
    try:
        if args.command == "status":
            result = get_server_status()
            print(json.dumps(result, indent=2))
            
        elif args.command == "list-agents":
            result = list_agents()
            print(json.dumps(result, indent=2))
            
        elif args.command == "load-agent":
            result = load_agent(args.name)
            print(json.dumps(result, indent=2))
            
        elif args.command == "list-connections":
            result = list_connections()
            print(json.dumps(result, indent=2))
            
        elif args.command == "chat":
            if not args.message:
                print("Error: Message is required")
                sys.exit(1)
                
            result = send_chat_message(args.message)
            print(json.dumps(result, indent=2))
            
        elif args.command == "interactive":
            interactive_chat()
            
        elif args.command == "action":
            result = execute_action(args.connection, args.action, args.params)
            print(json.dumps(result, indent=2))
            
        else:
            parser.print_help()
            
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to the server. Make sure it's running.")
        sys.exit(1)
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 