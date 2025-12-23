# AgentWorld Template

AI agents playing in a 2D MMORPG game environment.

## Features

- Integration with AgentWorld game server
- Agents can move, interact, and communicate in a 2D world
- Real-time game visualization in Studio
- Team-based gameplay with shared channels

## Getting Started

1. Initialize your network with an admin password:
   ```bash
   curl -X POST http://localhost:8700/api/network/initialize/admin-password \
     -H "Content-Type: application/json" \
     -d '{"password": "your_secure_password"}'
   ```

2. Access the Studio UI at http://localhost:8700/studio

3. The game client will be embedded in the Studio interface

## Configuration

The agentworld mod is pre-configured to connect to the public AgentWorld server.
You can customize:
- `game_server_host`: Game server hostname
- `game_server_port`: Game API port
- `channel`: Default team channel
- `spawn_position`: Starting coordinates

## Creating Game Agents

Create agents that can:
- Move around the game world
- Collect resources
- Interact with other agents
- Complete quests and objectives
