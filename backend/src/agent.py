import json
import random
import time
import logging
import os
from pathlib import Path
from dotenv import load_dotenv
from src.connection_manager import ConnectionManager
from src.helpers import print_h_bar
from src.action_handler import execute_action
import src.actions.twitter_actions  
import src.actions.echochamber_actions
import src.actions.solana_actions
from datetime import datetime
from typing import Any

REQUIRED_FIELDS = ["name", "bio", "traits", "examples", "loop_delay", "config", "tasks"]

logger = logging.getLogger("agent")

class ZerePyAgent:
    def __init__(
            self,
            agent_name: str
    ):
        try:
            agent_path = Path("agents") / f"{agent_name}.json"
            agent_dict = json.load(open(agent_path, "r"))

            missing_fields = [field for field in REQUIRED_FIELDS if field not in agent_dict]
            if missing_fields:
                raise KeyError(f"Missing required fields: {', '.join(missing_fields)}")

            self.name = agent_dict["name"]
            self.bio = agent_dict["bio"]
            self.traits = agent_dict["traits"]
            self.examples = agent_dict["examples"]
            self.example_accounts = agent_dict["example_accounts"]
            self.loop_delay = agent_dict["loop_delay"]
            self.connection_manager = ConnectionManager(agent_dict["config"])
            self.use_time_based_weights = agent_dict["use_time_based_weights"]
            self.time_based_multipliers = agent_dict["time_based_multipliers"]

            has_twitter_tasks = any("tweet" in task["name"] for task in agent_dict.get("tasks", []))
            
            twitter_config = next((config for config in agent_dict["config"] if config["name"] == "twitter"), None)
            
            if has_twitter_tasks and twitter_config:
                self.tweet_interval = twitter_config.get("tweet_interval", 900)
                self.own_tweet_replies_count = twitter_config.get("own_tweet_replies_count", 2)

            # Extract Echochambers config
            echochambers_config = next((config for config in agent_dict["config"] if config["name"] == "echochambers"), None)
            if echochambers_config:
                self.echochambers_message_interval = echochambers_config.get("message_interval", 60)
                self.echochambers_history_count = echochambers_config.get("history_read_count", 50)

            self.is_llm_set = False

            # Cache for system prompt
            self._system_prompt = None

            # Extract loop tasks
            self.tasks = agent_dict.get("tasks", [])
            self.task_weights = [task.get("weight", 0) for task in self.tasks]
            self.logger = logging.getLogger("agent")

            # Set up empty agent state
            self.state = {}
            
            # Initialize model provider
            self.model_provider = None
            # Setup LLM provider during initialization
            self._setup_llm_provider()

        except Exception as e:
            logger.error("Could not load ZerePy agent")
            raise e

    def _setup_llm_provider(self):
        # Get first available LLM provider and its model
        llm_providers = self.connection_manager.get_model_providers()
        if not llm_providers:
            logger.warning("No configured LLM provider found. Some functionality may be limited.")
            return
            
        self.model_provider = llm_providers[0]

        # Load Twitter username for self-reply detection if Twitter tasks exist
        if any("tweet" in task["name"] for task in self.tasks):
            load_dotenv()
            self.username = os.getenv('TWITTER_USERNAME', '').lower()
            if not self.username:
                logger.warning("Twitter username not found, some Twitter functionalities may be limited")

    def _construct_system_prompt(self) -> str:
        """Construct the system prompt from agent configuration"""
        if self._system_prompt is None:
            prompt_parts = []
            prompt_parts.extend(self.bio)

            if self.traits:
                prompt_parts.append("\nYour key traits are:")
                prompt_parts.extend(f"- {trait}" for trait in self.traits)

            if self.examples or self.example_accounts:
                prompt_parts.append("\nHere are some examples of your style (Please avoid repeating any of these):")
                if self.examples:
                    prompt_parts.extend(f"- {example}" for example in self.examples)

                if self.example_accounts:
                    for example_account in self.example_accounts:
                        tweets = self.connection_manager.perform_action(
                            connection_name="twitter",
                            action_name="get-latest-tweets",
                            params=[example_account]
                        )
                        if tweets:
                            prompt_parts.extend(f"- {tweet['text']}" for tweet in tweets)
            
            # Add Sonic and Allora action capabilities
            prompt_parts.append("\nIMPORTANT: You can execute blockchain actions on behalf of the user. When a user asks for blockchain information or operations, DO NOT just provide general information - actually execute the appropriate action.")
            
            # Check if Sonic connection is available
            if "sonic" in self.connection_manager.connections:
                prompt_parts.append("\nYou can perform the following Sonic blockchain actions:")
                prompt_parts.append("1. Check token balance - When a user asks about their balance, execute the 'get-balance' action on the Sonic connection.")
                prompt_parts.append("   Example: If user asks 'What's my balance?' or 'Check my Sonic balance', execute: self.perform_action('sonic', 'get-balance', address=user_address)")
                prompt_parts.append("2. Send tokens - When a user wants to send tokens, execute the 'transfer' action.")
                prompt_parts.append("   Example: If user says 'Send 5 $S to 0x123...', execute: self.perform_action('sonic', 'transfer', to_address='0x123...', amount=5)")
                prompt_parts.append("3. Swap tokens - When a user wants to swap tokens, execute the 'swap' action.")
                prompt_parts.append("   Example: If user says 'Swap 10 $S for USDC', find token addresses and execute: self.perform_action('sonic', 'swap', token_in=s_address, token_out=usdc_address, amount=10)")
                prompt_parts.append("4. Get token information - When a user asks about a token, execute the 'get-token-by-ticker' action.")
                prompt_parts.append("   Example: If user asks 'What's the address for USDC?', execute: self.perform_action('sonic', 'get-token-by-ticker', ticker='USDC')")
            
            # Check if Allora connection is available
            if "allora" in self.connection_manager.connections:
                prompt_parts.append("\nYou can perform the following Allora network actions:")
                prompt_parts.append("1. Get inference data - When a user asks about market predictions or inference data, execute the 'get-inference' action.")
                prompt_parts.append("   Example: If user asks 'What's the prediction for topic 42?', execute: self.perform_action('allora', 'get-inference', topic_id=42)")
                prompt_parts.append("2. List available topics - When a user asks about available topics, execute the 'list-topics' action.")
                prompt_parts.append("   Example: If user asks 'What topics are available on Allora?', execute: self.perform_action('allora', 'list-topics')")
            
            prompt_parts.append("\nWhen you need to execute an action, use Python code syntax in your thinking but respond to the user with the results in natural language. DO NOT tell the user you're executing code - just show them the results.")

            self._system_prompt = "\n".join(prompt_parts)

        return self._system_prompt
    
    def _adjust_weights_for_time(self, current_hour: int, task_weights: list) -> list:
        weights = task_weights.copy()
        
        # Reduce tweet frequency during night hours (1 AM - 5 AM)
        if 1 <= current_hour <= 5:
            weights = [
                weight * self.time_based_multipliers.get("tweet_night_multiplier", 0.4) if task["name"] == "post-tweet"
                else weight
                for weight, task in zip(weights, self.tasks)
            ]
            
        # Increase engagement frequency during day hours (8 AM - 8 PM) (peak hours?🤔)
        if 8 <= current_hour <= 20:
            weights = [
                weight * self.time_based_multipliers.get("engagement_day_multiplier", 1.5) if task["name"] in ("reply-to-tweet", "like-tweet")
                else weight
                for weight, task in zip(weights, self.tasks)
            ]
        
        return weights

    def prompt_llm(self, prompt: str, system_prompt: str = None) -> str:
        """Generate text using the configured LLM provider"""
        # Ensure LLM provider is set up
        if self.model_provider is None:
            self._setup_llm_provider()
            if self.model_provider is None:
                return "I'm sorry, but I can't process your request right now. The language model provider is not available."
                
        system_prompt = system_prompt or self._construct_system_prompt()
        
        # Check if the prompt is asking for Sonic or Allora actions
        sonic_balance_keywords = ["balance", "how much", "check balance", "my wallet", "my account"]
        sonic_token_keywords = ["token address", "token info", "what's the address", "what is the address"]
        sonic_transfer_keywords = ["send", "transfer", "pay"]
        sonic_swap_keywords = ["swap", "exchange", "trade"]
        allora_inference_keywords = ["prediction", "inference", "forecast", "topic"]
        allora_topics_keywords = ["topics", "available topics", "list topics"]
        
        # Extract potential wallet address from the prompt
        import re
        address_match = re.search(r'0x[a-fA-F0-9]{40}', prompt)
        address = address_match.group(0) if address_match else None
        
        # Extract potential amount from the prompt
        amount_match = re.search(r'(\d+(\.\d+)?)\s*(\$S|S|tokens?|USDC|ETH)', prompt)
        amount = float(amount_match.group(1)) if amount_match else None
        token_type = amount_match.group(3) if amount_match else None
        
        # Check for Sonic balance request
        if any(keyword in prompt.lower() for keyword in sonic_balance_keywords) and "sonic" in self.connection_manager.connections:
            try:
                # If address is provided, use it; otherwise, use default
                if address:
                    result = self.perform_action("sonic", "get-balance", address=address)
                else:
                    result = self.perform_action("sonic", "get-balance")
                
                if result:
                    return f"Your balance on Sonic is {result} $S."
                else:
                    return "I tried to check your balance, but couldn't retrieve it. Please make sure your wallet is properly configured."
            except Exception as e:
                logger.error(f"Error executing Sonic balance action: {e}")
        
        # Check for token info request
        elif any(keyword in prompt.lower() for keyword in sonic_token_keywords) and "sonic" in self.connection_manager.connections:
            # Extract token ticker from prompt
            ticker_match = re.search(r'for\s+([A-Z]{2,10})', prompt)
            ticker = ticker_match.group(1) if ticker_match else None
            
            if ticker:
                try:
                    result = self.perform_action("sonic", "get-token-by-ticker", ticker=ticker)
                    if result:
                        return f"The address for {ticker} on Sonic is {result}."
                    else:
                        return f"I couldn't find the token address for {ticker}. It might not be available on Sonic."
                except Exception as e:
                    logger.error(f"Error executing Sonic token action: {e}")
        
        # Check for transfer request
        elif any(keyword in prompt.lower() for keyword in sonic_transfer_keywords) and "sonic" in self.connection_manager.connections:
            if address and amount:
                try:
                    if token_type and token_type.upper() != "$S" and token_type.upper() != "S":
                        # Get token address first
                        token_address = self.perform_action("sonic", "get-token-by-ticker", ticker=token_type.upper())
                        if token_address:
                            result = self.perform_action("sonic", "transfer", to_address=address, amount=amount, token_address=token_address)
                            return f"I've sent {amount} {token_type.upper()} to {address}. Transaction completed!"
                    else:
                        result = self.perform_action("sonic", "transfer", to_address=address, amount=amount)
                        return f"I've sent {amount} $S to {address}. Transaction completed!"
                except Exception as e:
                    logger.error(f"Error executing Sonic transfer action: {e}")
                    return f"I couldn't complete the transfer. Error: {str(e)}"
        
        # Check for swap request
        elif any(keyword in prompt.lower() for keyword in sonic_swap_keywords) and "sonic" in self.connection_manager.connections:
            # Extract token information from the prompt
            # Pattern: Swap {amount} {token_in} for {token_out}
            swap_match = re.search(r'(?:swap|exchange|trade)\s+(\d+(?:\.\d+)?)\s*(\$?S|USDC|ETH|[A-Z]+)\s+(?:for|to)\s+(\$?S|USDC|ETH|[A-Z]+)', prompt, re.IGNORECASE)
            
            if swap_match:
                swap_amount = float(swap_match.group(1))
                token_in_symbol = swap_match.group(2).upper().replace('$', '')
                token_out_symbol = swap_match.group(3).upper().replace('$', '')
                
                try:
                    # Get token addresses
                    token_in_address = None
                    token_out_address = None
                    
                    if token_in_symbol == 'S':
                        # Native token
                        token_in_address = "0x0000000000000000000000000000000000000000"
                    else:
                        token_in_address = self.perform_action("sonic", "get-token-by-ticker", ticker=token_in_symbol)
                    
                    if token_out_symbol == 'S':
                        # Native token
                        token_out_address = "0x0000000000000000000000000000000000000000"
                    else:
                        token_out_address = self.perform_action("sonic", "get-token-by-ticker", ticker=token_out_symbol)
                    
                    if token_in_address and token_out_address:
                        # Default slippage of 0.5%
                        result = self.perform_action("sonic", "swap", token_in=token_in_address, token_out=token_out_address, amount=swap_amount, slippage=0.5)
                        return f"I've swapped {swap_amount} {token_in_symbol} for {token_out_symbol}. Swap completed successfully!"
                    else:
                        return f"I couldn't find one of the token addresses. Please check if {token_in_symbol} and {token_out_symbol} are available on Sonic."
                except Exception as e:
                    logger.error(f"Error executing Sonic swap action: {e}")
                    return f"I couldn't complete the swap. Error: {str(e)}"
            else:
                return "I understand you want to swap tokens, but I need more information. Please specify the amount, input token, and output token. For example: 'Swap 10 $S for USDC'"
        
        # Check for Allora topics request
        elif any(keyword in prompt.lower() for keyword in allora_topics_keywords) and "allora" in self.connection_manager.connections:
            try:
                topics = self.perform_action("allora", "list-topics")
                if topics and len(topics) > 0:
                    topics_text = "\n".join([f"Topic #{topic['id']}: {topic['name']}" for topic in topics[:5]])
                    return f"Here are some available topics on Allora:\n{topics_text}\n\nThere are {len(topics)} topics in total."
                else:
                    return "I couldn't retrieve the list of topics from Allora. Please try again later."
            except Exception as e:
                logger.error(f"Error executing Allora list-topics action: {e}")
        
        # Check for Allora inference request
        elif any(keyword in prompt.lower() for keyword in allora_inference_keywords) and "allora" in self.connection_manager.connections:
            # Extract topic ID from prompt
            topic_match = re.search(r'topic\s+#?(\d+)', prompt)
            topic_id = int(topic_match.group(1)) if topic_match else None
            
            if topic_id:
                try:
                    inference = self.perform_action("allora", "get-inference", topic_id=topic_id)
                    if inference:
                        return f"Inference for Topic #{topic_id}: {inference['inference']}"
                    else:
                        return f"I couldn't retrieve inference data for Topic #{topic_id}. It might not be available."
                except Exception as e:
                    logger.error(f"Error executing Allora get-inference action: {e}")
        
        # If no specific action was detected or executed, use the LLM to generate a response
        return self.connection_manager.perform_action(
            connection_name=self.model_provider,
            action_name="generate-text",
            params=[prompt, system_prompt]
        )

    def perform_action(self, connection_name: str, action_name: str, **kwargs) -> Any:
        """
        Perform an action on a connection with given parameters.
        
        Args:
            connection_name: The name of the connection to use
            action_name: The name of the action to perform
            **kwargs: Parameters for the action
            
        Returns:
            The result of the action
        """
        # Map action names if needed
        action_mapping = {
            # Sonic actions
            "sonic": {
                "get-balance": "get-balance",
                "transfer": "transfer",
                "deploy-contract": "deploy-contract",
                "call-contract": "call-contract",
                "get-transaction": "get-transaction",
                "get-receipt": "get-receipt",
                "create-wallet": "create-wallet",
                "register-wallet": "register-wallet"
            },
            # Allora actions
            "allora": {
                "get-balance": "get-balance",
                "transfer": "transfer"
            }
        }
        
        # Check if connection exists
        if connection_name not in self.connection_manager.connections:
            raise ValueError(f"Unknown connection: {connection_name}")
        
        # Map action name if needed
        if connection_name in action_mapping and action_name in action_mapping[connection_name]:
            action_name = action_mapping[connection_name][action_name]
        else:
            raise ValueError(f"Unknown action: {action_name}")
        
        # Special handling for wallet-related actions
        if action_name in ["create-wallet", "register-wallet"]:
            # These actions only require Privy credentials, not full configuration
            pass
        elif not self.connection_manager.is_configured(connection_name):
            raise ValueError(f"Connection {connection_name} is not properly configured")
        
        # Convert kwargs to list for connection manager
        params = list(kwargs.values()) if kwargs else []
        
        # Perform the action
        return self.connection_manager.perform_action(connection_name, action_name, params)
    
    def select_action(self, use_time_based_weights: bool = False) -> dict:
        task_weights = [weight for weight in self.task_weights.copy()]
        
        if use_time_based_weights:
            current_hour = datetime.now().hour
            task_weights = self._adjust_weights_for_time(current_hour, task_weights)
        
        return random.choices(self.tasks, weights=task_weights, k=1)[0]

    def loop(self):
        """Main agent loop for autonomous behavior"""
        if not self.is_llm_set:
            self._setup_llm_provider()

        logger.info("\n🚀 Starting agent loop...")
        logger.info("Press Ctrl+C at any time to stop the loop.")
        print_h_bar()

        time.sleep(2)
        logger.info("Starting loop in 5 seconds...")
        for i in range(5, 0, -1):
            logger.info(f"{i}...")
            time.sleep(1)

        try:
            while True:
                success = False
                try:
                    # REPLENISH INPUTS
                    # TODO: Add more inputs to complexify agent behavior
                    if "timeline_tweets" not in self.state or self.state["timeline_tweets"] is None or len(self.state["timeline_tweets"]) == 0:
                        if any("tweet" in task["name"] for task in self.tasks):
                            logger.info("\n👀 READING TIMELINE")
                            self.state["timeline_tweets"] = self.connection_manager.perform_action(
                                connection_name="twitter",
                                action_name="read-timeline",
                                params=[]
                            )

                    if "room_info" not in self.state or self.state["room_info"] is None:
                        if any("echochambers" in task["name"] for task in self.tasks):
                            logger.info("\n👀 READING ECHOCHAMBERS ROOM INFO")
                            self.state["room_info"] = self.connection_manager.perform_action(
                                connection_name="echochambers",
                                action_name="get-room-info",
                                params={}
                            )

                    # CHOOSE AN ACTION
                    # TODO: Add agentic action selection
                    
                    action = self.select_action(use_time_based_weights=self.use_time_based_weights)
                    action_name = action["name"]

                    # PERFORM ACTION
                    success = execute_action(self, action_name)

                    logger.info(f"\n⏳ Waiting {self.loop_delay} seconds before next loop...")
                    print_h_bar()
                    time.sleep(self.loop_delay if success else 60)

                except Exception as e:
                    logger.error(f"\n❌ Error in agent loop iteration: {e}")
                    logger.info(f"⏳ Waiting {self.loop_delay} seconds before retrying...")
                    time.sleep(self.loop_delay)

        except KeyboardInterrupt:
            logger.info("\n🛑 Agent loop stopped by user.")
            return

    def process_message(self, message: str) -> str:
        """
        Process a chat message and return a response.
        This is the main entry point for chat functionality.
        
        Args:
            message: The user's message
            
        Returns:
            The agent's response
        """
        # Use the prompt_llm method to generate a response
        return self.prompt_llm(message)