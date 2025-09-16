"""
Network-level thread messaging mod for OpenAgents.

This standalone mod enables Reddit-like threading and direct messaging with:
- Direct messaging between agents
- Channel-based messaging with mentions
- 5-level nested threading (like Reddit)
- File upload/download with UUIDs
- Message quoting
"""

import logging
import os
import base64
import uuid
import tempfile
import time
from typing import Dict, Any, List, Optional, Set
from pathlib import Path

from openagents.core.base_mod import BaseMod
from openagents.models.messages import Event, EventNames
from openagents.models.event import Event
from openagents.models.event_response import EventResponse
from .thread_messages import (
    Event,
    ChannelMessage, 
    ReplyMessage,
    FileUploadMessage,
    FileOperationMessage,
    ChannelInfoMessage,
    MessageRetrievalMessage,
    ReactionMessage
)

logger = logging.getLogger(__name__)

class MessageThread:
    """Represents a conversation thread with Reddit-like nesting."""
    
    def __init__(self, root_message_id: str, root_message: Event):
        self.thread_id = str(uuid.uuid4())
        self.root_message_id = root_message_id
        self.root_message = root_message
        self.replies: Dict[str, List[Event]] = {}  # parent_id -> [replies]
        self.message_levels: Dict[str, int] = {root_message_id: 0}  # message_id -> level
        self.created_timestamp = root_message.timestamp
        
    def add_reply(self, reply: ReplyMessage) -> bool:
        """Add a reply to the thread."""
        parent_id = reply.reply_to_id
        
        # Check if parent exists and level is valid
        if parent_id not in self.message_levels:
            return False
            
        parent_level = self.message_levels[parent_id]
        if parent_level >= 4:  # Max 5 levels (0-4)
            return False
            
        # Add reply
        if parent_id not in self.replies:
            self.replies[parent_id] = []
        
        self.replies[parent_id].append(reply)
        self.message_levels[reply.event_id] = parent_level + 1
        reply.thread_level = parent_level + 1
        
        return True
    
    def get_thread_structure(self) -> Dict[str, Any]:
        """Get the complete thread structure."""
        def build_subtree(message_id: str) -> Dict[str, Any]:
            message = None
            if message_id == self.root_message_id:
                message = self.root_message
            else:
                # Find message in replies
                for replies in self.replies.values():
                    for reply in replies:
                        if reply.event_id == message_id:
                            message = reply
                            break
            
            subtree = {
                "message": message.model_dump() if message else None,
                "level": self.message_levels.get(message_id, 0),
                "replies": []
            }
            
            if message_id in self.replies:
                for reply in self.replies[message_id]:
                    subtree["replies"].append(build_subtree(reply.event_id))
            
            return subtree
        
        return build_subtree(self.root_message_id)

class ThreadMessagingNetworkMod(BaseMod):
    """Network-level thread messaging mod implementation.
    
    This standalone mod enables:
    - Direct messaging between agents
    - Channel-based messaging with mentions
    - Reddit-like threading (5 levels max)
    - File upload/download with UUIDs
    - Message quoting
    """
    
    def __init__(self, mod_name: str = "messaging"):
        """Initialize the thread messaging mod for a network."""
        super().__init__(mod_name=mod_name)
        
        # Register event handlers using the elegant pattern
        self.register_event_handler(self._handle_agent_message, "agent.message")
        
        # Register specific thread event handlers
        self.register_event_handler(self._handle_thread_reply, ["thread.reply.sent", "thread.reply.post"])
        self.register_event_handler(self._handle_thread_file_upload, ["thread.file.upload", "thread.file.upload_requested"])
        self.register_event_handler(self._handle_thread_file_operation, ["thread.file.download", "thread.file.operation"])
        self.register_event_handler(self._handle_thread_channels, ["thread.channels.info", "thread.channels.list"])
        self.register_event_handler(self._handle_thread_message_retrieval, ["thread.messages.retrieve", "thread.channel_messages.retrieve", "thread.direct_messages.retrieve"])
        self.register_event_handler(self._handle_thread_reactions, ["thread.reaction.add", "thread.reaction.remove", "thread.reaction.toggle"])
        self.register_event_handler(self._handle_thread_direct_message, ["thread.direct_message.send"])
        self.register_event_handler(self._handle_thread_channel_message, ["thread.channel_message.post"])
        
        # Initialize mod state
        self.active_agents: Set[str] = set()
        self.message_history: Dict[str, Event] = {}  # message_id -> message
        self.threads: Dict[str, MessageThread] = {}  # thread_id -> MessageThread
        self.message_to_thread: Dict[str, str] = {}  # message_id -> thread_id
        self.reactions: Dict[str, Dict[str, Set[str]]] = {}  # message_id -> {reaction_type -> set of agent_ids}
        self.max_history_size = 2000  # Number of messages to keep in history
        
        # Channel management - use EventGateway as single source of truth
        self.channels: Dict[str, Dict[str, Any]] = {}  # channel_name -> channel_info (metadata only)
        
        # File management
        self.files: Dict[str, Dict[str, Any]] = {}  # file_id -> file_info
        
        # Initialize default channels (will be created after network binding)
        
        # Create a temporary directory for file storage
        self.temp_dir = tempfile.TemporaryDirectory(prefix="openagents_threads_")
        self.file_storage_path = Path(self.temp_dir.name)
        
        logger.info(f"Initializing Thread Messaging network mod with file storage at {self.file_storage_path}")
    
    def _get_request_id(self, message) -> str:
        """Extract request_id from message, with fallback to message_id."""
        # Try to get request_id from message attribute (for MessageRetrievalMessage, ReactionMessage, etc.)
        if hasattr(message, 'request_id') and message.request_id:
            return message.request_id
        
        # Try to get request_id from message content/payload
        if hasattr(message, 'content') and isinstance(message.content, dict):
            request_id = message.content.get('request_id')
            if request_id:
                return request_id
        if hasattr(message, 'payload') and isinstance(message.payload, dict):
            request_id = message.payload.get('request_id')
            if request_id:
                return request_id
        
        # Fallback to event_id if available
        if hasattr(message, 'event_id') and message.event_id:
            return message.event_id
        
        # Final fallback to message_id if available
        if hasattr(message, 'message_id') and message.message_id:
            return message.message_id
            
        # Last resort: generate a unique ID
        import uuid
        return str(uuid.uuid4())
    
    def _initialize_default_channels(self) -> None:
        """Initialize default channels from configuration."""
        # Get channels from config or use default
        config_channels = self.config.get('default_channels', [
            {"name": "general", "description": "General discussion"},
            {"name": "development", "description": "Development discussions"},  
            {"name": "support", "description": "Support and help"}
        ])
        
        for channel_config in config_channels:
            if isinstance(channel_config, str):
                channel_name = channel_config
                description = f"Channel {channel_name}"
            else:
                channel_name = channel_config["name"]
                description = channel_config.get("description", f"Channel {channel_name}")
            
            # Store channel metadata locally
            self.channels[channel_name] = {
                'name': channel_name,
                'description': description,
                'created_timestamp': int(time.time() * 1000),
                'message_count': 0,
                'thread_count': 0
            }
            
            # Create channel in EventGateway (single source of truth for membership)
            self.network.event_gateway.create_channel(channel_name)
            logger.debug(f"Created channel {channel_name} in EventGateway during initialization")
        
        logger.info(f"Initialized channels: {list(self.channels.keys())}")
    
    def _create_channel(self, channel_name: str, description: str = "") -> None:
        """Create a new channel.
        
        Args:
            channel_name: Name of the channel to create
            description: Optional description for the channel
        """
        if channel_name not in self.channels:
            # Store channel metadata locally
            self.channels[channel_name] = {
                'name': channel_name,
                'description': description,
                'created_timestamp': int(time.time() * 1000),
                'message_count': 0,
                'thread_count': 0
            }
            
            # Create channel in EventGateway (single source of truth for membership)
            self.network.event_gateway.create_channel(channel_name)
            logger.info(f"Created channel: {channel_name}")
    
    def bind_network(self, network):
        """Bind the mod to a network and initialize channels."""
        super().bind_network(network)
        # Now that network is available, initialize default channels
        self._initialize_default_channels()
    
    def initialize(self) -> bool:
        """Initialize the mod.
        
        Returns:
            bool: True if initialization was successful, False otherwise
        """
        return True
    
    
    def shutdown(self) -> bool:
        """Shutdown the mod gracefully.
        
        Returns:
            bool: True if shutdown was successful, False otherwise
        """
        # Clear all state
        self.active_agents.clear()
        self.message_history.clear()
        self.threads.clear()
        self.message_to_thread.clear()
        self.reactions.clear()
        self.files.clear()
        
        # Remove all channels from EventGateway
        for channel_name in list(self.channels.keys()):
            self.network.event_gateway.remove_channel(channel_name)
        
        self.channels.clear()
        
        # Clean up the temporary directory
        try:
            self.temp_dir.cleanup()
            logger.info("Cleaned up temporary file storage directory")
        except Exception as e:
            logger.error(f"Error cleaning up temporary directory: {e}")
        
        return True
    
    async def handle_register_agent(self, agent_id: str, metadata: Dict[str, Any]) -> Optional[EventResponse]:
        """Register an agent with the thread messaging protocol.
        
        Args:
            agent_id: Unique identifier for the agent
            metadata: Agent metadata including capabilities
        """
        logger.info(f"🎯 THREAD MESSAGING MOD: Registering agent {agent_id}")
        logger.info(f"🎯 THREAD MESSAGING MOD: Agent metadata: {metadata}")
        
        self.active_agents.add(agent_id)
        
        # Add agent to all existing channels by default
        # This ensures Studio UI and all agents receive channel messages
        channels_before = len(self.channels)
        for channel_name in self.channels.keys():
            # Check if agent is already in channel using EventGateway
            channel_members = self.network.event_gateway.get_channel_members(channel_name)
            was_in_channel = agent_id in channel_members
            
            if not was_in_channel:
                # Add agent to channel in EventGateway (single source of truth)
                self.network.event_gateway.add_channel_member(channel_name, agent_id)
                logger.info(f"✅ AUTO-ADDED agent {agent_id} to channel '{channel_name}' (total agents: {len(self.network.event_gateway.get_channel_members(channel_name))})")
            else:
                logger.info(f"ℹ️  Agent {agent_id} already in channel '{channel_name}'")
        
        # If no channels exist yet, create general channel and add agent
        if channels_before == 0:
            logger.info(f"🏗️  Creating default 'general' channel for first agent {agent_id}")
            self._create_channel("general", "General discussion channel")
            self.network.event_gateway.add_channel_member("general", agent_id)
        
        # Create agent-specific file storage directory
        agent_storage_path = self.file_storage_path / agent_id
        os.makedirs(agent_storage_path, exist_ok=True)
        
        logger.info(f"🎉 THREAD MESSAGING MOD: Successfully registered agent {agent_id}")
        logger.info(f"📊 Total active agents: {len(self.active_agents)} -> {self.active_agents}")
        
        # Log detailed channel membership for debugging using EventGateway
        for ch_name in self.channels.keys():
            ch_members = self.network.event_gateway.get_channel_members(ch_name)
            logger.info(f"📺 Channel '{ch_name}': {len(ch_members)} agents -> {ch_members}")
        
        # Get agent's channels from EventGateway
        agent_channels = [ch for ch in self.channels.keys() if agent_id in self.network.event_gateway.get_channel_members(ch)]
        logger.info(f"🔗 Agent {agent_id} channels: {agent_channels}")
        
        return None  # Don't intercept the registration event
    
    async def handle_unregister_agent(self, agent_id: str) -> Optional[EventResponse]:
        """Unregister an agent from the thread messaging protocol.
        
        Args:
            agent_id: Unique identifier for the agent
        """
        if agent_id in self.active_agents:
            self.active_agents.remove(agent_id)
            
            # Remove from all channels in EventGateway
            for channel_name in self.channels.keys():
                channel_members = self.network.event_gateway.get_channel_members(channel_name)
                if agent_id in channel_members:
                    self.network.event_gateway.remove_channel_member(channel_name, agent_id)
            
            logger.info(f"Unregistered agent {agent_id} from Thread Messaging protocol")
        
        return None  # Don't intercept the unregistration event
    
    async def _handle_agent_message(self, event: Event) -> Optional[EventResponse]:
        """Handle agent message events (both direct and broadcast).
        
        Args:
            event: The agent message event to process
            
        Returns:
            Optional[EventResponse]: None to allow the event to continue processing, or EventResponse if intercepted
        """
        logger.debug(f"Thread messaging mod processing agent message from {event.source_id} to {event.destination_id}")
        
        # Add to history for potential retrieval
        self._add_to_history(event)
        
        # Check if this is a broadcast message (destination_id is "agent:broadcast")
        if event.destination_id == "agent:broadcast":
            # Handle broadcast message logic
            return await self._process_broadcast_event(event)
        else:
            # Handle direct message - thread messaging mod doesn't interfere with direct messages, let them continue
            return None
    
    
    def _prepare_thread_event_content(self, event: Event) -> Optional[Dict[str, Any]]:
        """Prepare and extract content from a thread event.
        
        Args:
            event: The thread event to process
            
        Returns:
            Optional[Dict[str, Any]]: Prepared content dictionary, or None if invalid
        """
        # Prevent infinite loops - don't process messages we generated
        if (self.network and event.source_id == self.network.network_id and 
            event.relevant_mod == "openagents.mods.workspace.messaging"):
            logger.debug("Skipping thread messaging response message to prevent infinite loop")
            return None
        
        # Extract the inner message from the Event content
        content = event.payload if hasattr(event, 'payload') else event.content
        
        # Ensure content is a dictionary
        if not isinstance(content, dict):
            content = {}
        else:
            content = content.copy()  # Don't modify the original
        
        # Set source_id from the event if not already present
        if 'source_id' not in content:
            content['source_id'] = event.source_id
        
        # Fix: Map sender_id to source_id for all message types that extend Event
        if 'sender_id' in content and 'source_id' not in content:
            content['source_id'] = content['sender_id']
        
        # Convert protobuf content to dict if needed
        if hasattr(content, 'fields'):
            logger.debug(f"Converting protobuf content to dict")
            content_dict = {}
            for field_name, field_value in content.fields.items():
                if hasattr(field_value, 'string_value'):
                    content_dict[field_name] = field_value.string_value
                elif hasattr(field_value, 'struct_value'):
                    # Handle nested struct (like content.text)
                    nested_dict = {}
                    for nested_name, nested_value in field_value.struct_value.fields.items():
                        if hasattr(nested_value, 'string_value'):
                            nested_dict[nested_name] = nested_value.string_value
                    content_dict[field_name] = nested_dict
                elif hasattr(field_value, 'number_value'):
                    content_dict[field_name] = field_value.number_value
                elif hasattr(field_value, 'bool_value'):
                    content_dict[field_name] = field_value.bool_value
                elif hasattr(field_value, 'null_value'):
                    content_dict[field_name] = None
                else:
                    # Try to get the value using WhichOneof
                    if hasattr(field_value, 'WhichOneof'):
                        which = field_value.WhichOneof('kind')
                        if which:
                            content_dict[field_name] = getattr(field_value, which)
                        else:
                            content_dict[field_name] = str(field_value)
                    else:
                        content_dict[field_name] = str(field_value)
            content = content_dict
            logger.debug(f"Converted protobuf content to dict: {content}")
            
            # Ensure source_id is set after protobuf conversion
            if 'source_id' not in content:
                content['source_id'] = event.source_id
        
        return content
    
    async def _handle_thread_reply(self, event: Event) -> Optional[EventResponse]:
        """Handle thread reply events.
        
        Args:
            event: The thread reply event to process
            
        Returns:
            Optional[EventResponse]: The response to the event
        """
        content = self._prepare_thread_event_content(event)
        if content is None:
            return None
        
        try:
            # Populate quoted_text if quoted_message_id is provided
            if 'quoted_message_id' in content and content['quoted_message_id']:
                content['quoted_text'] = self._get_quoted_text(content['quoted_message_id'])
            
            inner_message = ReplyMessage(**content)
            self._add_to_history(inner_message)
            await self._process_reply_message(inner_message)
            
            return EventResponse(
                success=True,
                message=f"Thread reply event {event.event_name} processed successfully",
                data={"event_name": event.event_name, "event_id": event.event_id}
            )
        except Exception as e:
            logger.error(f"Error processing thread reply event: {e}")
            return None
    
    async def _handle_thread_file_upload(self, event: Event) -> Optional[EventResponse]:
        """Handle thread file upload events.
        
        Args:
            event: The thread file upload event to process
            
        Returns:
            Optional[EventResponse]: The response to the event with file upload data
        """
        content = self._prepare_thread_event_content(event)
        if content is None:
            return None
        
        try:
            inner_message = FileUploadMessage(**content)
            self._add_to_history(inner_message)
            upload_data = await self._process_file_upload(inner_message)
            
            return EventResponse(
                success=True,
                message=f"Thread file upload event {event.event_name} processed successfully",
                data=upload_data
            )
        except Exception as e:
            logger.error(f"Error processing thread file upload event: {e}")
            return None
    
    async def _handle_thread_file_operation(self, event: Event) -> Optional[EventResponse]:
        """Handle thread file operation events.
        
        Args:
            event: The thread file operation event to process
            
        Returns:
            Optional[EventResponse]: The response to the event
        """
        content = self._prepare_thread_event_content(event)
        if content is None:
            return None
        
        try:
            inner_message = FileOperationMessage(**content)
            inner_message.event_name = event.event_name
            self._add_to_history(inner_message)
            operation_data = await self._process_file_operation(inner_message)
            
            return EventResponse(
                success=True,
                message=f"Thread file operation event {event.event_name} processed successfully",
                data=operation_data
            )
        except Exception as e:
            logger.error(f"Error processing thread file operation event: {e}")
            return None
    
    async def _handle_thread_channels(self, event: Event) -> Optional[EventResponse]:
        """Handle thread channel info events.
        
        Args:
            event: The thread channel info event to process
            
        Returns:
            Optional[EventResponse]: The response to the event with channel data
        """
        content = self._prepare_thread_event_content(event)
        if content is None:
            return None
        
        try:
            inner_message = ChannelInfoMessage(**content)
            inner_message.event_name = event.event_name
            self._add_to_history(inner_message)
            
            # Get the channel info data directly
            channel_data = self._process_channel_info_request(inner_message)
            
            return EventResponse(
                success=channel_data["success"],
                message=f"Channel info retrieved successfully" if channel_data["success"] else channel_data.get("error", "Unknown error"),
                data=channel_data
            )
        except Exception as e:
            logger.error(f"Error processing thread channel info event: {e}")
            return EventResponse(
                success=False,
                message=f"Error processing channel info request: {str(e)}",
                data={"error": str(e)}
            )
    
    async def _handle_thread_message_retrieval(self, event: Event) -> Optional[EventResponse]:
        """Handle thread message retrieval events.
        
        Args:
            event: The thread message retrieval event to process
            
        Returns:
            Optional[EventResponse]: The response to the event with message data
        """
        content = self._prepare_thread_event_content(event)
        if content is None:
            return None
        
        try:
            inner_message = MessageRetrievalMessage(**content)
            inner_message.event_name = event.event_name
            self._add_to_history(inner_message)
            
            # Get the message retrieval data directly
            retrieval_data = self._process_message_retrieval_request(inner_message)
            
            return EventResponse(
                success=retrieval_data["success"],
                message=f"Message retrieval completed successfully" if retrieval_data["success"] else retrieval_data.get("error", "Unknown error"),
                data=retrieval_data
            )
        except Exception as e:
            logger.error(f"Error processing thread message retrieval event: {e}")
            return EventResponse(
                success=False,
                message=f"Error processing message retrieval request: {str(e)}",
                data={"error": str(e)}
            )
    
    async def _handle_thread_reactions(self, event: Event) -> Optional[EventResponse]:
        """Handle thread reaction events.
        
        Args:
            event: The thread reaction event to process
            
        Returns:
            Optional[EventResponse]: The response to the event with reaction data
        """
        content = self._prepare_thread_event_content(event)
        if content is None:
            return None
        
        try:
            logger.debug(f"Creating ReactionMessage with content: {content}")
            inner_message = ReactionMessage(**content)
            inner_message.event_name = event.event_name
            self._add_to_history(inner_message)
            
            # Get the reaction data directly
            reaction_data = await self._process_reaction_message(inner_message)
            
            return EventResponse(
                success=reaction_data["success"],
                message=f"Reaction processed successfully" if reaction_data["success"] else reaction_data.get("error", "Unknown error"),
                data=reaction_data
            )
        except Exception as e:
            logger.error(f"Error processing thread reaction event: {e}")
            return EventResponse(
                success=False,
                message=f"Error processing reaction request: {str(e)}",
                data={"error": str(e)}
            )
    
    async def _handle_thread_direct_message(self, event: Event) -> Optional[EventResponse]:
        """Handle thread direct message events.
        
        Args:
            event: The thread direct message event to process
            
        Returns:
            Optional[EventResponse]: The response to the event
        """
        content = self._prepare_thread_event_content(event)
        if content is None:
            return None
        
        try:
            # Populate quoted_text if quoted_message_id is provided
            if 'quoted_message_id' in content and content['quoted_message_id']:
                content['quoted_text'] = self._get_quoted_text(content['quoted_message_id'])
            
            # Extract Event-specific fields from content
            event_fields = {}
            payload_fields = {}
            
            # Define which fields belong to the Event model vs payload
            event_field_names = {'event_name', 'source_id', 'destination_id', 'event_id', 'timestamp', 
                                'source_type', 'relevant_mod', 'requires_response', 'response_to', 
                                'metadata', 'text_representation', 'visibility', 'allowed_agents'}
            
            for key, value in content.items():
                if key in event_field_names:
                    event_fields[key] = value
                else:
                    payload_fields[key] = value
            
            # Create the Event with proper field separation
            inner_message = Event(
                event_name=event.event_name,
                payload=payload_fields,
                **event_fields
            )
            self._add_to_history(inner_message)
            await self._process_direct_message(inner_message)
            
            return EventResponse(
                success=True,
                message=f"Thread direct message event {event.event_name} processed successfully",
                data={"event_name": event.event_name, "event_id": event.event_id}
            )
        except Exception as e:
            logger.error(f"Error processing thread direct message event: {e}")
            return None
    
    async def _handle_thread_channel_message(self, event: Event) -> Optional[EventResponse]:
        """Handle thread channel message events.
        
        Args:
            event: The thread channel message event to process
            
        Returns:
            Optional[EventResponse]: The response to the event
        """
        content = self._prepare_thread_event_content(event)
        if content is None:
            return None
        
        try:
            # Populate quoted_text if quoted_message_id is provided
            if 'quoted_message_id' in content and content['quoted_message_id']:
                content['quoted_text'] = self._get_quoted_text(content['quoted_message_id'])
            
            inner_message = ChannelMessage(**content)
            self._add_to_history(inner_message)
            await self._process_channel_message(inner_message)
            
            return EventResponse(
                success=True,
                message=f"Thread channel message event {event.event_name} processed successfully",
                data={"event_name": event.event_name, "event_id": event.event_id}
            )
        except Exception as e:
            logger.error(f"Error processing thread channel message event: {e}")
            return None
    
    
    
    async def _process_broadcast_event(self, event: Event) -> Optional[EventResponse]:
        """Process a broadcast message event.
        
        Args:
            event: The broadcast message event to process
            
        Returns:
            Optional[EventResponse]: The response to the event, or None if the event is not processed
        """
        logger.debug(f"Thread messaging mod processing broadcast message from {event.source_id}")
        
        # Add to history for thread messaging
        self._add_to_history(event)
        
        # Check if this is a channel message that should be handled by thread messaging
        # For channel messages, the destination_id should be in format "channel:channelname"
        channel_name = None
        if event.destination_id and event.destination_id.startswith('channel:'):
            channel_name = event.destination_id.split(':', 1)[1]
        elif hasattr(event, 'payload') and event.payload and event.payload.get('channel'):
            channel_name = event.payload.get('channel')
            
        if channel_name:
            # This is a channel broadcast - thread messaging should handle it
            logger.debug(f"Thread messaging capturing channel broadcast to {channel_name}")
            
            # Convert to ChannelMessage and process it
            # Extract reply_to_id from payload if present
            reply_to_id = None
            if isinstance(event.payload, dict):
                reply_to_id = event.payload.get('reply_to_id')
            
            channel_message = ChannelMessage(
                sender_id=event.source_id,
                channel=channel_name,
                content=event.payload,
                timestamp=event.timestamp,
                message_id=event.event_id,
                reply_to_id=reply_to_id
            )
            
            await self._process_channel_message(channel_message)
            
            # Return response to stop further processing - thread messaging handled this
            return EventResponse(
                success=True,
                message=f"Channel message processed and distributed to channel {channel_name}",
                data={"channel": channel_name, "message_id": event.event_id}
            )
        
        # Check if this is a channel message based on payload
        if hasattr(event, 'payload') and event.payload:
            channel_name = event.payload.get('channel')
            if channel_name:
                logger.debug(f"Processing channel message for channel: {channel_name}")
                
                # Ensure channel exists
                if channel_name not in self.channels:
                    self._create_channel(channel_name)
                
                # Add message to channel history
                if channel_name not in self.channels:
                    self.channels[channel_name] = {'messages': []}
                if 'messages' not in self.channels[channel_name]:
                    self.channels[channel_name]['messages'] = []
                
                self.channels[channel_name]['messages'].append(event)
                
                # Limit channel history size
                if len(self.channels[channel_name]['messages']) > self.max_history_size:
                    self.channels[channel_name]['messages'] = self.channels[channel_name]['messages'][-self.max_history_size:]
                
                # Send notifications to channel members
                await self._send_channel_message_notifications(event, channel_name)
                
                # Intercept the message since we've handled channel distribution
                return EventResponse(
                    success=True,
                    message=f"Channel message processed and distributed to channel {channel_name}",
                    data={"channel": channel_name, "message_id": event.event_id}
                )
        
        # Not a channel message, let other mods process it
        return None
    
    
    async def _process_channel_message(self, message: ChannelMessage) -> None:
        """Process a channel message.
        
        Args:
            message: The channel message to process
        """
        self._add_to_history(message)
        
        # Track message in channel
        channel = message.channel
        if channel in self.channels:
            self.channels[channel]['message_count'] += 1
        else:
            # Auto-create channel and add all active agents to it
            logger.info(f"Auto-creating channel {channel} and adding all active agents")
            self._create_channel(channel, f"Auto-created channel {channel}")
            
            # Add all active agents to the new channel in EventGateway
            for agent_id in self.active_agents:
                self.network.event_gateway.add_channel_member(channel, agent_id)
                logger.info(f"Added agent {agent_id} to auto-created channel {channel}")
        
        logger.debug(f"Processing channel message from {message.source_id} in {channel}")
        
        # Broadcast the message to all other agents in the channel
        await self._broadcast_channel_message(message)
    
    async def _broadcast_channel_message(self, message: ChannelMessage) -> None:
        """Broadcast a channel message to all other agents in the channel.
        
        Args:
            message: The channel message to broadcast
        """
        channel = message.channel
        
        # Get all agents in the channel from EventGateway
        channel_members = self.network.event_gateway.get_channel_members(channel)
        channel_agents = set(channel_members)
        
        # Remove the sender from the notification list (they already know about their message)
        notify_agents = channel_agents - {message.source_id}
        
        logger.info(f"Channel {channel} has agents: {channel_agents}")
        logger.info(f"Message sender: {message.source_id}")
        logger.info(f"Agents to notify: {notify_agents}")
        
        if not notify_agents:
            logger.warning(f"No other agents to notify in channel {channel} - only sender {message.source_id} present")
            return
        
        logger.info(f"Broadcasting channel message to {len(notify_agents)} agents in {channel}: {notify_agents}")
        
        # Create a mod message to notify other agents about the new channel message
        for agent_id in notify_agents:
            logger.info(f"🔧 THREAD MESSAGING: Creating notification for agent: {agent_id}")
            notification = Event(
                event_name="thread.channel_message.notification",
                source_id=self.network.network_id,
                payload={
                    "message": message.model_dump(),
                    "channel": channel
                },
                direction="inbound",
                destination_id=agent_id
            )
            logger.info(f"🔧 THREAD MESSAGING: Notification target_id will be: {notification.destination_id}")
            logger.info(f"🔧 THREAD MESSAGING: Notification content: {notification.content}")
            
            try:
                await self.network.process_event(notification)
                logger.info(f"✅ THREAD MESSAGING: Sent channel message notification to agent {agent_id}")
            except Exception as e:
                logger.error(f"❌ THREAD MESSAGING: Failed to send channel message notification to {agent_id}: {e}")
                import traceback
                traceback.print_exc()
    
    async def _process_direct_message(self, message: Event) -> None:
        """Process a direct message.
        
        Args:
            message: The direct message to process
        """
        
        # Get target agent ID from the message
        target_agent_id = None
        if message.destination_id:
            target_agent_id = message.destination_id
        else:
            # Try to extract from nested content
            if hasattr(message, 'payload') and message.payload:
                if isinstance(message.payload, dict):
                    target_agent_id = message.payload.get('target_agent_id')
        
        if not target_agent_id:
            logger.warning(f"Direct message missing target_agent_id: {message}")
            return
            
        # Send notification to target agent
        logger.info(f"🔧 THREAD MESSAGING: Processing direct message from {message.source_id} to {target_agent_id}")
        
        try:
            from openagents.models.event import Event as EventModel
            
            # Create direct message notification
            notification = EventModel(
                event_name="thread.direct_message.notification",
                source_id=self.network.network_id,
                payload={
                    "message": message.model_dump() if hasattr(message, 'model_dump') else message.__dict__,
                    "sender_id": message.source_id
                },
                direction="inbound",
                destination_id=target_agent_id
            )
            
            await self.network.process_event(notification)
            logger.info(f"✅ THREAD MESSAGING: Sent direct message notification to agent {target_agent_id}")
            
        except Exception as e:
            logger.error(f"❌ THREAD MESSAGING: Failed to send direct message notification to {target_agent_id}: {e}")
            import traceback
            traceback.print_exc()
    
    async def _process_reply_message(self, message: ReplyMessage) -> None:
        """Process a reply message and manage thread creation/updates.
        
        Args:
            message: The reply message to process
        """
        reply_to_id = message.reply_to_id
        
        # Check if the original message exists
        if reply_to_id not in self.message_history:
            logger.warning(f"Cannot create reply: original message {reply_to_id} not found")
            return
        
        # Add the reply message to history
        self._add_to_history(message)
        
        original_message = self.message_history[reply_to_id]
        
        # Check if the original message is already part of a thread
        if reply_to_id in self.message_to_thread:
            # Add to existing thread
            thread_id = self.message_to_thread[reply_to_id]
            thread = self.threads[thread_id]
            if thread.add_reply(message):
                self.message_to_thread[message.event_id] = thread_id
                logger.debug(f"Added reply to existing thread {thread_id}")
            else:
                logger.warning(f"Could not add reply - max nesting level reached")
        else:
            # Create new thread with original message as root
            thread = MessageThread(reply_to_id, original_message)
            if thread.add_reply(message):
                self.threads[thread.thread_id] = thread
                self.message_to_thread[reply_to_id] = thread.thread_id
                self.message_to_thread[message.event_id] = thread.thread_id
                
                # Track thread in channel if applicable
                if hasattr(original_message, 'channel') and original_message.channel in self.channels:
                    self.channels[original_message.channel]['thread_count'] += 1
                
                logger.debug(f"Created new thread {thread.thread_id} for message {reply_to_id}")
            else:
                logger.warning(f"Could not create thread - max nesting level reached")
    
    async def _process_file_upload(self, message: FileUploadMessage) -> Dict[str, Any]:
        """Process a file upload request.
        
        Args:
            message: The file upload message
            
        Returns:
            Dict[str, Any]: File upload response data
        """
        file_id = str(uuid.uuid4())
        
        # Save file to storage
        file_path = self.file_storage_path / file_id
        
        try:
            # Decode and save file
            file_content = base64.b64decode(message.file_content)
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            # Store file metadata
            self.files[file_id] = {
                "file_id": file_id,
                "filename": message.filename,
                "mime_type": message.mime_type,
                "size": message.file_size,
                "uploaded_by": message.source_id,
                "upload_timestamp": message.timestamp,
                "path": str(file_path)
            }
            
            logger.info(f"File uploaded: {message.filename} -> {file_id}")
            
            # Return response data instead of sending event
            return {
                "success": True,
                "file_id": file_id,
                "filename": message.filename,
                "request_id": self._get_request_id(message)
            }
        
        except Exception as e:
            logger.error(f"File upload failed: {e}")
            # Return error response data instead of sending event
            return {
                "success": False,
                "error": str(e),
                "request_id": self._get_request_id(message)
            }
    
    async def _process_file_operation(self, message: FileOperationMessage) -> Dict[str, Any]:
        """Process file operations like download.
        
        Args:
            message: The file operation message
            
        Returns:
            Dict[str, Any]: File operation response data
        """
        # Try to determine action from event_name first, fallback to message.action
        action = getattr(message, 'action', 'download')
        
        # If we have the original event with the message, use its event_name to determine action
        if hasattr(message, 'event_name'):
            if "download" in message.event_name:
                action = "download"
            # Add other file operations as needed
        
        if action == "download":
            return await self._handle_file_download(message.source_id, message.file_id, message)
        else:
            return {
                "success": False,
                "error": f"Unknown file operation: {action}",
                "request_id": self._get_request_id(message)
            }
    
    async def _handle_file_download(self, agent_id: str, file_id: str, request_message: Event) -> Dict[str, Any]:
        """Handle a file download request.
        
        Args:
            agent_id: ID of the requesting agent
            file_id: UUID of the file to download
            request_message: The original request message
            
        Returns:
            Dict[str, Any]: File download response data
        """
        if file_id not in self.files:
            # File not found
            return {
                "success": False,
                "error": "File not found",
                "request_id": request_message.event_id
            }
        
        file_info = self.files[file_id]
        file_path = Path(file_info["path"])
        
        if not file_path.exists():
            # File deleted from storage
            return {
                "success": False,
                "error": "File no longer available",
                "request_id": request_message.event_id
            }
        
        try:
            # Read and encode file
            with open(file_path, "rb") as f:
                file_content = f.read()
            
            encoded_content = base64.b64encode(file_content).decode("utf-8")
            
            logger.debug(f"Sent file {file_id} to agent {agent_id}")
            
            # Return file content data
            return {
                "success": True,
                "file_id": file_id,
                "filename": file_info["filename"],
                "mime_type": file_info["mime_type"],
                "content": encoded_content,
                "request_id": request_message.event_id
            }
        
        except Exception as e:
            logger.error(f"File download failed: {e}")
            # Return error response data
            return {
                "success": False,
                "error": str(e),
                "request_id": request_message.event_id
            }
    
    def _process_channel_info_request(self, message: ChannelInfoMessage) -> Dict[str, Any]:
        """Process a channel info request and return the data.
        
        Args:
            message: The channel info request message
            
        Returns:
            Dict[str, Any]: The channel info response data
        """
        # Determine action from event_name if possible, fallback to message.action
        action = getattr(message, 'action', 'list_channels')
        
        # Use event_name to determine action
        if hasattr(message, 'event_name'):
            if "list" in message.event_name or "info" in message.event_name:
                action = "list_channels"
            # Add other channel actions as needed
            
        if action == "list_channels":
            channels_data = []
            for channel_name, channel_info in self.channels.items():
                agents_in_channel = self.network.event_gateway.get_channel_members(channel_name)
                channels_data.append({
                    'name': channel_name,
                    'description': channel_info['description'],
                    'message_count': channel_info['message_count'],
                    'thread_count': channel_info['thread_count'],
                    'agents': agents_in_channel,
                    'agent_count': len(agents_in_channel)
                })
            
            return {
                "success": True,
                "channels": channels_data,
                "request_id": self._get_request_id(message)
            }
        
        return {
            "success": False,
            "error": f"Unknown action: {action}",
            "request_id": self._get_request_id(message)
        }
    
    def _process_message_retrieval_request(self, message: MessageRetrievalMessage) -> Dict[str, Any]:
        """Process a message retrieval request and return the data.
        
        Args:
            message: The message retrieval request
            
        Returns:
            Dict[str, Any]: The message retrieval response data
        """
        # Determine action from event_name if possible, fallback to message.action
        action = getattr(message, 'action', 'retrieve_channel_messages')
        agent_id = message.source_id
        
        # Use event_name to determine action
        if hasattr(message, 'event_name'):
            if "channel_messages" in message.event_name:
                action = "retrieve_channel_messages"
            elif "direct_messages" in message.event_name:
                action = "retrieve_direct_messages"
            # Default to channel messages if just "messages.retrieve"
            elif "messages.retrieve" in message.event_name:
                action = "retrieve_channel_messages"
        
        if action == "retrieve_channel_messages":
            return self._handle_channel_messages_retrieval(message)
        elif action == "retrieve_direct_messages":
            return self._handle_direct_messages_retrieval(message)
        else:
            return {
                "action": "unknown_action",
                "success": False,
                "error": f"Unknown retrieval action: {action}",
                "request_id": self._get_request_id(message)
            }
    
    def _handle_channel_messages_retrieval(self, message: MessageRetrievalMessage) -> Dict[str, Any]:
        """Handle channel messages retrieval request and return the data.
        
        Args:
            message: The retrieval request message
            
        Returns:
            Dict[str, Any]: The channel messages retrieval response data
        """
        channel = message.channel
        agent_id = message.source_id
        limit = int(message.limit)
        offset = int(message.offset)
        include_threads = message.include_threads
        
        if not channel:
            return {
                "success": False,
                "error": "Channel name is required",
                "request_id": self._get_request_id(message)
            }
        
        if channel not in self.channels:
            return {
                "success": False,
                "error": f"Channel '{channel}' not found",
                "request_id": self._get_request_id(message)
            }
        
        # Find channel messages
        channel_messages = []
        for msg_id, msg in self.message_history.items():
            # Check if this is a channel message for the requested channel
            if isinstance(msg, ChannelMessage) and msg.channel == channel:
                msg_data = msg.model_dump()
                msg_data['thread_info'] = None
                
                # Add thread information if this message is part of a thread
                if include_threads and msg_id in self.message_to_thread:
                    thread_id = self.message_to_thread[msg_id]
                    thread = self.threads[thread_id]
                    msg_data['thread_info'] = {
                        'thread_id': thread_id,
                        'is_root': (msg_id == thread.root_message_id),
                        'thread_structure': thread.get_thread_structure() if include_threads else None
                    }
                
                # Add reactions to the message
                if msg_id in self.reactions:
                    msg_data['reactions'] = {}
                    for reaction_type, agents in self.reactions[msg_id].items():
                        if agents:  # Only include reactions with at least one agent
                            msg_data['reactions'][reaction_type] = len(agents)
                else:
                    msg_data['reactions'] = {}
                
                channel_messages.append(msg_data)
            
            # Also include replies if they're in this channel
            elif include_threads and isinstance(msg, ReplyMessage) and msg.channel == channel:
                msg_data = msg.model_dump()
                msg_data['thread_info'] = None
                
                if msg_id in self.message_to_thread:
                    thread_id = self.message_to_thread[msg_id]
                    msg_data['thread_info'] = {
                        'thread_id': thread_id,
                        'is_root': False,
                        'thread_level': msg.thread_level
                    }
                
                # Add reactions to the reply message
                if msg_id in self.reactions:
                    msg_data['reactions'] = {}
                    for reaction_type, agents in self.reactions[msg_id].items():
                        if agents:  # Only include reactions with at least one agent
                            msg_data['reactions'][reaction_type] = len(agents)
                else:
                    msg_data['reactions'] = {}
                
                channel_messages.append(msg_data)
        
        # Sort by timestamp (newest first)
        channel_messages.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
        
        # Apply pagination
        total_count = len(channel_messages)
        paginated_messages = channel_messages[offset:offset + limit]
        
        logger.debug(f"Retrieved {len(paginated_messages)} channel messages for {channel}")
        
        return {
            "success": True,
            "channel": channel,
            "messages": paginated_messages,
            "total_count": total_count,
            "offset": offset,
            "limit": limit,
            "has_more": (offset + limit) < total_count,
            "request_id": self._get_request_id(message)
        }
    
    def _handle_direct_messages_retrieval(self, message: MessageRetrievalMessage) -> Dict[str, Any]:
        """Handle direct messages retrieval request and return the data.
        
        Args:
            message: The retrieval request message
            
        Returns:
            Dict[str, Any]: The direct messages retrieval response data
        """
        target_agent_id = message.destination_id
        agent_id = message.source_id
        limit = int(message.limit)
        offset = int(message.offset)
        include_threads = message.include_threads
        
        if not target_agent_id:
            return {
                "success": False,
                "error": "Target agent ID is required",
                "request_id": self._get_request_id(message)
            }
        
        # Find direct messages between the two agents
        direct_messages = []
        for msg_id, msg in self.message_history.items():
            # Check if this is a direct message between the agents (check for target_agent_id field)
            has_target_agent = hasattr(msg, 'target_agent_id') and msg.destination_id
            is_direct_msg_between_agents = (
                has_target_agent and 
                ((msg.source_id == agent_id and msg.destination_id == target_agent_id) or
                 (msg.source_id == target_agent_id and msg.destination_id == agent_id))
            )
            
            if is_direct_msg_between_agents:
                msg_data = msg.model_dump()
                msg_data['thread_info'] = None
                
                # Add thread information if this message is part of a thread
                if include_threads and msg_id in self.message_to_thread:
                    thread_id = self.message_to_thread[msg_id]
                    thread = self.threads[thread_id]
                    msg_data['thread_info'] = {
                        'thread_id': thread_id,
                        'is_root': (msg_id == thread.root_message_id),
                        'thread_structure': thread.get_thread_structure() if include_threads else None
                    }
                
                # Add reactions to the direct message
                if msg_id in self.reactions:
                    msg_data['reactions'] = {}
                    for reaction_type, agents in self.reactions[msg_id].items():
                        if agents:  # Only include reactions with at least one agent
                            msg_data['reactions'][reaction_type] = len(agents)
                else:
                    msg_data['reactions'] = {}
                
                direct_messages.append(msg_data)
            
            # Also include replies if they're between these agents
            elif include_threads and isinstance(msg, ReplyMessage) and msg.destination_id:
                is_reply_between_agents = (
                    (msg.source_id == agent_id and msg.destination_id == target_agent_id) or
                    (msg.source_id == target_agent_id and msg.destination_id == agent_id)
                )
                
                if is_reply_between_agents:
                    msg_data = msg.model_dump()
                    msg_data['thread_info'] = None
                    
                    if msg_id in self.message_to_thread:
                        thread_id = self.message_to_thread[msg_id]
                        msg_data['thread_info'] = {
                            'thread_id': thread_id,
                            'is_root': False,
                            'thread_level': msg.thread_level
                        }
                    
                    # Add reactions to the reply message
                    if msg_id in self.reactions:
                        msg_data['reactions'] = {}
                        for reaction_type, agents in self.reactions[msg_id].items():
                            if agents:  # Only include reactions with at least one agent
                                msg_data['reactions'][reaction_type] = len(agents)
                    else:
                        msg_data['reactions'] = {}
                    
                    direct_messages.append(msg_data)
        
        # Sort by timestamp (newest first)
        direct_messages.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
        
        # Apply pagination
        total_count = len(direct_messages)
        paginated_messages = direct_messages[offset:offset + limit]
        
        logger.debug(f"Retrieved {len(paginated_messages)} direct messages with {target_agent_id}")
        
        return {
            "success": True,
            "target_agent_id": target_agent_id,
            "messages": paginated_messages,
            "total_count": total_count,
            "offset": offset,
            "limit": limit,
            "has_more": (offset + limit) < total_count,
            "request_id": self._get_request_id(message)
        }
    
    async def _process_reaction_message(self, message: ReactionMessage) -> Dict[str, Any]:
        """Process a reaction message.
        
        Args:
            message: The reaction message
        """
        target_message_id = message.target_message_id
        reaction_type = message.reaction_type
        agent_id = message.source_id
        
        # Determine action from event_name if possible, fallback to message.action
        action = getattr(message, 'action', 'add')
        
        # Use event_name to determine action
        if hasattr(message, 'event_name'):
            if "add" in message.event_name:
                action = "add"
            elif "remove" in message.event_name:
                action = "remove"
            elif "toggle" in message.event_name:
                # For toggle, we need to check if the reaction already exists
                if (target_message_id in self.reactions and 
                    reaction_type in self.reactions[target_message_id] and
                    agent_id in self.reactions[target_message_id][reaction_type]):
                    action = "remove"
                else:
                    action = "add"
        
        # Check if the target message exists
        if target_message_id not in self.message_history:
            logger.warning(f"Cannot react: target message {target_message_id} not found")
            return {
                "success": False,
                "error": f"Target message {target_message_id} not found",
                "target_message_id": target_message_id,
                "reaction_type": reaction_type,
                "request_id": self._get_request_id(message)
            }
        
        # Initialize reactions for the message if not exists
        if target_message_id not in self.reactions:
            self.reactions[target_message_id] = {}
        
        # Initialize reaction type if not exists
        if reaction_type not in self.reactions[target_message_id]:
            self.reactions[target_message_id][reaction_type] = set()
        
        success = False
        
        if action == "add":
            # Add reaction
            if agent_id not in self.reactions[target_message_id][reaction_type]:
                self.reactions[target_message_id][reaction_type].add(agent_id)
                success = True
                logger.debug(f"{agent_id} added {reaction_type} reaction to message {target_message_id}")
            else:
                logger.debug(f"{agent_id} already has {reaction_type} reaction on message {target_message_id}")
        
        elif action == "remove":
            # Remove reaction
            if agent_id in self.reactions[target_message_id][reaction_type]:
                self.reactions[target_message_id][reaction_type].discard(agent_id)
                success = True
                logger.debug(f"{agent_id} removed {reaction_type} reaction from message {target_message_id}")
                
                # Clean up empty reaction sets
                if not self.reactions[target_message_id][reaction_type]:
                    del self.reactions[target_message_id][reaction_type]
                
                # Clean up empty message reactions
                if not self.reactions[target_message_id]:
                    del self.reactions[target_message_id]
            else:
                logger.debug(f"{agent_id} doesn't have {reaction_type} reaction on message {target_message_id}")
        
        # Return response data
        reaction_response = {
            "success": success,
            "target_message_id": target_message_id,
            "reaction_type": reaction_type,
            "action_taken": action,
            "total_reactions": len(self.reactions.get(target_message_id, {}).get(reaction_type, set())),
            "request_id": self._get_request_id(message)
        }
        
        # Notify other agents about the reaction (broadcast to interested parties)
        # Note: We still send notifications to other agents since they need to know about reactions
        target_message = self.message_history[target_message_id]
        
        # Determine who should be notified based on the message type
        notify_agents = set()
        
        if isinstance(target_message, Event):
            # Notify both participants in the direct conversation
            notify_agents.add(target_message.source_id)
            notify_agents.add(target_message.destination_id)
        elif isinstance(target_message, ChannelMessage):
            # Notify agents in the channel
            channel_members = self.network.event_gateway.get_channel_members(target_message.channel)
            notify_agents.update(channel_members)
        elif isinstance(target_message, ReplyMessage):
            # Notify based on whether it's a channel or direct reply
            if target_message.channel:
                channel_members = self.network.event_gateway.get_channel_members(target_message.channel)
                notify_agents.update(channel_members)
            elif target_message.target_agent_id:
                notify_agents.add(target_message.source_id)
                notify_agents.add(target_message.target_agent_id)
        
        # Remove the reacting agent from notifications (they already know)
        notify_agents.discard(agent_id)
        
        # Send notification to relevant agents
        for notify_agent in notify_agents:
            notification = Event(
                event_name="thread.reaction.notification",
                source_id=self.network.network_id,
                destination_id=notify_agent,
                payload={
                    "target_message_id": target_message_id,
                    "reaction_type": reaction_type,
                    "reacting_agent": agent_id,
                    "action_taken": action,
                    "total_reactions": len(self.reactions.get(target_message_id, {}).get(reaction_type, set()))
                }
            )
            await self.network.process_event(notification)
        
        return reaction_response
    
    def get_state(self) -> Dict[str, Any]:
        """Get the current state of the Thread Messaging protocol.
        
        Returns:
            Dict[str, Any]: Current protocol state
        """
        # Count files in storage
        file_count = len(self.files)
        
        return {
            "active_agents": len(self.active_agents),
            "message_history_size": len(self.message_history),
            "thread_count": len(self.threads),
            "channel_count": len(self.channels),
            "channels": list(self.channels.keys()),
            "stored_files": file_count,
            "file_storage_path": str(self.file_storage_path)
        }
    
    def _add_to_history(self, message: Event) -> None:
        """Add a message to the history.
        
        Args:
            message: The message to add
        """
        self.message_history[message.event_id] = message
       
        # Trim history if it exceeds the maximum size
        if len(self.message_history) > self.max_history_size:
            # Remove oldest messages
            oldest_ids = sorted(
                self.message_history.keys(), 
                key=lambda k: self.message_history[k].timestamp
            )[:200]
            for old_id in oldest_ids:
                del self.message_history[old_id]
    
    def _get_quoted_text(self, quoted_message_id: str) -> str:
        """Get the text content of a quoted message with author information.
        
        Args:
            quoted_message_id: The ID of the message being quoted
            
        Returns:
            The text content of the quoted message with author, or a fallback string if not found
        """
        if quoted_message_id in self.message_history:
            quoted_message = self.message_history[quoted_message_id]
            if hasattr(quoted_message, 'content') and isinstance(quoted_message.content, dict):
                text = quoted_message.content.get('text', '')
                author = getattr(quoted_message, 'sender_id', 'Unknown')
                
                # Truncate long quotes
                if len(text) > 100:
                    text = f"{text[:100]}..."
                
                # Format: "Author: quoted text"
                return f"{author}: {text}"
            else:
                return "[Quoted message content unavailable]"
        else:
            return f"[Quoted message {quoted_message_id} not found]"