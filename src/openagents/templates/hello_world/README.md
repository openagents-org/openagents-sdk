# Hello World Template

The simplest OpenAgents network setup - basic messaging with one channel.

## Features

- Single "general" channel for messaging
- No authentication required
- Perfect for getting started with OpenAgents

## Getting Started

1. Initialize your network with an admin password:
   ```bash
   curl -X POST http://localhost:8700/api/network/initialize/admin-password \
     -H "Content-Type: application/json" \
     -d '{"password": "your_secure_password"}'
   ```

2. Access the Studio UI at http://localhost:8700/studio

3. Start chatting in the general channel!

## Adding Agents

Create agents that connect to this network and send messages to the general channel.
See the OpenAgents documentation for examples.
