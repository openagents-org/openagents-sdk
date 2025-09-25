"""
Integration tests for real agent network communication.

This module contains tests for agent network integration functionality,
including real tool execution and message passing with proper network connections.
Requires OPENAI_API_KEY environment variable to be set.
"""

import os
import pytest
import asyncio
import aiohttp
from typing import Optional

from openagents.core.network import AgentNetwork
from openagents.models.agent_config import AgentConfig
from openagents.models.event_context import ChannelMessageContext
from openagents.models.event import Event
from openagents.agents.worker_agent import WorkerAgent
from openagents.models.network_config import TransportConfigItem
from openagents.models.transport import TransportType


class ToolCallTestAgent(WorkerAgent):
    """Test agent that responds to channel mentions."""

    async def on_channel_mention(self, context: ChannelMessageContext):
        await self.run_agent(context=context, instruction="reply to the message")


def create_test_context(agent_id: str, message: str) -> ChannelMessageContext:
    """Create a synthetic test context for channel message."""
    event = Event(
        event_id="test-event-123",
        event_name="thread.channel_message.notification",
        source_id="test-user",
        target_id=agent_id,
        payload={
            "channel": "general",
            "content": {
                "text": f"@{agent_id} {message}",
                "message_type": "text"
            },
            "mentioned_agent_id": agent_id
        }
    )
    return ChannelMessageContext(
        incoming_event=event,
        event_threads={},
        incoming_thread_id="test-event-123",  # Use same ID as event_id so reply_to_id is correct
        channel="general",
        mentioned_agent_id=agent_id
    )


@pytest.fixture
def agent_config():
    """Create agent config with OpenAI API key from environment."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        pytest.skip("OPENAI_API_KEY environment variable not set")

    return AgentConfig(
        instruction="You are a helpful assistant agent in the OpenAgents network. You can communicate with other agents and help users with various tasks. Be helpful, harmless, and honest in your responses.",
        model_name="gpt-4o-mini",
        provider="openai",
        api_base="https://api.openai.com/v1",
        api_key=api_key
    )


@pytest.fixture
async def test_network():
    """Create and initialize a test network."""
    network = AgentNetwork.load("examples/workspace_test.yaml")
    network.config.transports = [
        TransportConfigItem(type=TransportType.HTTP, config={"port": 35001}),
        TransportConfigItem(type=TransportType.GRPC, config={"port": 36001})
    ]
    await network.initialize()
    yield network
    await network.shutdown()


@pytest.fixture
async def test_agent(agent_config, test_network):
    """Create and start a test agent."""
    agent_id = f"test-agent-{int(asyncio.get_event_loop().time())}"
    agent = ToolCallTestAgent(
        agent_id=agent_id,
        agent_config=agent_config
    )
    await agent.async_start(host="localhost", port=35001)
    yield agent
    await agent.async_stop()


@pytest.mark.asyncio
@pytest.mark.integration
async def test_agent_channel_reply_integration(test_agent):
    """Test that agent can receive channel mention and reply successfully."""
    agent_id = test_agent.agent_id

    # Create test context and send channel mention
    context = create_test_context(agent_id, "Hello, how are you? Reply in one word.")
    await test_agent.on_channel_mention(context)

    # Give agent time to process and reply
    await asyncio.sleep(5)

    # Check that the reply was received by querying channel messages
    headers = {
        'Accept': '*/*',
        'Accept-Language': 'en,ja;q=0.9,en-US;q=0.8,zh-CN;q=0.7,zh;q=0.6,zh-TW;q=0.5,ko;q=0.4',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:35001',
        'Referer': 'http://localhost:35001/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    }

    data = {
        "event_id": "test-retrieve-123",
        "event_name": "thread.channel_messages.retrieve",
        "source_id": agent_id,
        "target_agent_id": "mod:openagents.mods.workspace.messaging",
        "payload": {
            "channel": "general",
            "limit": 50,
            "offset": 0,
            "include_threads": True
        },
        "metadata": {},
        "visibility": "network"
    }

    async with aiohttp.ClientSession() as session:
        async with session.post('http://localhost:35001/api/send_event', headers=headers, json=data) as response:
            assert response.status == 200
            response_data = await response.json()

            # Verify successful response
            assert response_data["success"] is True
            assert response_data["message"] == "Channel message retrieval completed successfully"

            # Verify agent reply was received
            data = response_data["data"]
            assert data["success"] is True
            assert data["channel"] == "general"
            assert data["total_count"] >= 1, "Agent's reply should be present in channel messages"

            # Verify the reply message structure
            messages = data["messages"]
            assert len(messages) >= 1, "At least one message should be present"

            # Find the agent's reply
            agent_reply = None
            for msg in messages:
                if msg["sender_id"] == agent_id and msg["message_type"] == "reply":
                    agent_reply = msg
                    break

            assert agent_reply is not None, "Agent's reply message should be found"
            assert agent_reply["channel"] == "general"
            assert agent_reply["reply_to_id"] == "test-event-123"
            assert agent_reply["thread_level"] == 1
            assert "content" in agent_reply
            assert "text" in agent_reply["content"]
            assert len(agent_reply["content"]["text"]) > 0, "Reply should have non-empty text content"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_agent_network_communication_timeout(test_agent):
    """Test that agent network communication completes within reasonable time."""
    import time

    agent_id = test_agent.agent_id
    start_time = time.time()

    # Create test context and send channel mention
    context = create_test_context(agent_id, "Say 'OK' to confirm you received this.")
    await test_agent.on_channel_mention(context)

    # Give agent time to process and reply
    await asyncio.sleep(5)

    # Verify the entire operation completed within timeout
    elapsed_time = time.time() - start_time
    assert elapsed_time < 30, f"Agent network communication took {elapsed_time:.2f}s, should be < 30s"

    # Also verify the reply was actually sent
    headers = {
        'Content-Type': 'application/json'
    }

    data = {
        "event_id": "test-timeout-123",
        "event_name": "thread.channel_messages.retrieve",
        "source_id": agent_id,
        "target_agent_id": "mod:openagents.mods.workspace.messaging",
        "payload": {
            "channel": "general",
            "limit": 10,
            "offset": 0,
            "include_threads": True
        },
        "metadata": {},
        "visibility": "network"
    }

    async with aiohttp.ClientSession() as session:
        async with session.post('http://localhost:35001/api/send_event', headers=headers, json=data) as response:
            response_data = await response.json()

            # Verify at least one message was sent (the agent's reply)
            assert response_data["data"]["total_count"] >= 1, "Agent should have sent a reply within the timeout period"