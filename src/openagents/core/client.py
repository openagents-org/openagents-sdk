import asyncio
from typing import TYPE_CHECKING, Dict, Any, List, Optional, Set, Type, Callable, Awaitable
import uuid
import logging

from openagents.models.detected_network_profile import DetectedNetworkProfile
from openagents.models.transport import TransportType
from openagents.utils.network_discovey import retrieve_network_details
from openagents.core.connector import NetworkConnector
from openagents.core.grpc_connector import GRPCNetworkConnector
from openagents.models.event import Event
from openagents.core.base_mod_adapter import BaseModAdapter
from openagents.models.messages import Event, EventNames
from openagents.core.system_commands import LIST_AGENTS, LIST_MODS, GET_MOD_MANIFEST
from openagents.models.tool import AgentAdapterTool
from openagents.models.message_thread import MessageThread
from openagents.utils.verbose import verbose_print
import aiohttp

logger = logging.getLogger(__name__)


class AgentClient:
    """Core client implementation for OpenAgents.
    
    A client that can connect to a network server and communicate with other agents.
    """
    
    def __init__(self, agent_id: Optional[str] = None, mod_adapters: Optional[List[BaseModAdapter]] = None):
        """Initialize an agent.
        
        Args:
            name: Optional human-readable name for the agent
            mod_adapters: Optional list of mod instances to register with the agent
        """
        self.agent_id = agent_id or "Agent-" + str(uuid.uuid4())[:8]
        self.mod_adapters: Dict[str, BaseModAdapter] = {}
        self.connector: Optional[NetworkConnector] = None
        
        # Message waiting infrastructure
        self._message_waiters: Dict[str, List[Dict[str, Any]]] = {
            "direct_message": [],
            "broadcast_message": [],
            "mod_message": []
        }

        # Register mod adapters if provided
        if mod_adapters:
            for mod_adapter in mod_adapters:
                self.register_mod_adapter(mod_adapter)
    
    def workspace(self):
        """Get the workspace for this agent."""
        from openagents.core.workspace import Workspace
        return Workspace(self)
    
    async def _detect_network_profile(self, host: str, port: int) -> Optional[DetectedNetworkProfile]:
        """Detect the network profile and recommended transport type by calling the health check endpoint.
        
        Args:
            host: Server host address
            port: Server port
            
        Returns:
            DetectedNetworkProfile: Network profile with detected information, or None if detection failed
        """
        # First try HTTP health check endpoint
        logger.debug(f"Attempting HTTP health check on {host}:{port}")
        
        async with aiohttp.ClientSession() as session:
            health_url = f"http://{host}:{port}/health"
            try:
                async with session.get(health_url, timeout=aiohttp.ClientTimeout(total=10.0)) as response:
                    if response.status == 200:
                        health_data = await response.json()
                        logger.info(f"✅ Successfully retrieved health check from {health_url}")
                        if "data" in health_data:
                            health_data = health_data["data"]
                        
                        # Create DetectedNetworkProfile from health check data
                        profile = DetectedNetworkProfile.from_network_stats(health_data)
                        
                        # Set detected transport information
                        profile.detected_host = host
                        profile.detected_port = port
                        profile.detected_transport = "http"
                        
                        return profile
                    else:
                        logger.debug(f"HTTP health check returned status {response.status}")
            except asyncio.TimeoutError:
                logger.debug(f"HTTP health check timeout on {health_url}")
            except Exception as http_e:
                logger.debug(f"HTTP health check failed on {health_url}: {http_e}")
            return None

    async def connect_to_server(self, host: Optional[str] = None, port: Optional[int] = None, network_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None, max_message_size: int = 104857600) -> bool:
        """Connect to a network server.
        
        Args:
            host: Server host address
            port: Server port
            network_id: ID of the network to connect to
            metadata: Metadata to send to the server
            max_message_size: Maximum WebSocket message size in bytes (default 10MB)
            
        Returns:
            bool: True if connection successful
        """
        # Validate connection parameters
        if network_id is None and (host is None or port is None):
            logger.error("Either network_id or both host and port must be provided to connect to a server")
            return False
        
        # If network_id is provided, retrieve network details to find out host and port
        if network_id and (not host or not port):
            network_details = retrieve_network_details(network_id)
            if not network_details:
                logger.error(f"Failed to retrieve network details for network_id: {network_id}")
                return False
            network_profile = network_details.get("network_profile", {})
            host = network_profile.get("host", host)
            port = network_profile.get("port", port)
            logger.info(f"Retrieved network details for network_id: {network_id}, host: {host}, port: {port}")

        if self.connector is not None:
            logger.info(f"Disconnecting from existing network connection for agent {self.agent_id}")
            await self.disconnect()
            self.connector = None
        
        # Detect transport type and create appropriate connector
        detected_profile = await self._detect_network_profile(host, port)
        
        if detected_profile is None:
            logger.error(f"Failed to detect network at {host}:{port}")
            return False
        
        transport_type = detected_profile.detected_transport
        actual_port = detected_profile.detected_port or port
        
        logger.info(f"Detected network: {detected_profile.network_name} ({detected_profile.network_id})")
        logger.info(f"Transport: {transport_type}, Port: {actual_port}")
        
        if transport_type == "grpc" or transport_type == "grpc_http":
            logger.info(f"Creating gRPC connector for agent {self.agent_id}")
            # Use the main gRPC port, not the HTTP adapter port
            main_port = port if transport_type == "grpc" else actual_port - 1000  # HTTP adapter is typically +1000 from main port
            self.connector = GRPCNetworkConnector(host, main_port, self.agent_id, metadata, max_message_size)
        else:
            logger.info(f"Creating WebSocket connector for agent {self.agent_id}")
            # TODO: change the network connector name to WebSocketNetworkConnector
            self.connector = NetworkConnector(host, actual_port, self.agent_id, metadata, max_message_size)

        # Connect using the connector
        success = await self.connector.connect_to_server()
        
        if success:
            # Call on_connect for each mod adapter
            for mod_adapter in self.mod_adapters.values():
                mod_adapter.bind_connector(self.connector)
                mod_adapter.on_connect()
            
            # Register message handlers
            self.connector.register_message_handler("direct_message", self._handle_direct_message)
            self.connector.register_message_handler("broadcast_message", self._handle_broadcast_message)
            self.connector.register_message_handler("mod_message", self._handle_mod_message)
            
            # Register system command handlers
            self.connector.register_system_handler("poll_messages", self._handle_poll_messages_response)
            
            # Start message polling for gRPC connectors (workaround for bidirectional messaging limitation)
            if hasattr(self.connector, 'poll_messages'):
                logger.info(f"🔧 Starting message polling for gRPC agent {self.agent_id}")
                asyncio.create_task(self._start_message_polling())
            
            # Register this client with the network for direct message delivery (if network is accessible)
            # This is a workaround for gRPC transport not supporting bidirectional messaging
            try:
                # Try to get network instance through connector
                if hasattr(self.connector, 'network_instance') or hasattr(self.connector, '_network_instance'):
                    network = getattr(self.connector, 'network_instance', None) or getattr(self.connector, '_network_instance', None)
                    if network and hasattr(network, '_register_agent_client'):
                        network._register_agent_client(self.agent_id, self)
                        logger.info(f"🔧 Registered agent client {self.agent_id} for direct message delivery")
            except Exception as e:
                logger.debug(f"Could not register agent client for direct delivery: {e}")
        
        return success

    async def connect(self, host: Optional[str] = None, port: Optional[int] = None, network_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None, max_message_size: int = 104857600) -> bool:
        """Connect to a network server (alias for connect_to_server).
        
        This is a cleaner alias for the connect_to_server method.
        
        Args:
            host: Server host address
            port: Server port  
            network_id: ID of the network to connect to
            metadata: Metadata to send to the server
            max_message_size: Maximum WebSocket message size in bytes (default 10MB)
            
        Returns:
            bool: True if connection successful
        """
        return await self.connect_to_server(host, port, network_id, metadata, max_message_size)
    
    async def disconnect(self) -> bool:
        """Disconnect from the network server."""
        for mod_adapter in self.mod_adapters.values():
            mod_adapter.on_disconnect()
        return await self.connector.disconnect()
    
    
    def register_mod_adapter(self, mod_adapter: BaseModAdapter) -> bool:
        """Register a mod with this agent.
        
        Args:
            mod_adapter: An instance of an agent mod adapter
            
        Returns:
            bool: True if registration was successful, False otherwise
        """
        class_name = mod_adapter.__class__.__name__
        module_name = getattr(mod_adapter, '_mod_name', None)
        
        if class_name in self.mod_adapters:
            logger.warning(f"Protocol {class_name} already registered with agent {self.agent_id}")
            return False
        
        # Bind the agent to the mod
        mod_adapter.bind_agent(self.agent_id)
        
        # Store adapter under class name (primary key)
        self.mod_adapters[class_name] = mod_adapter
        
        # Also store under module name for backward compatibility if available
        if module_name and module_name != class_name:
            self.mod_adapters[module_name] = mod_adapter
            
        # Also store under full module path if the adapter module is available
        module_path = getattr(mod_adapter.__class__, '__module__', None)
        if module_path and module_path not in self.mod_adapters:
            self.mod_adapters[module_path] = mod_adapter
            
            # Also store under parent module (e.g., "openagents.mods.communication.thread_messaging" 
            # for "openagents.mods.communication.thread_messaging.adapter")
            if '.' in module_path:
                parent_module = '.'.join(module_path.split('.')[:-1])
                if parent_module and parent_module not in self.mod_adapters:
                    self.mod_adapters[parent_module] = mod_adapter
        
        mod_adapter.initialize()
        if self.connector is not None:
            mod_adapter.bind_connector(self.connector)
            mod_adapter.on_connect()
        logger.info(f"Registered mod adapter {class_name} with agent {self.agent_id}")
        return True
    
    def unregister_mod_adapter(self, mod_name: str) -> bool:
        """Unregister a mod adapter from this agent.
        
        Args:
            mod_name: Name of the mod to unregister
            
        Returns:
            bool: True if unregistration was successful, False otherwise
        """
        if mod_name not in self.mod_adapters:
            logger.warning(f"Protocol adapter {mod_name} not registered with agent {self.agent_id}")
            return False
        
        mod_adapter = self.mod_adapters.pop(mod_name)
        mod_adapter.shutdown()
        logger.info(f"Unregistered mod adapter {mod_name} from agent {self.agent_id}")
        return True
    
    async def send_event(self, event: Event) -> EventResponse:
        """Send an event to the network."""
        return await self.connector.send_event(event)
    
    async def send_direct_message(self, message: Event) -> bool:
        """Send a direct message to another agent.
        
        Args:
            message: The message to send
            
        Returns:
            bool: True if message was sent successfully
        """
        print(f"🔄 AgentClient.send_direct_message called for agent {self.agent_id} to {message.destination_id}")
        print(f"   Available mod adapters: {list(self.mod_adapters.keys())}")
        print(f"   Connector: {self.connector}")
        print(f"   Connector is_connected: {getattr(self.connector, 'is_connected', 'N/A')}")
        verbose_print(f"🔄 AgentClient.send_direct_message called for message to {message.destination_id}")
        verbose_print(f"   Available mod adapters: {list(self.mod_adapters.keys())}")
        
        try:
            processed_message = message
            for mod_name, mod_adapter in self.mod_adapters.items():
                print(f"   Processing through {mod_name} adapter...")
                processed_message = await mod_adapter.process_outgoing_direct_message(message)
                print(f"   Result from {mod_name}: {'✅ message' if processed_message else '❌ None'}")
                verbose_print(f"   Processing through {mod_name} adapter...")
                verbose_print(f"   Result from {mod_name}: {'✅ message' if processed_message else '❌ None'}")
                if processed_message is None:
                    return False
            
            if processed_message is not None:
                print(f"🚀 Sending message via connector...")
                print(f"   Final processed message event_name: {processed_message.event_name}")
                print(f"   Final processed message target: {processed_message.destination_id}")
                verbose_print(f"🚀 Sending message via connector...")
                result = await self.connector.send_message(processed_message)
                print(f"✅ Message sent via connector - result: {result}")
                verbose_print(f"✅ Message sent via connector successfully")
                return result
            else:
                print(f"❌ Message was filtered out by mod adapters - not sending")
                verbose_print(f"❌ Message was filtered out by mod adapters - not sending")
                return False
        except Exception as e:
            print(f"❌ Connector failed to send message: {e}")
            print(f"Exception type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
            return False
    
    async def send_broadcast_message(self, message: Event) -> None:
        """Send a broadcast message to all agents.
        
        Args:
            message: The message to send
        """
        processed_message = message
        for mod_adapter in self.mod_adapters.values():
            processed_message = await mod_adapter.process_outgoing_broadcast_message(message)
            if processed_message is None:
                break
        if processed_message is not None:
            await self.connector.send_message(processed_message)
    
    async def send_mod_message(self, message: Event) -> bool:
        """Send a mod message to another agent.
        
        Args:
            message: The message to send
            
        Returns:
            bool: True if message was sent successfully
        """
        try:
            processed_message = message
            for mod_adapter in self.mod_adapters.values():
                processed_message = await mod_adapter.process_outgoing_mod_message(message)
                if processed_message is None:
                    return False
            if processed_message is not None:
                await self.connector.send_message(processed_message)
                return True
            return False
        except Exception:
            return False
    
    async def send_system_request(self, command: str, **kwargs) -> bool:
        """Send a system request to the network server.
        
        Args:
            command: The system command to send
            **kwargs: Additional parameters for the command
            
        Returns:
            bool: True if request was sent successfully
        """
        if self.connector is None:
            logger.warning(f"Agent {self.agent_id} is not connected to a network")
            return False
        
        return await self.connector.send_system_request(command, **kwargs)
    
    async def send_system_request_with_response(self, command: str, **kwargs) -> Optional[Dict[str, Any]]:
        """Send a system request and wait for immediate response.
        
        Args:
            command: The system command to send
            **kwargs: Additional parameters for the command
            
        Returns:
            Optional[Dict[str, Any]]: Response data if successful, None otherwise
        """
        if self.connector is None:
            logger.warning(f"Agent {self.agent_id} is not connected to a network")
            return None
        
        # Create system event
        from openagents.models.event import Event
        from openagents.config.globals import (
            SYSTEM_EVENT_LIST_AGENTS, SYSTEM_EVENT_LIST_MODS, SYSTEM_EVENT_GET_MOD_MANIFEST
        )
        
        # Map command to event name
        event_name_map = {
            LIST_AGENTS: SYSTEM_EVENT_LIST_AGENTS,
            LIST_MODS: SYSTEM_EVENT_LIST_MODS,
            GET_MOD_MANIFEST: SYSTEM_EVENT_GET_MOD_MANIFEST
        }
        
        event_name = event_name_map.get(command, f"system.{command}")
        
        # Add agent_id to kwargs
        kwargs['agent_id'] = self.agent_id
        
        system_event = Event(
            event_name=event_name,
            source_id=self.agent_id,
            destination_id="system:system",
            payload=kwargs
        )
        
        # For gRPC connector, we can get immediate response
        if hasattr(self.connector, 'stub'):  # gRPC connector
            # Create a future to capture the response
            response_future = asyncio.Future()
            original_handler = None
            
            # Create temporary handler to capture response
            async def temp_handler(data: Dict[str, Any]) -> None:
                if not response_future.done():
                    response_future.set_result(data)
            
            # Save original handler if exists
            if command in self.connector.system_handlers:
                original_handler = self.connector.system_handlers[command]
            
            # Register temporary handler
            self.connector.register_system_handler(command, temp_handler)
            
            try:
                # Send the message
                success = await self.connector.send_message(system_event)
                if not success:
                    return None
                
                # Wait for response with timeout
                try:
                    response_data = await asyncio.wait_for(response_future, timeout=10.0)
                    return response_data
                except asyncio.TimeoutError:
                    logger.error(f"Timeout waiting for {command} response")
                    return None
            finally:
                # Restore original handler
                if original_handler:
                    self.connector.register_system_handler(command, original_handler)
                else:
                    # Remove the temporary handler
                    if command in self.connector.system_handlers:
                        del self.connector.system_handlers[command]
        
        else:  # WebSocket connector - use existing callback approach
            # Create an event to signal when we have a response
            response_event = asyncio.Event()
            response_data = {}
            
            # Define a handler for the response
            async def handle_response(data: Dict[str, Any]) -> None:
                response_data.clear()
                response_data.update(data)
                response_event.set()
            
            # Save the original handler if it exists
            original_handler = None
            if command in self.connector.system_handlers:
                original_handler = self.connector.system_handlers[command]
            
            # Register the handler
            self.connector.register_system_handler(command, handle_response)
            
            try:
                # Send the request
                success = await self.connector.send_system_request(command, **kwargs)
                if not success:
                    logger.error(f"Failed to send {command} request")
                    return None
                
                # Wait for the response with a timeout
                try:
                    await asyncio.wait_for(response_event.wait(), timeout=10.0)
                    return response_data
                except asyncio.TimeoutError:
                    logger.error(f"Timeout waiting for {command} response")
                    return None
            finally:
                # Restore the original handler if there was one
                if original_handler:
                    self.connector.register_system_handler(command, original_handler)
    
    async def request_list_agents(self) -> bool:
        """Request a list of agents from the network server.
        
        Returns:
            bool: True if request was sent successfully
        """
        return await self.send_system_request(LIST_AGENTS)
    
    async def request_list_mods(self) -> bool:
        """Request a list of mods from the network server.
        
        Returns:
            bool: True if request was sent successfully
        """
        return await self.send_system_request(LIST_MODS)
    
    async def request_get_mod_manifest(self, mod_name: str) -> bool:
        """Request a mod manifest from the network server.
        
        Args:
            mod_name: Name of the mod to get the manifest for
            
        Returns:
            bool: True if request was sent successfully
        """
        return await self.send_system_request(GET_MOD_MANIFEST, mod_name=mod_name)
    
    async def list_mods(self) -> List[Dict[str, Any]]:
        """Get a list of available mods from the network server.
        
        This method sends a request to the server to list all available mods
        and returns the mod information.
        
        Returns:
            List[Dict[str, Any]]: List of mod information dictionaries
        """
        response_data = await self.send_system_request_with_response(LIST_MODS)
        if response_data and response_data.get("success"):
            return response_data.get("mods", [])
        else:
            error = response_data.get("error", "Unknown error") if response_data else "No response"
            logger.error(f"Failed to list mods: {error}")
            return []
    
    
    async def list_agents(self) -> List[Dict[str, Any]]:
        """Get a list of agents connected to the network.
        
        Returns:
            List[Dict[str, Any]]: List of agent information dictionaries
        """
        response_data = await self.send_system_request_with_response(LIST_AGENTS)
        if response_data and response_data.get("success"):
            return response_data.get("agents", [])
        else:
            error = response_data.get("error", "Unknown error") if response_data else "No response"
            logger.error(f"Failed to list agents: {error}")
            return []
    
    
    async def get_mod_manifest(self, mod_name: str) -> Optional[Dict[str, Any]]:
        """Get the manifest for a specific mod from the network server.
        
        Args:
            mod_name: Name of the mod to get the manifest for
            
        Returns:
            Optional[Dict[str, Any]]: Protocol manifest or None if not found
        """
        response_data = await self.send_system_request_with_response(GET_MOD_MANIFEST, mod_name=mod_name)
        if response_data and response_data.get("success"):
            return response_data.get("manifest", {})
        else:
            error = response_data.get("error", "Unknown error") if response_data else "No response"
            logger.error(f"Failed to get mod manifest for {mod_name}: {error}")
            return None

    def get_tools(self) -> List[AgentAdapterTool]:
        """Get all tools from registered mod adapters.
        
        Returns:
            List[AgentAdapterTool]: Combined list of tools from all mod adapters
        """
        tools = []
        
        # Collect tools from all registered mod adapters
        for mod_name, adapter in self.mod_adapters.items():
            try:
                adapter_tools = adapter.get_tools()
                if adapter_tools:
                    tools.extend(adapter_tools)
                    logger.debug(f"Added {len(adapter_tools)} tools from {mod_name}")
            except Exception as e:
                logger.error(f"Error getting tools from mod adapter {mod_name}: {e}")
        
        return tools
    
    def get_messsage_threads(self) -> Dict[str, MessageThread]:
        """Get all message threads from registered mod adapters.
        
        Returns:
            Dict[str, ConversationThread]: Dictionary of conversation threads
        """
        threads = {}
        
        # Collect conversation threads from all registered mod adapters
        print(f"🔧 CLIENT: get_messsage_threads called, found {len(self.mod_adapters)} adapters")
        for mod_name, adapter in self.mod_adapters.items():
            try:
                adapter_threads = adapter.message_threads
                print(f"🔧 CLIENT: Adapter {mod_name} has {len(adapter_threads) if adapter_threads else 0} threads")
                if adapter_threads:
                    # Merge the adapter's threads into our collection
                    for thread_id, thread in adapter_threads.items():
                        if thread_id in threads:
                            # If thread already exists, merge messages and sort by timestamp
                            existing_messages = threads[thread_id].messages
                            new_messages = thread.messages
                            # Combine messages from both threads
                            combined_messages = existing_messages + new_messages
                            # Create a new thread with the combined messages
                            merged_thread = MessageThread()
                            # Sort all messages by timestamp before adding them
                            sorted_messages = list(sorted(combined_messages, key=lambda msg: msg.timestamp))
                            merged_thread.messages = sorted_messages
                            threads[thread_id] = merged_thread
                        else:
                            threads[thread_id] = thread
                    logger.debug(f"Added {len(adapter_threads)} conversation threads from {mod_name}")
            except Exception as e:
                logger.error(f"Error getting message threads from mod adapter {mod_name}: {e}")
        
        return threads
    
    
    async def _handle_direct_message(self, message: Event) -> None:
        """Handle a direct message from another agent.
        
        Args:
            message: The message to handle
        """
        # Notify any waiting functions first
        await self._notify_message_waiters("direct_message", message)
        
        # Route message to appropriate protocol if available
        for mod_name, mod_adapter in self.mod_adapters.items():
            try:
                processed_message = await mod_adapter.process_incoming_direct_message(message)
                if processed_message is None:
                    break
            except Exception as e:
                logger.error(f"Error handling message in protocol {mod_adapter.__class__.__name__}: {e}")
                import traceback
                traceback.print_exc()
    
    async def _handle_broadcast_message(self, message: Event) -> None:
        """Handle a broadcast message from another agent.
        
        Args:
            message: The message to handle
        """
        # Notify any waiting functions first
        await self._notify_message_waiters("broadcast_message", message)
        
        for mod_adapter in self.mod_adapters.values():
            try:
                processed_message = await mod_adapter.process_incoming_broadcast_message(message)
                if processed_message is None:
                    break
            except Exception as e:
                logger.error(f"Error handling message in protocol {mod_adapter.__class__.__name__}: {e}")
    
    async def _handle_mod_message(self, message: Event) -> None:
        """Handle a protocol message from another agent.
        
        Args:
            message: The message to handle
        """
        print(f"🔧 CLIENT: Handling Event from {message.source_id}, mod={message.relevant_mod}, event={message.event_name}")
        print(f"🔧 CLIENT: Event payload keys: {list(message.payload.keys()) if message.payload else 'None'}")
        print(f"🔧 CLIENT: Agent ID: {self.agent_id}, Message target_agent_id: {message.destination_id}")
        logger.info(f"🔧 CLIENT: Handling Event from {message.source_id}, mod={message.relevant_mod}, event={message.event_name}")
        logger.info(f"🔧 CLIENT: Event payload keys: {list(message.payload.keys()) if message.payload else 'None'}")
        logger.info(f"🔧 CLIENT: Agent ID: {self.agent_id}, Message target_agent_id: {message.destination_id}")
        
        # Determine waiter type based on event name and notify waiters
        if "direct_message" in message.event_name:
            await self._notify_message_waiters("direct_message", message)
        elif "broadcast_message" in message.event_name:
            await self._notify_message_waiters("broadcast_message", message)
        else:
            await self._notify_message_waiters("mod_message", message)
        
        # Process through mod adapters first
        processed_by_adapter = False
        
        for mod_name, mod_adapter in self.mod_adapters.items():
            try:
                processed_message = await mod_adapter.process_incoming_mod_message(message)
                if processed_message is None:
                    processed_by_adapter = True
                    logger.debug(f"Mod adapter {mod_name} processed the message")
                    break
            except Exception as e:
                logger.error(f"Error handling message in protocol {mod_adapter.__class__.__name__}: {e}")
        
        # If no mod adapter processed the message, add it to message threads for agent processing
        if not processed_by_adapter:
            logger.debug(f"Event not processed by adapters, adding to message threads for agent processing")
            
            # Create a thread ID for the Event
            thread_id = f"mod_{message.relevant_mod}_{message.message_id[:8]}"
            
            # Try to add the message to any available mod adapter's message threads
            added_to_thread = False
            for mod_name, mod_adapter in self.mod_adapters.items():
                if hasattr(mod_adapter, 'message_threads') and mod_adapter.message_threads is not None:
                    if thread_id not in mod_adapter.message_threads:
                        from openagents.models.message_thread import MessageThread
                        mod_adapter.message_threads[thread_id] = MessageThread(thread_id=thread_id)
                    
                    # Add the Event to the thread
                    mod_adapter.message_threads[thread_id].add_message(message)
                    print(f"🔧 CLIENT: Added Event {message.event_name} to thread {thread_id} in {mod_name} adapter for agent processing")
                    logger.debug(f"Added Event to thread {thread_id} in {mod_name} adapter for agent processing")
                    added_to_thread = True
                    break
            
            if not added_to_thread:
                logger.warning("No mod adapter message_threads available to add Event")
    
    async def wait_direct_message(self, 
                                condition: Optional[Callable[[Event], bool]] = None,
                                timeout: float = 30.0) -> Optional[Event]:
        """Wait for a direct message that matches the given condition.
        
        Args:
            condition: Optional function to filter messages. If None, returns first message.
            timeout: Maximum time to wait in seconds
            
        Returns:
            Event if found within timeout, None otherwise
        """
        return await self._wait_for_message("direct_message", condition, timeout)
    
    async def wait_broadcast_message(self, 
                                   condition: Optional[Callable[[Event], bool]] = None,
                                   timeout: float = 30.0) -> Optional[Event]:
        """Wait for a broadcast message that matches the given condition.
        
        Args:
            condition: Optional function to filter messages. If None, returns first message.
            timeout: Maximum time to wait in seconds
            
        Returns:
            Event if found within timeout, None otherwise
        """
        return await self._wait_for_message("broadcast_message", condition, timeout)
    
    async def wait_mod_message(self, 
                             condition: Optional[Callable[[Event], bool]] = None,
                             timeout: float = 30.0) -> Optional[Event]:
        """Wait for a mod message that matches the given condition.
        
        Args:
            condition: Optional function to filter messages. If None, returns first message.
            timeout: Maximum time to wait in seconds
            
        Returns:
            Event if found within timeout, None otherwise
        """
        return await self._wait_for_message("mod_message", condition, timeout)
    
    async def _wait_for_message(self, message_type: str, condition: Optional[Callable] = None, timeout: float = 30.0) -> Optional[Event]:
        """Internal method to wait for a message of a specific type.
        
        Args:
            message_type: Type of message to wait for ("direct_message", "broadcast_message", "mod_message")
            condition: Optional function to filter messages
            timeout: Maximum time to wait in seconds
            
        Returns:
            Message if found within timeout, None otherwise
        """
        if self.connector is None:
            logger.warning(f"Agent {self.agent_id} is not connected to a network")
            return None
        
        # Create event and waiter entry
        message_event = asyncio.Event()
        result_message = {"message": None}
        
        waiter_entry = {
            "event": message_event,
            "condition": condition,
            "result": result_message
        }
        
        # Add to waiters list
        self._message_waiters[message_type].append(waiter_entry)
        
        try:
            # Wait for the message with timeout
            await asyncio.wait_for(message_event.wait(), timeout=timeout)
            return result_message["message"]
        except asyncio.TimeoutError:
            logger.debug(f"Timeout waiting for {message_type} (timeout: {timeout}s)")
            return None
        finally:
            # Clean up - remove waiter from list
            if waiter_entry in self._message_waiters[message_type]:
                self._message_waiters[message_type].remove(waiter_entry)
    
    async def _notify_message_waiters(self, message_type: str, message: Event) -> None:
        """Notify all waiters for a specific message type.
        
        Args:
            message_type: Type of message received
            message: The received message
        """
        if message_type not in self._message_waiters:
            return
        
        # Create a copy of the waiters list to avoid modification during iteration
        waiters_to_notify = []
        
        for waiter in self._message_waiters[message_type][:]:  # Create a copy
            condition = waiter["condition"]
            
            # Check if message matches condition
            if condition is None or condition(message):
                waiter["result"]["message"] = message
                waiters_to_notify.append(waiter)
                # Remove from waiters list since it's been satisfied
                self._message_waiters[message_type].remove(waiter)
        
        # Notify all matching waiters
        for waiter in waiters_to_notify:
            waiter["event"].set()
    
    async def _start_message_polling(self):
        """Start periodic polling for messages (gRPC workaround)."""
        logger.info(f"🔧 CLIENT: Starting message polling for agent {self.agent_id}")
        
        poll_count = 0
        while True:
            try:
                await asyncio.sleep(1.0)  # Poll every 1 second for faster message delivery
                poll_count += 1
                logger.debug(f"🔧 CLIENT: Polling attempt #{poll_count} for agent {self.agent_id}")
                
                if hasattr(self.connector, 'poll_messages') and self.connector.is_connected:
                    await self.connector.poll_messages()
                else:
                    logger.info(f"🔧 CLIENT: Stopping polling for agent {self.agent_id} - connector not available or disconnected")
                    break  # Stop polling if connector doesn't support it or is disconnected
                    
            except Exception as e:
                logger.error(f"🔧 CLIENT: Error in message polling for agent {self.agent_id}: {e}")
                await asyncio.sleep(5.0)  # Wait longer on error
    
    async def _handle_poll_messages_response(self, data) -> None:
        """Handle poll_messages system command response."""
        logger.info(f"🔧 CLIENT: Received poll_messages response for agent {self.agent_id} - data type: {type(data)}")
        logger.debug(f"🔧 CLIENT: Response data: {data}")
        
        # Handle both dict format (system_commands format) and list format (direct messages)
        messages = []
        if isinstance(data, list):
            # Direct list of messages from gRPC servicer
            messages = data
            logger.info(f"🔧 CLIENT: Received direct list of {len(messages)} messages")
        elif isinstance(data, dict):
            if data.get("success"):
                messages = data.get("messages", [])
                logger.info(f"🔧 CLIENT: Extracted {len(messages)} messages from success response")
                if len(messages) == 0:
                    logger.debug(f"🔧 CLIENT: Response data keys: {list(data.keys())}")
                    logger.debug(f"🔧 CLIENT: Messages field content: {data.get('messages', 'MISSING')}")
            elif "messages" in data:
                # Handle case where dict has messages directly without success field  
                messages = data.get("messages", [])
                logger.info(f"🔧 CLIENT: Extracted {len(messages)} messages from response dict")
            else:
                logger.warning(f"🔧 CLIENT: Poll messages response failed: {data.get('error', 'Unknown error')}")
                return
        else:
            logger.warning(f"🔧 CLIENT: Unexpected poll_messages response format: {type(data)} - {data}")
            return
        
        logger.info(f"🔧 CLIENT: Processing {len(messages)} polled messages")
        
        def safe_timestamp(ts_value):
            """Convert timestamp to float, handling both string and numeric formats."""
            if isinstance(ts_value, str):
                try:
                    # Try to parse as float first
                    return float(ts_value)
                except ValueError:
                    # If it's an ISO string, convert to timestamp
                    import datetime
                    try:
                        dt = datetime.datetime.fromisoformat(ts_value.replace('Z', '+00:00'))
                        return dt.timestamp()
                    except ValueError:
                        return 0.0
            elif isinstance(ts_value, (int, float)):
                return float(ts_value)
            else:
                return 0.0
        
        for message_data in messages:
            try:
                # Reconstruct the message object based on event_name
                event_name = message_data.get("event_name", "")
                message_type = message_data.get("message_type", "")
                
                logger.debug(f"🔧 CLIENT: Processing polled message - event_name: {event_name}, message_type: {message_type}")
                
                # Handle different types of polled messages
                if event_name == "thread.direct_message.notification":
                    # Handle thread direct message notification
                    payload = message_data.get("payload", {})
                    original_message = payload.get("message", {})
                    
                    # Reconstruct Event from thread notification
                    mod_message = Event(
                        event_name="thread.direct_message.notification",
                        source_id=message_data.get("source_id", ""),
                        destination_id=message_data.get("target_agent_id", ""),
                        payload=payload,
                        event_id=message_data.get("event_id", ""),
                        timestamp=safe_timestamp(message_data.get("timestamp", 0))
                    )
                    
                elif event_name == "thread.channel_message.notification":
                    # Handle thread channel message notification (includes replies)
                    payload = message_data.get("payload", {})
                    original_message = payload.get("message", {})
                    
                    # Reconstruct Event from thread notification
                    mod_message = Event(
                        event_name="thread.channel_message.notification",
                        source_id=message_data.get("source_id", ""),
                        destination_id=message_data.get("target_agent_id", ""),
                        payload=payload,
                        event_id=message_data.get("event_id", ""),
                        timestamp=safe_timestamp(message_data.get("timestamp", 0))
                    )
                elif event_name == "agent.direct_message.sent":
                    # Handle direct message from simple messaging
                    mod_message = Event(
                        event_name=event_name,
                        source_id=message_data.get("source_id", ""),
                        destination_id=message_data.get("target_agent_id", ""),
                        payload=message_data.get("payload", {}),
                        event_id=message_data.get("event_id", ""),
                        timestamp=safe_timestamp(message_data.get("timestamp", 0))
                    )
                elif event_name == "agent.broadcast_message.sent":
                    # Handle broadcast message from simple messaging
                    mod_message = Event(
                        event_name=event_name,
                        source_id=message_data.get("source_id", ""),
                        destination_id=message_data.get("target_agent_id", ""),
                        payload=message_data.get("payload", {}),
                        event_id=message_data.get("event_id", ""),
                        timestamp=safe_timestamp(message_data.get("timestamp", 0))
                    )
                elif message_type == "mod_message":
                    # Handle legacy mod message format
                    mod_message = Event(
                        event_name="mod.message.received",
                        source_id=message_data.get("sender_id", ""),
                        relevant_mod=message_data.get("mod", ""),
                        destination_id=message_data.get("relevant_agent_id", ""),
                        payload={
                            "action": message_data.get("action", ""),
                            **message_data.get("content", {})
                        },
                        event_id=message_data.get("message_id", ""),
                        timestamp=safe_timestamp(message_data.get("timestamp", 0))
                    )
                else:
                    # Handle generic messages by creating an Event and calling registered handlers
                    logger.debug(f"🔧 CLIENT: Handling generic message - event_name: {event_name}, message_type: {message_type}")
                    mod_message = Event(
                        event_name=event_name or message_type or "generic.message",
                        source_id=message_data.get("source_id", ""),
                        destination_id=message_data.get("target_agent_id", ""),
                        payload=message_data.get("payload", {}),
                        event_id=message_data.get("event_id", ""),
                        timestamp=safe_timestamp(message_data.get("timestamp", 0))
                    )
                    
                    # For generic messages, also try calling gRPC connector handlers
                    if hasattr(self.connector, 'message_handlers') and event_name in self.connector.message_handlers:
                        logger.info(f"🔧 CLIENT: Calling gRPC connector handler for {event_name}")
                        try:
                            for handler in self.connector.message_handlers[event_name]:
                                await handler(mod_message)
                        except Exception as e:
                            logger.error(f"Error calling gRPC connector handler: {e}")
                    
                # Process the reconstructed event
                logger.info(f"🔧 CLIENT: Processing polled Event: {mod_message.event_name}, payload keys: {list(mod_message.payload.keys()) if mod_message.payload else 'None'}")
                await self._handle_mod_message(mod_message)
                    
            except Exception as e:
                logger.error(f"Error processing polled message: {e}")
    