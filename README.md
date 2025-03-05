# SonicLine with Privy Wallet Integration

SonicLine is an AI-driven chat application that now includes wallet creation functionality using Privy's embedded wallet solution.

## Features

- AI-powered chat interface
- Instant wallet creation with a simple chat message - no login required
- Client-side wallet creation using Privy
- Secure and user-friendly wallet management
- Modern and responsive UI

## Setup Instructions

### Prerequisites

- Node.js (v16+)
- Python (v3.8+)
- Privy App ID (get one from [Privy Dashboard](https://console.privy.io/))

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Configure the Sonic connection:
   ```
   python -m src.cli configure
   ```
   Follow the prompts to set up your Sonic private key and optionally your Privy API credentials.

5. Start the backend server:
   ```
   python -m src.server.app
   ```

### Frontend Setup

1. Navigate to the web app directory:
   ```
   cd web/app
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the `web/app` directory with your Privy App ID:
   ```
   VITE_PRIVY_APP_ID=your-privy-app-id
   ```

4. Start the development server:
   ```
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

## Using Wallet Creation

Creating a wallet in SonicLine is incredibly simple:

1. **Just Chat**: Simply type "create a wallet for me" (or similar phrases) in the chat, and the AI will instantly create a wallet for you - no login or authentication required!
2. **Direct Button**: Alternatively, click on the "Create Wallet" button in either the home page or chat interface

When you request a wallet through chat, the application will:
1. Create a new embedded wallet directly in the chat
2. Display the wallet address and other details in the conversation
3. Copy the wallet address to your clipboard for convenience

## Architecture

- **Backend**: Python FastAPI server that handles AI chat functionality and recognizes wallet creation requests
- **Frontend**: React application with Privy integration for wallet management
- **Wallet Creation**: Client-side wallet creation using Privy's React SDK with no authentication barriers
- **Natural Language Processing**: The backend can recognize wallet creation requests in natural language and trigger the wallet creation process directly in the chat

## Security Considerations

- Wallet private keys are never exposed to the backend
- All wallet operations happen client-side for maximum security
- No sensitive wallet data is stored on the server
- Wallets are created instantly without requiring user authentication

## Troubleshooting

- If you encounter issues with wallet creation, ensure your Privy App ID is correctly set in the `.env` file
- For backend connection issues, verify that your Sonic private key is properly configured
- Check browser console for any frontend errors
- If the chat-based wallet creation doesn't work, try using the direct button instead

## License

[MIT License](LICENSE) 