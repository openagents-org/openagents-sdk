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
from openagents.config.globals import SYSTEM_EVENT_REGISTER_AGENT, SYSTEM_EVENT_HEALTH_CHECK
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
        # Add both /health and /api/health for compatibility
        self.app.router.add_get('/api/health', self.health_check)
        self.app.router.add_post('/api/register', self.register_agent)
        self.app.router.add_post('/api/unregister', self.unregister_agent)
        self.app.router.add_get('/api/poll', self.poll_messages)
        self.app.router.add_post('/api/send_event', self.send_message)
    
    async def initialize(self) -> bool:
        """Initialize HTTP transport."""
        self.is_initialized = True
        return True
    
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
        
        # Create a system health check event
        health_check_event = Event(
            event_name=SYSTEM_EVENT_HEALTH_CHECK,
            source_id="http_transport",
            destination_id="system:system",
            payload={}
        )
        
        # Send the health check event and get response using the event handler
        try:
            # Process the health check event through the registered event handler
            event_response = await self.call_event_handler(health_check_event)
            
            if event_response and event_response.success and event_response.data:
                network_stats = event_response.data
                logger.debug("Successfully retrieved network stats via health check event")
            else:
                logger.warning(f"Health check event failed: {event_response.message if event_response else 'No response'}")
                raise Exception("Health check event failed")
                
        except Exception as e:
            logger.warning(f"Failed to process health check event: {e}")
            # Provide minimal stats if health check event fails
            network_stats = {
                "network_id": "unknown",
                "network_name": "Unknown Network",
                "is_running": False,
                "uptime_seconds": 0,
                "agent_count": 0,
                "agents": {},
                "mods": [],
                "topology_mode": "centralized",
                "transports": [],
                "manifest_transport": "http",
                "recommended_transport": "grpc",
                "max_connections": 100
            }
        
        return web.json_response({
            'success': True,
            'status': 'healthy',
            'data': network_stats
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
            # Process the registration event through the event handler
            event_response = await self.call_event_handler(register_event)
            
            if event_response and event_response.success:
                # Extract network information from the response
                network_name = event_response.data.get('network_name', 'Unknown Network') if event_response.data else 'Unknown Network'
                network_id = event_response.data.get('network_id', 'unknown') if event_response.data else 'unknown'
                
                logger.info(f"✅ Successfully registered HTTP agent {agent_id} with network {network_name}")
                return web.json_response({
                    'success': True,
                    'network_name': network_name,
                    'network_id': network_id
                })
            else:
                error_message = event_response.message if event_response else 'No response from event handler'
                logger.error(f"❌ Network registration failed for HTTP agent {agent_id}: {error_message}")
                return web.json_response({
                    'success': False,
                    'error_message': f'Registration failed: {error_message}'
                }, status=500)
                
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
    
    async def peer_connect(self, peer_id: str, metadata: Dict[str, Any] = None) -> bool:
        """Connect to a peer (HTTP doesn't maintain persistent connections)."""
        logger.debug(f"HTTP transport peer_connect called for {peer_id}")
        return True
    
    async def peer_disconnect(self, peer_id: str) -> bool:
        """Disconnect from a peer (HTTP doesn't maintain persistent connections)."""
        logger.debug(f"HTTP transport peer_disconnect called for {peer_id}")
        return True

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
        self.site = site  # Store the site for shutdown
        return True


# Convenience function for creating HTTP transport
def create_http_transport(host: str = '0.0.0.0', port: int = 8080, **kwargs) -> HttpTransport:
    """Create an HTTP transport with given configuration.""" 
    config = {'host': host, 'port': port, **kwargs}
    return HttpTransport(config)