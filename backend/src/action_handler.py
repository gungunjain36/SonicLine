import logging
from typing import Dict, Any

logger = logging.getLogger("action_handler")

action_registry = {}    

def register_action(action_name):
    def decorator(func):
        action_registry[action_name] = func
        return func
    return decorator

def execute_action(agent, action_name, **kwargs):
    if action_name in action_registry:
       return action_registry[action_name](agent, **kwargs)
    else:
        logger.error(f"Action {action_name} not found")
        return None

def register_actions_from_module(module_name: str, actions_dict: Dict[str, Any]):
    """
    Register actions from a module's actions dictionary
    
    Args:
        module_name: The name of the module (for logging)
        actions_dict: Dictionary mapping action names to handler functions
    """
    for action_name, handler_func in actions_dict.items():
        action_registry[action_name] = handler_func
        logger.info(f"Registered action '{action_name}' from module '{module_name}'")

# Import and register other actions as needed
# Example:
# try:
#     from src.actions.some_module import ACTIONS
#     register_actions_from_module("some_module", ACTIONS)
# except ImportError:
#     logger.warning("Could not import some_module actions")

