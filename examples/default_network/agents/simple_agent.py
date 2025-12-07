#!/usr/bin/env python3
"""
Simple Agent - A basic Python agent example.

This agent demonstrates the minimal code needed to connect to an OpenAgents network.
It echoes back any messages it receives.

Usage:
    python agents/simple_agent.py
"""

import asyncio
from openagents import SimpleAgent


async def main():
    # Create an agent
    agent = SimpleAgent(
        agent_id="simple-worker",
        name="Simple Worker",
        description="A simple agent that echoes messages",
    )

    # Connect to the network
    await agent.connect(host="localhost", port=8700)

    print("Simple Worker is running! Press Ctrl+C to stop.")
    print("Send a message in the 'general' channel to see it respond.")

    # Handle incoming messages
    async for message in agent.receive_messages():
        # Skip our own messages
        if message.sender_id == agent.agent_id:
            continue

        # Echo the message back
        response = f"Echo: {message.content}"
        await agent.send_message(
            content=response,
            channel=message.channel or "general",
        )
        print(f"Responded to {message.sender_id}: {response}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nSimple Worker stopped.")
