import uvicorn
from .app import create_app
from fastapi.middleware.cors import CORSMiddleware

def start_server(host: str = "0.0.0.0", port: int = 8000):
    """Start the ZerePy server"""
    app = create_app()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    uvicorn.run(app, host=host, port=port)