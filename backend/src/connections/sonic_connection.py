import logging
import os
import requests
import json
import time
from typing import Dict, Any, Optional
from dotenv import load_dotenv, set_key
from web3 import Web3
from web3.middleware import geth_poa_middleware
from src.constants.abi import ERC20_ABI
from src.connections.base_connection import BaseConnection, Action, ActionParameter
from src.constants.networks import SONIC_NETWORKS

logger = logging.getLogger("connections.sonic_connection")


class SonicConnectionError(Exception):
    """Base exception for Sonic connection errors"""
    pass

class SonicConnection(BaseConnection):
    
    def __init__(self, config: Dict[str, Any]):
        logger.info("Initializing Sonic connection...")
        self._web3 = None
        
        # Get network configuration
        network = config.get("network", "mainnet")
        if network not in SONIC_NETWORKS:
            raise ValueError(f"Invalid network '{network}'. Must be one of: {', '.join(SONIC_NETWORKS.keys())}")
            
        network_config = SONIC_NETWORKS[network]
        self.explorer = network_config["scanner_url"]
        self.rpc_url = network_config["rpc_url"]
        
        # Privy API configuration
        self.privy_app_id = config.get("privy_app_id", os.getenv("PRIVY_APP_ID", ""))
        self.privy_app_secret = config.get("privy_app_secret", os.getenv("PRIVY_APP_SECRET", ""))
        self.privy_authorization_key = config.get("privy_authorization_key", os.getenv("PRIVY_AUTHORIZATION_KEY", ""))
        self.privy_api_url = "https://api.privy.io/v1/wallets"
        
        super().__init__(config)
        self._initialize_web3()
        self.ERC20_ABI = ERC20_ABI
        self.NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        self.aggregator_api = "https://aggregator-api.kyberswap.com/sonic/api/v1"

    def _get_explorer_link(self, tx_hash: str) -> str:
        """Generate block explorer link for transaction"""
        return f"{self.explorer}/tx/{tx_hash}"

    def _initialize_web3(self):
        """Initialize Web3 connection"""
        if not self._web3:
            self._web3 = Web3(Web3.HTTPProvider(self.rpc_url))
            self._web3.middleware_onion.inject(geth_poa_middleware, layer=0)
            if not self._web3.is_connected():
                raise SonicConnectionError("Failed to connect to Sonic network")
            
            try:
                chain_id = self._web3.eth.chain_id
                logger.info(f"Connected to network with chain ID: {chain_id}")
            except Exception as e:
                logger.warning(f"Could not get chain ID: {e}")

    @property
    def is_llm_provider(self) -> bool:
        return False

    def validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Sonic configuration from JSON"""
        required = ["network"]
        missing = [field for field in required if field not in config]
        if missing:
            raise ValueError(f"Missing config fields: {', '.join(missing)}")
        
        if config["network"] not in SONIC_NETWORKS:
            raise ValueError(f"Invalid network '{config['network']}'. Must be one of: {', '.join(SONIC_NETWORKS.keys())}")
            
        return config

    def get_token_by_ticker(self, ticker: str) -> Optional[str]:
        """Get token address by ticker symbol"""
        try:
            if ticker.lower() in ["s", "S"]:
                return "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
                
            response = requests.get(
                f"https://api.dexscreener.com/latest/dex/search?q={ticker}"
            )
            response.raise_for_status()

            data = response.json()
            if not data.get('pairs'):
                return None

            sonic_pairs = [
                pair for pair in data["pairs"] if pair.get("chainId") == "sonic"
            ]
            sonic_pairs.sort(key=lambda x: x.get("fdv", 0), reverse=True)

            sonic_pairs = [
                pair
                for pair in sonic_pairs
                if pair.get("baseToken", {}).get("symbol", "").lower() == ticker.lower()
            ]

            if sonic_pairs:
                return sonic_pairs[0].get("baseToken", {}).get("address")
            return None

        except Exception as error:
            logger.error(f"Error fetching token address: {str(error)}")
            return None

    def register_actions(self) -> None:
        self.actions = {
            "get-token-by-ticker": Action(
                name="get-token-by-ticker",
                parameters=[
                    ActionParameter("ticker", True, str, "Token ticker symbol to look up")
                ],
                description="Get token address by ticker symbol"
            ),
            "get-balance": Action(
                name="get-balance",
                parameters=[
                    ActionParameter("address", False, str, "Address to check balance for"),
                    ActionParameter("token_address", False, str, "Optional token address")
                ],
                description="Get $S or token balance"
            ),
            "transfer": Action(
                name="transfer",
                parameters=[
                    ActionParameter("to_address", True, str, "Recipient address"),
                    ActionParameter("amount", True, float, "Amount to transfer"),
                    ActionParameter("token_address", False, str, "Optional token address")
                ],
                description="Send $S or tokens"
            ),
            "swap": Action(
                name="swap",
                parameters=[
                    ActionParameter("token_in", True, str, "Input token address"),
                    ActionParameter("token_out", True, str, "Output token address"),
                    ActionParameter("amount", True, float, "Amount to swap"),
                    ActionParameter("slippage", False, float, "Max slippage percentage")
                ],
                description="Swap tokens"
            ),
            "create-wallet": Action(
                name="create-wallet",
                parameters=[
                    ActionParameter("chain_type", False, str, "Blockchain type (default: ethereum)")
                ],
                description="Create a new wallet using Privy API"
            ),
            "register-wallet": Action(
                name="register-wallet",
                parameters=[
                    ActionParameter("wallet_data", True, dict, "Wallet data to register")
                ],
                description="Register a wallet created on the client side with Privy"
            )
        }

    def configure(self) -> bool:
        logger.info("\n🔷 SONIC CHAIN SETUP")
        if self.is_configured():
            logger.info("Sonic connection is already configured")
            response = input("Do you want to reconfigure? (y/n): ")
            if response.lower() != 'y':
                return True

        try:
            if not os.path.exists('.env'):
                with open('.env', 'w') as f:
                    f.write('')

            private_key = input("\nEnter your wallet private key: ")
            if not private_key.startswith('0x'):
                private_key = '0x' + private_key
            set_key('.env', 'SONIC_PRIVATE_KEY', private_key)
            
            # Configure Privy API credentials
            logger.info("\n🔷 PRIVY API SETUP (for wallet creation)")
            privy_app_id = input("\nEnter your Privy App ID (press Enter to skip): ")
            if privy_app_id:
                set_key('.env', 'PRIVY_APP_ID', privy_app_id)
                self.privy_app_id = privy_app_id
                
                privy_app_secret = input("\nEnter your Privy App Secret: ")
                set_key('.env', 'PRIVY_APP_SECRET', privy_app_secret)
                self.privy_app_secret = privy_app_secret
                logger.info("\n✅ Privy API credentials configured")
            else:
                logger.info("\n⚠️ Privy API setup skipped. Wallet creation will not be available.")

            if not self._web3.is_connected():
                raise SonicConnectionError("Failed to connect to Sonic network")

            account = self._web3.eth.account.from_key(private_key)
            logger.info(f"\n✅ Successfully connected with address: {account.address}")
            return True

        except Exception as e:
            logger.error(f"Configuration failed: {e}")
            return False

    def is_configured(self, verbose: bool = False) -> bool:
        try:
            load_dotenv()
            if not os.getenv('SONIC_PRIVATE_KEY'):
                if verbose:
                    logger.error("Missing SONIC_PRIVATE_KEY in .env")
                return False

            if not self._web3.is_connected():
                if verbose:
                    logger.error("Not connected to Sonic network")
                return False
                
            # Update Privy credentials from env if they exist
            privy_app_id = os.getenv('PRIVY_APP_ID')
            privy_app_secret = os.getenv('PRIVY_APP_SECRET')
            if privy_app_id and privy_app_secret:
                self.privy_app_id = privy_app_id
                self.privy_app_secret = privy_app_secret
                
            return True

        except Exception as e:
            if verbose:
                logger.error(f"Configuration check failed: {e}")
            return False

    def get_balance(self, address: Optional[str] = None, token_address: Optional[str] = None) -> float:
        """Get balance for an address or the configured wallet"""
        try:
            if not address:
                private_key = os.getenv('SONIC_PRIVATE_KEY')
                if not private_key:
                    raise SonicConnectionError("No wallet configured")
                account = self._web3.eth.account.from_key(private_key)
                address = account.address

            if token_address:
                contract = self._web3.eth.contract(
                    address=Web3.to_checksum_address(token_address),
                    abi=self.ERC20_ABI
                )
                balance = contract.functions.balanceOf(address).call()
                decimals = contract.functions.decimals().call()
                return balance / (10 ** decimals)
            else:
                balance = self._web3.eth.get_balance(address)
                return self._web3.from_wei(balance, 'ether')

        except Exception as e:
            logger.error(f"Failed to get balance: {e}")
            raise

    def transfer(self, to_address: str, amount: float, token_address: Optional[str] = None) -> str:
        """Transfer $S or tokens to an address"""
        try:
            private_key = os.getenv('SONIC_PRIVATE_KEY')
            account = self._web3.eth.account.from_key(private_key)
            chain_id = self._web3.eth.chain_id
            
            if token_address:
                contract = self._web3.eth.contract(
                    address=Web3.to_checksum_address(token_address),
                    abi=self.ERC20_ABI
                )
                decimals = contract.functions.decimals().call()
                amount_raw = int(amount * (10 ** decimals))
                
                tx = contract.functions.transfer(
                    Web3.to_checksum_address(to_address),
                    amount_raw
                ).build_transaction({
                    'from': account.address,
                    'nonce': self._web3.eth.get_transaction_count(account.address),
                    'gasPrice': self._web3.eth.gas_price,
                    'chainId': chain_id
                })
            else:
                tx = {
                    'nonce': self._web3.eth.get_transaction_count(account.address),
                    'to': Web3.to_checksum_address(to_address),
                    'value': self._web3.to_wei(amount, 'ether'),
                    'gas': 21000,
                    'gasPrice': self._web3.eth.gas_price,
                    'chainId': chain_id
                }

            signed = account.sign_transaction(tx)
            tx_hash = self._web3.eth.send_raw_transaction(signed.rawTransaction)

            # Log and return explorer link immediately
            tx_link = self._get_explorer_link(tx_hash.hex())
            return f"⛓️ Transfer transaction sent: {tx_link}"

        except Exception as e:
            logger.error(f"Transfer failed: {e}")
            raise

    def _get_swap_route(self, token_in: str, token_out: str, amount_in: float) -> Dict:
        """Get the best swap route from Kyberswap API"""
        try:
            # Handle native token address
            
            # Convert amount to raw value
            if token_in.lower() == self.NATIVE_TOKEN.lower():
                amount_raw = self._web3.to_wei(amount_in, 'ether')
            else:
                token_contract = self._web3.eth.contract(
                    address=Web3.to_checksum_address(token_in),
                    abi=self.ERC20_ABI
                )
                decimals = token_contract.functions.decimals().call()
                amount_raw = int(amount_in * (10 ** decimals))
            
            # Set up API request
            url = f"{self.aggregator_api}/routes"
            headers = {"x-client-id": "ZerePyBot"}
            params = {
                "tokenIn": token_in,
                "tokenOut": token_out,
                "amountIn": str(amount_raw),
                "gasInclude": "true"
            }
            
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            data = response.json()
            if data.get("code") != 0:
                raise SonicConnectionError(f"API error: {data.get('message')}")
                
            return data["data"]
                
        except Exception as e:
            logger.error(f"Failed to get swap route: {e}")
            raise

    def _get_encoded_swap_data(self, route_summary: Dict, slippage: float = 0.5) -> str:
        """Get encoded swap data from Kyberswap API"""
        try:
            private_key = os.getenv('SONIC_PRIVATE_KEY')
            account = self._web3.eth.account.from_key(private_key)
            
            url = f"{self.aggregator_api}/route/build"
            headers = {"x-client-id": "zerepy"}
            
            payload = {
                "routeSummary": route_summary,
                "sender": account.address,
                "recipient": account.address,
                "slippageTolerance": int(slippage * 100),  # Convert to bps
                "deadline": int(time.time() + 1200),  # 20 minutes
                "source": "ZerePyBot"
            }
            
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            
            data = response.json()
            if data.get("code") != 0:
                raise SonicConnectionError(f"API error: {data.get('message')}")
                
            return data["data"]["data"]
                
        except Exception as e:
            logger.error(f"Failed to encode swap data: {e}")
            raise
    
    def _handle_token_approval(self, token_address: str, spender_address: str, amount: int) -> None:
        """Handle token approval for spender"""
        try:
            private_key = os.getenv('SONIC_PRIVATE_KEY')
            account = self._web3.eth.account.from_key(private_key)
            
            token_contract = self._web3.eth.contract(
                address=Web3.to_checksum_address(token_address),
                abi=self.ERC20_ABI
            )
            
            # Check current allowance
            current_allowance = token_contract.functions.allowance(
                account.address,
                spender_address
            ).call()
            
            if current_allowance < amount:
                approve_tx = token_contract.functions.approve(
                    spender_address,
                    amount
                ).build_transaction({
                    'from': account.address,
                    'nonce': self._web3.eth.get_transaction_count(account.address),
                    'gasPrice': self._web3.eth.gas_price,
                    'chainId': self._web3.eth.chain_id
                })
                
                signed_approve = account.sign_transaction(approve_tx)
                tx_hash = self._web3.eth.send_raw_transaction(signed_approve.rawTransaction)
                logger.info(f"Approval transaction sent: {self._get_explorer_link(tx_hash.hex())}")
                
                # Wait for approval to be mined
                self._web3.eth.wait_for_transaction_receipt(tx_hash)
                
        except Exception as e:
            logger.error(f"Approval failed: {e}")
            raise

    def swap(self, token_in: str, token_out: str, amount: float, slippage: float = 0.5) -> str:
        """Execute a token swap using the KyberSwap router"""
        try:
            private_key = os.getenv('SONIC_PRIVATE_KEY')
            account = self._web3.eth.account.from_key(private_key)

            # Check token balance before proceeding
            current_balance = self.get_balance(
                address=account.address,
                token_address=None if token_in.lower() == self.NATIVE_TOKEN.lower() else token_in
            )
            
            if current_balance < amount:
                raise ValueError(f"Insufficient balance. Required: {amount}, Available: {current_balance}")
                
            # Get optimal swap route
            route_data = self._get_swap_route(token_in, token_out, amount)
            
            # Get encoded swap data
            encoded_data = self._get_encoded_swap_data(route_data["routeSummary"], slippage)
            
            # Get router address from route data
            router_address = route_data["routerAddress"]
            
            # Handle token approval if not using native token
            if token_in.lower() != self.NATIVE_TOKEN.lower():
                if token_in.lower() == "0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38".lower():  # $S token
                    amount_raw = self._web3.to_wei(amount, 'ether')
                else:
                    token_contract = self._web3.eth.contract(
                        address=Web3.to_checksum_address(token_in),
                        abi=self.ERC20_ABI
                    )
                    decimals = token_contract.functions.decimals().call()
                    amount_raw = int(amount * (10 ** decimals))
                self._handle_token_approval(token_in, router_address, amount_raw)
            
            # Prepare transaction
            tx = {
                'from': account.address,
                'to': Web3.to_checksum_address(router_address),
                'data': encoded_data,
                'nonce': self._web3.eth.get_transaction_count(account.address),
                'gasPrice': self._web3.eth.gas_price,
                'chainId': self._web3.eth.chain_id,
                'value': self._web3.to_wei(amount, 'ether') if token_in.lower() == self.NATIVE_TOKEN.lower() else 0
            }
            
            # Estimate gas
            try:
                tx['gas'] = self._web3.eth.estimate_gas(tx)
            except Exception as e:
                logger.warning(f"Gas estimation failed: {e}, using default gas limit")
                tx['gas'] = 500000  # Default gas limit
            
            # Sign and send transaction
            signed_tx = account.sign_transaction(tx)
            tx_hash = self._web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            # Log and return explorer link immediately
            tx_link = self._get_explorer_link(tx_hash.hex())
            return f"🔄 Swap transaction sent: {tx_link}"
                
        except Exception as e:
            logger.error(f"Swap failed: {e}")
            raise

    def create_wallet(self, chain_type: str = "ethereum") -> Dict[str, Any]:
        """
        Create a new wallet using the Privy API.
        
        Args:
            chain_type: The blockchain type (default: ethereum)
            
        Returns:
            Dict containing wallet details (id, address, chain_type, policy_ids)
        """
        try:
            # Check if Privy credentials are configured
            if not self.privy_app_id or not self.privy_app_secret:
                raise SonicConnectionError("Privy API credentials not configured. Set PRIVY_APP_ID and PRIVY_APP_SECRET in .env")
            
            # Use subprocess to run the Node.js script
            import subprocess
            import json
            import os
            
            # Get the absolute path to the script
            script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                                      "scripts", "create_wallet.js")
            
            # Run the script with the chain_type as an argument
            result = subprocess.run(["node", script_path, chain_type], 
                                   capture_output=True, text=True, check=True)
            
            # Parse the JSON output
            if result.stdout:
                try:
                    wallet_data = json.loads(result.stdout)
                    logger.info(f"Wallet created successfully: {wallet_data['address']}")
                    return wallet_data
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse wallet data: {result.stdout}")
                    raise SonicConnectionError(f"Failed to parse wallet data: {result.stdout}")
            elif result.stderr:
                try:
                    error_data = json.loads(result.stderr)
                    logger.error(f"Failed to create wallet: {error_data.get('error', 'Unknown error')}")
                    raise SonicConnectionError(f"Failed to create wallet: {error_data.get('error', 'Unknown error')}")
                except json.JSONDecodeError:
                    logger.error(f"Failed to create wallet: {result.stderr}")
                    raise SonicConnectionError(f"Failed to create wallet: {result.stderr}")
            else:
                raise SonicConnectionError("No response from wallet creation script")
                
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to execute wallet creation script: {e}")
            if e.stderr:
                logger.error(f"Script error: {e.stderr}")
            raise SonicConnectionError(f"Failed to execute wallet creation script: {e}")
        except Exception as e:
            logger.error(f"Wallet creation failed: {e}")
            raise SonicConnectionError(f"Wallet creation failed: {e}")

    def register_wallet(self, wallet_data):
        """
        Register a wallet created on the client side with Privy.
        This method stores the wallet information for future reference.
        
        Args:
            wallet_data (dict): The wallet data containing id, address, and chain_type
            
        Returns:
            dict: The registered wallet data
        """
        self.logger.info(f"Registering wallet: {wallet_data['address']} on {wallet_data['chain_type']}")
        
        # Here you could store the wallet in a database or other persistent storage
        # For now, we'll just log it and return the data
        
        # You could also add additional validation or processing here
        
        return wallet_data

    def perform_action(self, action_name: str, kwargs) -> Any:
        """Execute a Sonic action with validation"""
        load_dotenv()
        
        # Define available actions
        available_actions = [
            "create-wallet",
            "register-wallet",
            "get-balance",
            "transfer",
            "deploy-contract",
            "call-contract",
            "get-transaction",
            "get-receipt"
        ]
        
        # Check if action is valid
        if action_name not in available_actions:
            raise ValueError(f"Unknown action: {action_name}")
        
        # Special handling for wallet-related actions that don't require full configuration
        if action_name in ["create-wallet", "register-wallet"]:
            # For wallet creation/registration, we only need Privy credentials
            if action_name == "create-wallet":
                chain_type = kwargs[0] if isinstance(kwargs, list) and len(kwargs) > 0 else "ethereum"
                return self.create_wallet(chain_type)
            elif action_name == "register-wallet":
                wallet_data = kwargs[0] if isinstance(kwargs, list) and len(kwargs) > 0 else kwargs
                return self.register_wallet(wallet_data)
        
        # For other actions, check if the connection is properly configured
        if not self.is_configured():
            raise ValueError("Sonic connection is not properly configured")
        
        # Convert action name to method name (e.g., "get-balance" -> "get_balance")
        method_name = action_name.replace("-", "_")
        
        # Get the method from the class
        method = getattr(self, method_name)
        
        # Execute the method with the provided arguments
        if isinstance(kwargs, list):
            return method(*kwargs)
        else:
            return method(**kwargs)