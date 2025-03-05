import logging
import os
from dotenv import load_dotenv
from src.action_handler import register_action

logger = logging.getLogger("actions.sonic_actions")

# Note: These action handlers are currently simple passthroughs to the sonic_connection methods.
# They serve as hook points where hackathon participants can add custom logic, validation,
# or additional processing before/after calling the underlying connection methods.
# Feel free to modify these handlers to add your own business logic!

@register_action("get-token-by-ticker")
def get_token_by_ticker(agent, **kwargs):
    """Get token address by ticker symbol
    """
    try:
        ticker = kwargs.get("ticker")
        if not ticker:
            logger.error("No ticker provided")
            return None
            
        # Direct passthrough to connection method - add your logic before/after this call!
        return agent.connection_manager.connections["sonic"].get_token_by_ticker(ticker)

    except Exception as e:
        logger.error(f"Failed to get token by ticker: {str(e)}")
        return None

@register_action("get-sonic-balance")
def get_sonic_balance(agent, **kwargs):
    """Get $S or token balance.
    """
    try:
        address = kwargs.get("address")
        token_address = kwargs.get("token_address")
        
        if not address:
            load_dotenv()
            private_key = os.getenv('SONIC_PRIVATE_KEY')
            web3 = agent.connection_manager.connections["sonic"]._web3
            account = web3.eth.account.from_key(private_key)
            address = account.address

        # Direct passthrough to connection method - add your logic before/after this call!
        return agent.connection_manager.connections["sonic"].get_balance(
            address=address,
            token_address=token_address
        )

    except Exception as e:
        logger.error(f"Failed to get balance: {str(e)}")
        return None

@register_action("send-sonic")
def send_sonic(agent, **kwargs):
    """Send $S tokens to an address.
    This is a passthrough to sonic_connection.transfer().
    Add your custom logic here if needed!
    """
    try:
        to_address = kwargs.get("to_address")
        amount = float(kwargs.get("amount"))

        # Direct passthrough to connection method - add your logic before/after this call!
        return agent.connection_manager.connections["sonic"].transfer(
            to_address=to_address,
            amount=amount
        )

    except Exception as e:
        logger.error(f"Failed to send $S: {str(e)}")
        return None

@register_action("send-sonic-token")
def send_sonic_token(agent, **kwargs):
    """Send a token on Sonic to an address.
    This is a passthrough to sonic_connection.transfer().
    Add your custom logic here if needed!
    """
    try:
        to_address = kwargs.get("to_address")
        amount = float(kwargs.get("amount"))
        token_address = kwargs.get("token_address")

        # Direct passthrough to connection method - add your logic before/after this call!
        return agent.connection_manager.connections["sonic"].transfer(
            to_address=to_address,
            amount=amount,
            token_address=token_address
        )

    except Exception as e:
        logger.error(f"Failed to send token: {str(e)}")
        return None

@register_action("swap-sonic")
def swap_sonic(agent, **kwargs):
    """Swap tokens on Sonic DEX.
    This is a passthrough to sonic_connection.swap().
    Add your custom logic here if needed!
    """
    try:
        token_in = kwargs.get("token_in")
        token_out = kwargs.get("token_out") 
        amount = float(kwargs.get("amount"))
        slippage = float(kwargs.get("slippage", 0.5))

        # Direct passthrough to connection method - add your logic before/after this call!
        return agent.connection_manager.connections["sonic"].swap(
            token_in=token_in,
            token_out=token_out,
            amount=amount,
            slippage=slippage
        )

    except Exception as e:
        logger.error(f"Failed to swap tokens: {str(e)}")
        return None

@register_action("get-token-price")
def get_token_price(agent, **kwargs):
    """Get current price of a token in USD or another base currency.
    """
    try:
        token_address = kwargs.get("token_address")
        base_currency = kwargs.get("base_currency", "USD")
        
        if not token_address:
            logger.error("No token address provided")
            return None
            
        # Direct passthrough to connection method - add your logic before/after this call!
        return agent.connection_manager.connections["sonic"].get_token_price(
            token_address=token_address,
            base_currency=base_currency
        )

    except Exception as e:
        logger.error(f"Failed to get token price: {str(e)}")
        return None

@register_action("get-transaction-history")
def get_transaction_history(agent, **kwargs):
    """Get transaction history for an address.
    """
    try:
        address = kwargs.get("address")
        limit = int(kwargs.get("limit", 10))
        
        if not address:
            load_dotenv()
            private_key = os.getenv('SONIC_PRIVATE_KEY')
            web3 = agent.connection_manager.connections["sonic"]._web3
            account = web3.eth.account.from_key(private_key)
            address = account.address
            
        # Direct passthrough to connection method - add your logic before/after this call!
        return agent.connection_manager.connections["sonic"].get_transaction_history(
            address=address,
            limit=limit
        )

    except Exception as e:
        logger.error(f"Failed to get transaction history: {str(e)}")
        return None

@register_action("add-liquidity")
def add_liquidity(agent, **kwargs):
    """Add liquidity to a pool on Sonic.
    """
    try:
        token_a = kwargs.get("token_a")
        token_b = kwargs.get("token_b")
        amount_a = float(kwargs.get("amount_a"))
        amount_b = float(kwargs.get("amount_b", 0))  # Optional, can be calculated
        
        # Direct passthrough to connection method - add your logic before/after this call!
        return agent.connection_manager.connections["sonic"].add_liquidity(
            token_a=token_a,
            token_b=token_b,
            amount_a=amount_a,
            amount_b=amount_b
        )

    except Exception as e:
        logger.error(f"Failed to add liquidity: {str(e)}")
        return None

@register_action("remove-liquidity")
def remove_liquidity(agent, **kwargs):
    """Remove liquidity from a pool on Sonic.
    """
    try:
        token_a = kwargs.get("token_a")
        token_b = kwargs.get("token_b")
        lp_amount = float(kwargs.get("lp_amount"))
        
        # Direct passthrough to connection method - add your logic before/after this call!
        return agent.connection_manager.connections["sonic"].remove_liquidity(
            token_a=token_a,
            token_b=token_b,
            lp_amount=lp_amount
        )

    except Exception as e:
        logger.error(f"Failed to remove liquidity: {str(e)}")
        return None

@register_action("get-pool-info")
def get_pool_info(agent, **kwargs):
    """Get information about a liquidity pool.
    """
    try:
        token_a = kwargs.get("token_a")
        token_b = kwargs.get("token_b")
        
        # Direct passthrough to connection method - add your logic before/after this call!
        return agent.connection_manager.connections["sonic"].get_pool_info(
            token_a=token_a,
            token_b=token_b
        )

    except Exception as e:
        logger.error(f"Failed to get pool info: {str(e)}")
        return None

@register_action("estimate-swap")
def estimate_swap(agent, **kwargs):
    """Estimate the output amount for a token swap without executing it.
    """
    try:
        token_in = kwargs.get("token_in")
        token_out = kwargs.get("token_out")
        amount = float(kwargs.get("amount"))
        
        # Direct passthrough to connection method - add your logic before/after this call!
        return agent.connection_manager.connections["sonic"].estimate_swap(
            token_in=token_in,
            token_out=token_out,
            amount=amount
        )

    except Exception as e:
        logger.error(f"Failed to estimate swap: {str(e)}")
        return None
    
@register_action("create-wallet")
def create_wallet(agent, **kwargs):
    """Create a wallet, using the Privy API, returning the wallet address and private key."""
    try:
        # Direct passthrough to connection method - add your logic before/after this call!
        return agent.connection_manager.connections["sonic"].create_wallet()
    except Exception as e:
        logger.error(f"Failed to create wallet: {str(e)}")
        return None

@register_action_handler("sonic", "create-wallet")
def create_sonic_wallet(agent, **kwargs):
    """Create a new Sonic wallet"""
    try:
        chain_type = kwargs.get("chain_type", "ethereum")
        return agent.connection_manager.connections["sonic"].create_wallet(chain_type)
    except Exception as e:
        logging.error(f"Failed to create wallet: {e}")
        return None

@register_action_handler("sonic", "mint-nft")
def mint_sonic_nft(agent, **kwargs):
    """Mint a new NFT on Sonic with the given metadata URI"""
    try:
        uri = kwargs.get("uri")
        if not uri:
            logging.error("No URI provided for NFT minting")
            return None
        
        # Call the mint_nft method on the Sonic connection
        result = agent.connection_manager.connections["sonic"].mint_nft(uri)
        return result
    except Exception as e:
        logging.error(f"Failed to mint NFT: {e}")
        return None