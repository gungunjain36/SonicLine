# Twilio Integration for Sonic Line

This module provides integration with Twilio for making and receiving phone calls using the Sonic Line agent.

## Features

- Make outbound calls with custom messages
- Receive inbound calls and process speech with the agent
- Execute Sonic actions via voice commands
- Monitor calls and conversations in real-time through a web UI
- Maintain conversation history for each call

## Setup

The Twilio integration is pre-configured with the following credentials:

```
Account SID: ACd89bf3d967b1012f6f9965c1fad5556d
Auth Token: b85dd88e4db2c330dd6a8c7c98e956f2
Phone Number: +14149287603
```

### Setting Up Webhooks

To receive incoming calls, you need to configure your Twilio phone number to point to your server:

1. Log in to your Twilio account
2. Go to the Phone Numbers section
3. Click on your phone number
4. Under "Voice & Fax", set the webhook URL for incoming calls to:
   ```
   https://your-server-url/twilio/incoming-call
   ```
5. Set the webhook URL for call status changes to:
   ```
   https://your-server-url/twilio/call-status
   ```

## Usage

### Web UI for Call Monitoring

Access the call monitoring UI at:
```
https://your-server-url/twilio/ui
```

This UI allows you to:
- Make outbound calls
- View all active and past calls
- Monitor conversations in real-time
- See call status and duration

### Making Outbound Calls

You can make outbound calls through:

1. The web UI
2. The API endpoint:
```
POST /twilio/make-call
{
  "to_number": "+1234567890",
  "message": "Hello, this is a test call from Sonic Line."
}
```

### Voice Commands for Sonic Actions

The following voice commands are supported:

1. **Check Balance**
   - "What's my balance?"
   - "How much do I have in my wallet?"
   - "Show me my wallet"

2. **Check Token Price**
   - "What's the price of Sonic?"
   - "How much is Ethereum worth?"
   - "What's the value of Bitcoin?"

3. **Transaction History**
   - "Show me my transaction history"
   - "What are my recent transactions?"
   - "Show my activity"

4. **Create Wallet**
   - "Create a new wallet"
   - "Set up a wallet for me"
   - "I need a new wallet"

For security reasons, some actions like wallet creation will redirect you to the chat interface.

## API Endpoints

- `POST /twilio/incoming-call` - Handle incoming calls
- `POST /twilio/process-speech` - Process speech input
- `POST /twilio/call-status` - Handle call status updates
- `POST /twilio/make-call` - Make an outbound call
- `GET /twilio/calls` - Get all call logs
- `GET /twilio/call/{call_sid}` - Get details for a specific call
- `GET /twilio/ui` - Access the call monitoring UI

## Troubleshooting

- Check the server logs for errors
- Ensure your Twilio phone number is configured correctly
- Test with the web UI to verify the integration is working
- Make sure your server is accessible from the internet 