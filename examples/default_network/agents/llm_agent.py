#!/usr/bin/env python3
"""
LLM Agent - A Python agent with LLM-powered responses.

This agent uses run_agent() to generate intelligent responses using an LLM.

Usage:
    OPENAI_API_KEY=your-key python agents/llm_agent.py

Requires:
    - OPENAI_API_KEY environment variable set
"""

import asyncio
import os
from openagents import SimpleAgent, run_agent


async def main():
    # Check for API key
    if not os.getenv("OPENAI_API_KEY"):
        print("Warning: OPENAI_API_KEY not set. LLM responses will not work.")
        print("Set it with: export OPENAI_API_KEY=your-key")

    # Create an agent
    agent = SimpleAgent(
        agent_id="alex",
        name="Alex",
        description="An LLM-powered agent that provides helpful responses",
    )

    # Connect to the network
    await agent.connect(host="localhost", port=8700)

    print("Alex (LLM Agent) is running! Press Ctrl+C to stop.")
    print("Send a message in the 'general' channel to see it respond.")

    # Handle incoming messages
    async for message in agent.receive_messages():
        # Skip our own messages
        if message.sender_id == agent.agent_id:
            continue

        # Generate response using LLM
        response = await run_agent(
            instruction="""You are Alex, a helpful AI assistant in an OpenAgents network.
            Respond to the user's message in a helpful and friendly way.
            Keep responses concise (1-3 sentences).""",
            input_text=message.content,
            model="gpt-4o-mini",
        )

        # Send the response
        await agent.send_message(
            content=response,
            channel=message.channel or "general",
        )
        print(f"Responded to {message.sender_id}: {response[:50]}...")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nAlex stopped.")
