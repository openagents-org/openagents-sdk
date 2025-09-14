"""
Basic gRPC client communication test.

This test verifies that two real gRPC clients can:
1. Connect to the network using workspace_test.yaml
2. Send raw events to each other
3. Observe messages being received

No mocks - uses real gRPC clients and network infrastructure.
"""

import pytest
import asyncio
import random
from pathlib import Path

from openagents.core.client import AgentClient
from openagents.core.network import create_network
from openagents.launchers.network_launcher import load_network_config
from openagents.models.event import Event
from openagents.models.network_config import NetworkMode
from openagents.core.topology import NetworkMode as TopologyNetworkMode


@pytest.fixture
async def test_network():
    """Create and start a network using workspace_test.yaml config."""
    config_path = Path(__file__).parent.parent.parent / "examples" / "workspace_test.yaml"
    
    # Load config and use random port to avoid conflicts
    config = load_network_config(str(config_path))
    config.network.port = random.randint(47000, 48000)
    
    # Create and initialize network
    network = create_network(config.network)
    await network.initialize()
    
    # Give network time to start up
    await asyncio.sleep(1.0)
    
    yield network, config
    
    # Cleanup
    try:
        await network.shutdown()
    except Exception as e:
        print(f"Error during network shutdown: {e}")


@pytest.fixture
async def grpc_client_a(test_network):
    """Create first gRPC client."""
    network, config = test_network
    
    client = AgentClient(agent_id="client-a")
    await client.connect(config.network.host, config.network.port)
    
    # Give client time to connect
    await asyncio.sleep(1.0)
    
    yield client
    
    # Cleanup
    try:
        await client.disconnect()
    except Exception as e:
        print(f"Error disconnecting client-a: {e}")


@pytest.fixture  
async def grpc_client_b(test_network):
    """Create second gRPC client."""
    network, config = test_network
    
    client = AgentClient(agent_id="client-b")
    await client.connect(config.network.host, config.network.port)
    
    # Give client time to connect
    await asyncio.sleep(1.0)
    
    yield client
    
    # Cleanup
    try:
        await client.disconnect()
    except Exception as e:
        print(f"Error disconnecting client-b: {e}")


@pytest.mark.asyncio
async def test_basic_grpc_event_communication(grpc_client_a, grpc_client_b):
    """Test that one gRPC client can send an event to another and it's received."""
    
    print("🔍 Testing basic gRPC client event communication...")
    
    # Create a simple event
    test_event = Event(
        event_name="test.message",
        source_id="client-a", 
        destination_id="client-b",
        payload={"text": "Hello from client A!", "test_id": "basic_comm_test"},
        event_id="test-event-001"
    )
    
    # Clear any existing received messages
    client_b_messages = []
    
    # Set up message handler for client B to capture received events
    async def message_handler(event):
        print(f"📨 Client B received event: {event.event_name} from {event.source_id}")
        print(f"   Payload: {event.payload}")
        client_b_messages.append(event)
    
    # Register the handler (if client supports it)
    if hasattr(grpc_client_b.connector, 'register_message_handler'):
        grpc_client_b.connector.register_message_handler("test.message", message_handler)
    
    print("✅ Clients connected, sending event...")
    
    # Client A sends event to Client B
    print(f"🔧 DEBUG: About to call send_message with event: {test_event.event_name}")
    try:
        success = await grpc_client_a.connector.send_message(test_event)
        print(f"📤 Send result: {success}")
        assert success, "Client A should be able to send event"
    except Exception as e:
        print(f"❌ ERROR during send_message: {e}")
        raise
    
    # Wait for message processing and polling
    print("⏳ Waiting for message processing...")
    
    # Give time for message routing and polling
    for i in range(10):  # Wait up to 10 seconds
        await asyncio.sleep(1.0)
        
        # Force polling if supported
        if hasattr(grpc_client_b.connector, 'poll_messages'):
            await grpc_client_b.connector.poll_messages()
            
        # Check if we received the message
        if client_b_messages:
            break
        
        print(f"   Checking after {i+1} seconds...")
    
    # Verify client B received the event
    print(f"📥 Client B received {len(client_b_messages)} messages")
    
    for msg in client_b_messages:
        print(f"   Message: {msg.event_name} from {msg.source_id}")
        print(f"   Payload: {msg.payload}")
    
    # Find our test message
    test_messages = [
        msg for msg in client_b_messages 
        if (msg.source_id == "client-a" and 
            msg.payload and 
            msg.payload.get("test_id") == "basic_comm_test")
    ]
    
    assert len(test_messages) >= 1, f"Client B should have received test message. Got {len(client_b_messages)} total messages"
    
    received_event = test_messages[0]
    assert received_event.event_name == "test.message"
    assert received_event.source_id == "client-a"
    assert received_event.target_agent_id == "client-b"
    assert received_event.payload["text"] == "Hello from client A!"
    assert received_event.payload["test_id"] == "basic_comm_test"
    
    print("✅ Basic gRPC event communication test PASSED")
    print(f"   Client A successfully sent event to Client B")
    print(f"   Message received with correct content: {received_event.payload['text']}")


@pytest.mark.asyncio
async def test_bidirectional_grpc_communication(grpc_client_a, grpc_client_b):
    """Test bidirectional communication between two gRPC clients."""
    
    print("🔍 Testing bidirectional gRPC communication...")
    
    # Track received messages for both clients
    client_a_messages = []
    client_b_messages = []
    
    # Set up message handlers
    async def handler_a(event):
        print(f"📨 Client A received: {event.event_name} from {event.source_id}")
        client_a_messages.append(event)
        
    async def handler_b(event):
        print(f"📨 Client B received: {event.event_name} from {event.source_id}")
        client_b_messages.append(event)
    
    # Register handlers if supported
    if hasattr(grpc_client_a.connector, 'register_message_handler'):
        grpc_client_a.connector.register_message_handler("bidirectional.test", handler_a)
    if hasattr(grpc_client_b.connector, 'register_message_handler'):
        grpc_client_b.connector.register_message_handler("bidirectional.test", handler_b)
    
    # Client A sends to Client B
    event_a_to_b = Event(
        event_name="bidirectional.test",
        source_id="client-a",
        destination_id="client-b", 
        payload={"text": "A to B message", "direction": "a_to_b"},
        event_id="bidir-001"
    )
    
    # Client B sends to Client A
    event_b_to_a = Event(
        event_name="bidirectional.test",
        source_id="client-b",
        destination_id="client-a",
        payload={"text": "B to A message", "direction": "b_to_a"},
        event_id="bidir-002"
    )
    
    # Send both messages
    success_a = await grpc_client_a.connector.send_message(event_a_to_b)
    success_b = await grpc_client_b.connector.send_message(event_b_to_a)
    
    print(f"📤 Client A send result: {success_a}")
    print(f"📤 Client B send result: {success_b}")
    
    assert success_a and success_b, "Both clients should be able to send events"
    
    # Wait for message processing
    print("⏳ Waiting for bidirectional message processing...")
    
    for i in range(10):
        await asyncio.sleep(1.0)
        
        # Poll both clients
        if hasattr(grpc_client_a.connector, 'poll_messages'):
            await grpc_client_a.connector.poll_messages()
        if hasattr(grpc_client_b.connector, 'poll_messages'):
            await grpc_client_b.connector.poll_messages()
        
        # Check if both received messages
        a_received = any(msg.payload.get("direction") == "b_to_a" for msg in client_a_messages)
        b_received = any(msg.payload.get("direction") == "a_to_b" for msg in client_b_messages)
        
        if a_received and b_received:
            break
            
        print(f"   After {i+1}s: A received {len(client_a_messages)}, B received {len(client_b_messages)}")
    
    # Verify both directions worked
    a_received_from_b = [msg for msg in client_a_messages if msg.source_id == "client-b"]
    b_received_from_a = [msg for msg in client_b_messages if msg.source_id == "client-a"]
    
    assert len(a_received_from_b) >= 1, "Client A should receive message from Client B"
    assert len(b_received_from_a) >= 1, "Client B should receive message from Client A"
    
    print("✅ Bidirectional gRPC communication test PASSED")
    print(f"   Client A received {len(a_received_from_b)} messages from B")
    print(f"   Client B received {len(b_received_from_a)} messages from A")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])