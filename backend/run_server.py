#!/usr/bin/env python3
"""
Run the ZerePy server with the SonicLine agent loaded.
"""
import os
import sys
import logging
from src.server import start_server
from src.cli import ZerePyCLI

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("run_server")

def main():
    """Main entry point for the server"""
    # Change to the backend directory if needed
    if not os.path.exists("agents"):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        os.chdir(script_dir)
        
    # Create CLI instance and load SonicLine agent
    cli = ZerePyCLI()
    try:
        cli._load_agent_from_file("sonicline")
        logger.info(f"Loaded agent: {cli.agent.name}")
    except Exception as e:
        logger.error(f"Failed to load SonicLine agent: {e}")
        sys.exit(1)
    
    # Start the server
    logger.info("Starting ZerePy server...")
    host = os.environ.get("ZEREPY_HOST", "0.0.0.0")
    port = int(os.environ.get("ZEREPY_PORT", "8000"))
    
    logger.info(f"Server will be available at http://{host}:{port}")
    logger.info("Use the following endpoints:")
    logger.info("- GET /: Server status")
    logger.info("- GET /agents: List available agents")
    logger.info("- GET /connections: List available connections")
    logger.info("- POST /agent/chat: Send a chat message to the agent")
    logger.info("- POST /agent/action: Execute a specific action")
    
    start_server(host=host, port=port)

if __name__ == "__main__":
    main() 