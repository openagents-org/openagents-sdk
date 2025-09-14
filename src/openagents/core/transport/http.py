"""
gRPC Transport Implementation for OpenAgents.

This module provides the gRPC transport implementation and servicer for agent communication.
"""

import json
import logging
import re
from typing import Dict, Any, Optional

import grpc
from grpc import aio
from openagents.config.globals import SYSTEM_EVENT_REGISTER_AGENT
from openagents.proto import agent_service_pb2_grpc, agent_service_pb2
from aiohttp import web, WSMsgType

from .base import Transport
from openagents.models.transport import TransportType, ConnectionState, ConnectionInfo
from openagents.models.event import Event

logger = logging.getLogger(__name__)


class HttpTransport(Transport):
    """
    HTTP transport implementation.

    This transport implementation uses HTTP to communicate with the network.
    It is used to communicate with the network from the browser and easily obtain claim information.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(TransportType.HTTP, config, is_notifiable=False)
        self.app = web.Application()
        self.site = None
        self.network_instance = None  # Reference to network instance
        self.setup_routes()

    def setup_routes(self):
        """Setup HTTP routes."""
        self.app.router.add_get('/api/health', self.health_check)
        self.app.router.add_post('/api/register', self.register_agent)
        self.app.router.add_post('/api/unregister', self.unregister_agent)
        self.app.router.add_get('/api/poll', self.poll_messages)
        self.app.router.add_post('/api/send_event', self.send_message)
    
    async def initialize(self) -> bool:
        self.is_initialized = True
    
    async def shutdown(self) -> bool:
       """Shutdown HTTP transport."""
       self.is_initialized = False
       self.is_listening = False
       if self.site:
           await self.site.stop()
           self.site = None
       return True
    
    async def send(self, message: Event) -> bool:
        return True
    
    async def health_check(self, request):
        """Handle health check requests."""
        logger.debug("HTTP health check requested")
        return web.json_response({
            'status': 'healthy',
            'transport': 'http',
            'timestamp': json.dumps(None, default=str)  # Will be current time when serialized
        })
    
    async def register_agent(self, request):
        """Handle agent registration via HTTP."""
        try:
            data = await request.json()
            agent_id = data.get('agent_id')
            metadata = data.get('metadata', {})
            
            if not agent_id:
                return web.json_response({
                    'success': False,
                    'error_message': 'agent_id is required'
                }, status=400)
            
            logger.info(f"HTTP Agent registration: {agent_id}")
            
            # Register with network instance if available
            register_event = Event(
                event_name=SYSTEM_EVENT_REGISTER_AGENT,
                source_id=agent_id,
                payload={
                    "agent_id": agent_id,
                    "metadata": metadata,
                    "transport_type": TransportType.HTTP,
                    "certificate": data.get('certificate', None),
                    "force_reconnect": True
                }
            )
            return_data = await self.call_event_handler(register_event)
            if hasattr(self, 'network_instance') and self.network_instance:
                try:
                    # Register with network topology/agent tracking
                    success = await self.network_instance.register_agent(agent_id, metadata)
                    network_name = self.network_instance.network_name
                    network_id = self.network_instance.network_id
                    
                    # Also register with system commands for poll_messages support
                    from openagents.core.system_commands import default_registry
                    
                    # Create a mock connection for HTTP agents
                    class MockHTTPConnection:
                        def __init__(self, agent_id):
                            self.agent_id = agent_id
                        
                        async def send(self, message_str):
                            """Mock send method - HTTP agents use polling instead."""
                            pass
                    
                    # Register agent in system commands for polling support
                    command_data = {
                        "agent_id": agent_id,
                        "metadata": metadata,
                        "transport_type": TransportType.HTTP,
                        "certificate": data.get('certificate', None),
                        "force_reconnect": True
                    }
                    
                    mock_connection = MockHTTPConnection(agent_id)
                    
                    # Execute system command registration
                    if "register_agent" in default_registry.command_handlers:
                        await default_registry.command_handlers["register_agent"](
                            "register_agent",
                            command_data, 
                            mock_connection,
                            self.network_instance
                        )
                    
                    if success:
                        logger.info(f"✅ Successfully registered HTTP agent {agent_id} with network {network_name}")
                        return web.json_response({
                            'success': True,
                            'network_name': network_name,
                            'network_id': network_id
                        })
                    else:
                        logger.error(f"❌ Network registration failed for HTTP agent {agent_id}")
                        return web.json_response({
                            'success': False,
                            'error_message': 'Network registration failed'
                        }, status=500)
                        
                except Exception as e:
                    logger.error(f"❌ Error during HTTP agent registration: {e}")
                    return web.json_response({
                        'success': False,
                        'error_message': f'Registration error: {str(e)}'
                    }, status=500)
            else:
                logger.warning(f"⚠️ No network instance available for registering HTTP agent {agent_id}")
                # Fallback to basic acknowledgment
                return web.json_response({
                    'success': True,
                    'network_name': 'TestNetwork',
                    'network_id': 'http-network'
                })
                
        except Exception as e:
            logger.error(f"Error in HTTP register_agent: {e}")
            return web.json_response({
                'success': False,
                'error_message': str(e)
            }, status=500)
    
    async def unregister_agent(self, request):
        """Handle agent unregistration via HTTP."""
        try:
            data = await request.json()
            agent_id = data.get('agent_id')
            
            if not agent_id:
                return web.json_response({
                    'success': False,
                    'error_message': 'agent_id is required'
                }, status=400)
            
            logger.info(f"HTTP Agent unregistration: {agent_id}")
            
            # TODO: Implement actual unregistration logic with network instance
            return web.json_response({'success': True})
            
        except Exception as e:
            logger.error(f"Error in HTTP unregister_agent: {e}")
            return web.json_response({
                'success': False,
                'error_message': str(e)
            }, status=500)
    
    async def poll_messages(self, request):
        """Handle message polling for HTTP agents."""
        try:
            agent_id = request.query.get('agent_id')
            
            if not agent_id:
                return web.json_response({
                    'success': False,
                    'error_message': 'agent_id query parameter is required'
                }, status=400)
            
            logger.debug(f"HTTP polling messages for agent: {agent_id}")
            
            # TODO: Implement actual message polling logic
            # This would typically check for pending messages for the agent
            # and return them in the response
            
            return web.json_response({
                'success': True,
                'messages': [],  # Empty for now - implement actual message queue
                'agent_id': agent_id
            })
            
        except Exception as e:
            logger.error(f"Error in HTTP poll_messages: {e}")
            return web.json_response({
                'success': False,
                'error_message': str(e)
            }, status=500)
    
    async def send_message(self, request):
        """Handle sending events/messages via HTTP."""
        try:
            data = await request.json()
            
            # Extract event data similar to gRPC SendEvent
            event_name = data.get('event_name')
            source_id = data.get('source_id')
            target_agent_id = data.get('target_agent_id')
            payload = data.get('payload', {})
            event_id = data.get('event_id')
            metadata = data.get('metadata', {})
            visibility = data.get('visibility', 'network')
            
            if not event_name or not source_id:
                return web.json_response({
                    'success': False,
                    'error_message': 'event_name and source_id are required'
                }, status=400)
            
            logger.debug(f"HTTP unified event: {event_name} from {source_id}")
            
            # Create internal Event from HTTP request
            from datetime import datetime
            event = Event(
                event_name=event_name,
                source_id=source_id,
                destination_id=target_agent_id,
                payload=payload,
                event_id=event_id,
                timestamp=datetime.now(),
                metadata=metadata,
                visibility=visibility
            )
            
            # Route through unified handler (similar to gRPC)
            response_data = await self._handle_sent_event(event)
            
            return web.json_response({
                'success': response_data.get('success', True) if response_data else True,
                'event_id': event_id,
                'response_data': response_data,
                'error_message': response_data.get('error', '') if response_data else ''
            })
            
        except Exception as e:
            logger.error(f"Error handling HTTP send_message: {e}")
            return web.json_response({
                'success': False,
                'error_message': str(e)
            }, status=500)
    
    async def _handle_sent_event(self, event):
        """Unified event handler that routes both regular messages and system commands."""
        logger.debug(f"Processing HTTP unified event: {event.event_name} from {event.source_id}")
        
        # Notify registered event handlers
        await self.call_event_handler(event)
        
        # Return basic success response
        return {'success': True}

    async def listen(self, address: str) -> bool:
        runner = web.AppRunner(self.app)
        await runner.setup()
        
        # Use a different port for HTTP (gRPC port + 1000)
        if ":" in address:
            host, port = address.split(":")
        else:
            host = "0.0.0.0"
            port = address
        site = web.TCPSite(runner, host, port)
        await site.start()
        
        logger.info(f"HTTP transport listening on {host}:{port}")
        self.is_listening = True
        return runner


# Convenience function for creating HTTP transport
def create_http_transport(host: str = '0.0.0.0', port: int = 8080, **kwargs) -> HttpTransport:
    """Create an HTTP transport with given configuration.""" 
    config = {'host': host, 'port': port, **kwargs}
    return HttpTransport(config)