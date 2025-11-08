"""
Agent adapter for the project mod.

This adapter provides tools for agents to interact with the comprehensive
project management system including templates, lifecycle, state, and artifacts.
"""

import logging
import asyncio
from typing import Dict, Any, List, Optional
from openagents.core.base_mod_adapter import BaseModAdapter
from openagents.models.tool import AgentTool
from openagents.models.event import Event
from openagents.workspace.project_messages import *

logger = logging.getLogger(__name__)


class DefaultProjectAgentAdapter(BaseModAdapter):
    """Agent adapter for project management functionality."""

    def __init__(self, mod_name: str = "project.default"):
        """Initialize the project agent adapter."""
        super().__init__(mod_name=mod_name)
        self._pending_responses: Dict[str, asyncio.Future] = {}

    def get_tools(self) -> List[AgentTool]:
        """Get the tools provided by this adapter."""
        return [
            # Template Management
            AgentTool(
                name="list_project_templates",
                description="List all available project templates",
                parameters={
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False
                }
            ),
            
            # Project Lifecycle
            AgentTool(
                name="start_project",
                description="Start a new project from a template",
                parameters={
                    "type": "object",
                    "properties": {
                        "template_id": {
                            "type": "string",
                            "description": "ID of the project template to use"
                        },
                        "goal": {
                            "type": "string",
                            "description": "The goal or description of the project"
                        },
                        "name": {
                            "type": "string",
                            "description": "Optional name for the project"
                        },
                        "collaborators": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Optional list of additional agent IDs to collaborate"
                        }
                    },
                    "required": ["template_id", "goal"],
                    "additionalProperties": False
                }
            ),
            
            AgentTool(
                name="stop_project", 
                description="Stop a running project",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project to stop"
                        },
                        "reason": {
                            "type": "string",
                            "description": "Optional reason for stopping the project"
                        }
                    },
                    "required": ["project_id"],
                    "additionalProperties": False
                }
            ),
            
            AgentTool(
                name="complete_project",
                description="Mark a project as completed",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project to complete"
                        },
                        "summary": {
                            "type": "string",
                            "description": "Summary of what was accomplished"
                        }
                    },
                    "required": ["project_id", "summary"],
                    "additionalProperties": False
                }
            ),
            
            AgentTool(
                name="get_project",
                description="Get detailed information about a project",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project to retrieve"
                        }
                    },
                    "required": ["project_id"],
                    "additionalProperties": False
                }
            ),
            
            # Project Messaging
            AgentTool(
                name="send_project_message",
                description="Send a message to the project channel",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project"
                        },
                        "content": {
                            "type": "object",
                            "properties": {
                                "text": {
                                    "type": "string",
                                    "description": "Message text content"
                                }
                            },
                            "required": ["text"],
                            "description": "Message content"
                        },
                        "reply_to_id": {
                            "type": "string",
                            "description": "Optional ID of message to reply to"
                        },
                        "attachments": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "file_id": {"type": "string"},
                                    "filename": {"type": "string"},
                                    "mime_type": {"type": "string"}
                                }
                            },
                            "description": "Optional file attachments"
                        }
                    },
                    "required": ["project_id", "content"],
                    "additionalProperties": False
                }
            ),
            
            # Global State Management
            AgentTool(
                name="set_project_global_state",
                description="Set a global state value for the project",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project"
                        },
                        "key": {
                            "type": "string",
                            "description": "State key"
                        },
                        "value": {
                            "description": "State value (any type)"
                        }
                    },
                    "required": ["project_id", "key", "value"],
                    "additionalProperties": False
                }
            ),
            
            AgentTool(
                name="get_project_global_state",
                description="Get a global state value for the project",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project"
                        },
                        "key": {
                            "type": "string",
                            "description": "State key to retrieve"
                        }
                    },
                    "required": ["project_id", "key"],
                    "additionalProperties": False
                }
            ),
            
            AgentTool(
                name="list_project_global_state",
                description="List all global state for the project",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string", 
                            "description": "ID of the project"
                        }
                    },
                    "required": ["project_id"],
                    "additionalProperties": False
                }
            ),
            
            AgentTool(
                name="delete_project_global_state",
                description="Delete a global state value for the project",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project"
                        },
                        "key": {
                            "type": "string",
                            "description": "State key to delete"
                        }
                    },
                    "required": ["project_id", "key"],
                    "additionalProperties": False
                }
            ),
            
            # Agent State Management
            AgentTool(
                name="set_project_agent_state",
                description="Set your agent-specific state for the project",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project"
                        },
                        "key": {
                            "type": "string",
                            "description": "State key"
                        },
                        "value": {
                            "description": "State value (any type)"
                        }
                    },
                    "required": ["project_id", "key", "value"],
                    "additionalProperties": False
                }
            ),
            
            AgentTool(
                name="get_project_agent_state",
                description="Get your agent-specific state for the project",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project"
                        },
                        "key": {
                            "type": "string",
                            "description": "State key to retrieve"
                        }
                    },
                    "required": ["project_id", "key"],
                    "additionalProperties": False
                }
            ),
            
            AgentTool(
                name="list_project_agent_state",
                description="List all your agent-specific state for the project",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project"
                        }
                    },
                    "required": ["project_id"],
                    "additionalProperties": False
                }
            ),
            
            AgentTool(
                name="delete_project_agent_state",
                description="Delete your agent-specific state for the project",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project"
                        },
                        "key": {
                            "type": "string",
                            "description": "State key to delete"
                        }
                    },
                    "required": ["project_id", "key"],
                    "additionalProperties": False
                }
            ),
            
            # Artifact Management
            AgentTool(
                name="set_project_artifact",
                description="Set a project artifact (document, file, etc.)",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project"
                        },
                        "key": {
                            "type": "string",
                            "description": "Artifact key/name"
                        },
                        "value": {
                            "type": "string",
                            "description": "Artifact content"
                        }
                    },
                    "required": ["project_id", "key", "value"],
                    "additionalProperties": False
                }
            ),
            
            AgentTool(
                name="get_project_artifact",
                description="Get a project artifact",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project"
                        },
                        "key": {
                            "type": "string",
                            "description": "Artifact key/name to retrieve"
                        }
                    },
                    "required": ["project_id", "key"],
                    "additionalProperties": False
                }
            ),
            
            AgentTool(
                name="list_project_artifacts",
                description="List all artifact keys for the project",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project"
                        }
                    },
                    "required": ["project_id"],
                    "additionalProperties": False
                }
            ),
            
            AgentTool(
                name="delete_project_artifact",
                description="Delete a project artifact",
                parameters={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID of the project"
                        },
                        "key": {
                            "type": "string",
                            "description": "Artifact key/name to delete"
                        }
                    },
                    "required": ["project_id", "key"],
                    "additionalProperties": False
                }
            )
        ]

    # Template Management

    async def list_project_templates(self) -> Dict[str, Any]:
        """List all available project templates."""
        message = ProjectTemplateListMessage(source_id=self._agent_id)
        return await self._send_and_wait_for_response(message)

    # Project Lifecycle

    async def start_project(
        self,
        template_id: str,
        goal: str,
        name: Optional[str] = None,
        collaborators: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Start a new project from a template."""
        message = ProjectStartMessage(
            template_id=template_id,
            goal=goal,
            source_id=self._agent_id,
            name=name,
            collaborators=collaborators
        )
        return await self._send_and_wait_for_response(message)

    async def stop_project(self, project_id: str, reason: Optional[str] = None) -> Dict[str, Any]:
        """Stop a project."""
        message = ProjectStopMessage(
            project_id=project_id,
            source_id=self._agent_id,
            reason=reason
        )
        return await self._send_and_wait_for_response(message)

    async def complete_project(self, project_id: str, summary: str) -> Dict[str, Any]:
        """Complete a project."""
        message = ProjectCompleteMessage(
            project_id=project_id,
            summary=summary,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    async def get_project(self, project_id: str) -> Dict[str, Any]:
        """Get project details."""
        message = ProjectGetMessage(
            project_id=project_id,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    # Project Messaging

    async def send_project_message(
        self,
        project_id: str,
        content: Dict[str, Any],
        reply_to_id: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Send a message to the project channel."""
        message = ProjectMessageSendMessage(
            project_id=project_id,
            content=content,
            source_id=self._agent_id,
            reply_to_id=reply_to_id,
            attachments=attachments
        )
        return await self._send_and_wait_for_response(message)

    # Global State Management

    async def set_project_global_state(self, project_id: str, key: str, value: Any) -> Dict[str, Any]:
        """Set a global state value for the project."""
        message = ProjectGlobalStateSetMessage(
            project_id=project_id,
            key=key,
            value=value,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    async def get_project_global_state(self, project_id: str, key: str) -> Dict[str, Any]:
        """Get a global state value for the project."""
        message = ProjectGlobalStateGetMessage(
            project_id=project_id,
            key=key,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    async def list_project_global_state(self, project_id: str) -> Dict[str, Any]:
        """List all global state for the project."""
        message = ProjectGlobalStateListMessage(
            project_id=project_id,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    async def delete_project_global_state(self, project_id: str, key: str) -> Dict[str, Any]:
        """Delete a global state value for the project."""
        message = ProjectGlobalStateDeleteMessage(
            project_id=project_id,
            key=key,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    # Agent State Management

    async def set_project_agent_state(self, project_id: str, key: str, value: Any) -> Dict[str, Any]:
        """Set your agent-specific state for the project."""
        message = ProjectAgentStateSetMessage(
            project_id=project_id,
            key=key,
            value=value,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    async def get_project_agent_state(self, project_id: str, key: str) -> Dict[str, Any]:
        """Get your agent-specific state for the project."""
        message = ProjectAgentStateGetMessage(
            project_id=project_id,
            key=key,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    async def list_project_agent_state(self, project_id: str) -> Dict[str, Any]:
        """List all your agent-specific state for the project."""
        message = ProjectAgentStateListMessage(
            project_id=project_id,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    async def delete_project_agent_state(self, project_id: str, key: str) -> Dict[str, Any]:
        """Delete your agent-specific state for the project."""
        message = ProjectAgentStateDeleteMessage(
            project_id=project_id,
            key=key,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    # Artifact Management

    async def set_project_artifact(self, project_id: str, key: str, value: str) -> Dict[str, Any]:
        """Set a project artifact."""
        message = ProjectArtifactSetMessage(
            project_id=project_id,
            key=key,
            value=value,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    async def get_project_artifact(self, project_id: str, key: str) -> Dict[str, Any]:
        """Get a project artifact."""
        message = ProjectArtifactGetMessage(
            project_id=project_id,
            key=key,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    async def list_project_artifacts(self, project_id: str) -> Dict[str, Any]:
        """List all artifact keys for the project."""
        message = ProjectArtifactListMessage(
            project_id=project_id,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    async def delete_project_artifact(self, project_id: str, key: str) -> Dict[str, Any]:
        """Delete a project artifact."""
        message = ProjectArtifactDeleteMessage(
            project_id=project_id,
            key=key,
            source_id=self._agent_id
        )
        return await self._send_and_wait_for_response(message)

    # Utility Methods

    async def _send_and_wait_for_response(self, message, timeout: float = 10.0) -> Dict[str, Any]:
        """Send a message and wait for response."""
        request_id = message.event_id

        # Create future for response
        future = asyncio.Future()
        self._pending_responses[request_id] = future

        # Send message via event system
        event = Event(
            event_name=message.event_name,
            source_id=self._agent_id,
            relevant_mod="openagents.mods.workspace.project",
            payload={
                attr: getattr(message, attr)
                for attr in dir(message)
                if not attr.startswith('_') and not callable(getattr(message, attr))
                and attr not in ['event_name', 'source_id', 'event_id', 'timestamp', 'payload']
            }
        )

        try:
            await self._connector.send_message(event)

            # Wait for response
            response = await asyncio.wait_for(future, timeout=timeout)
            return response

        except asyncio.TimeoutError:
            logger.warning(f"Timeout waiting for response to {request_id}")
            return {"success": False, "error": "Request timeout"}
        except Exception as e:
            logger.error(f"Error sending message or waiting for response: {e}")
            return {"success": False, "error": str(e)}
        finally:
            # Clean up
            self._pending_responses.pop(request_id, None)

    async def handle_message(self, message) -> None:
        """Handle incoming messages."""
        if isinstance(message, Event):
            # Handle project responses
            if message.event_name == "project.response":
                payload = message.payload
                # Look for request correlation (by event_id or other means)
                # For now, handle as general response

            # Handle project notifications
            elif message.event_name.startswith("project.notification."):
                await self._handle_project_notification(message)

    async def _handle_project_notification(self, message: Event) -> None:
        """Handle project notifications."""
        event_name = message.event_name
        payload = message.payload

        logger.info(f"Received project notification: {event_name}")

        # Agents can override this method to handle specific notifications
        # For now, just log the notification
        if event_name == "project.notification.started":
            project_id = payload.get("project_id")
            logger.info(f"Project {project_id} was started")
        elif event_name == "project.notification.completed":
            project_id = payload.get("project_id")
            summary = payload.get("summary")
            logger.info(f"Project {project_id} was completed: {summary}")
        elif event_name == "project.notification.message_received":
            project_id = payload.get("project_id")
            sender_id = payload.get("sender_id")
            logger.info(f"New message in project {project_id} from {sender_id}")
        elif event_name == "project.notification.artifact_updated":
            project_id = payload.get("project_id")
            key = payload.get("key")
            action = payload.get("action")
            logger.info(f"Artifact '{key}' was {action} in project {project_id}")