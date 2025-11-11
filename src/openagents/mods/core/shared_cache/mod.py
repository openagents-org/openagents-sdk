"""
Network-level shared cache mod for OpenAgents.

This mod provides a shared caching system with agent group-based access control.
"""

import logging
import json
import uuid
import time
from typing import Dict, Any, List, Optional, Set
from pathlib import Path

from openagents.core.base_mod import BaseMod, mod_event_handler
from openagents.models.event import Event
from openagents.models.event_response import EventResponse

logger = logging.getLogger(__name__)


class CacheEntry:
    """Represents a single cache entry."""

    def __init__(
        self,
        cache_id: str,
        value: str,
        mime_type: str,
        allowed_agent_groups: List[str],
        created_by: str,
        created_at: int,
        updated_at: int,
    ):
        self.cache_id = cache_id
        self.value = value
        self.mime_type = mime_type
        self.allowed_agent_groups = allowed_agent_groups or []
        self.created_by = created_by
        self.created_at = created_at
        self.updated_at = updated_at

    def to_dict(self) -> Dict[str, Any]:
        """Convert cache entry to dictionary."""
        return {
            "cache_id": self.cache_id,
            "value": self.value,
            "mime_type": self.mime_type,
            "allowed_agent_groups": self.allowed_agent_groups,
            "created_by": self.created_by,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CacheEntry":
        """Create cache entry from dictionary."""
        return cls(
            cache_id=data["cache_id"],
            value=data["value"],
            mime_type=data.get("mime_type", "text/plain"),
            allowed_agent_groups=data.get("allowed_agent_groups", []),
            created_by=data["created_by"],
            created_at=data["created_at"],
            updated_at=data["updated_at"],
        )


class SharedCacheMod(BaseMod):
    """Network-level shared cache mod implementation.

    This mod enables agents to create, read, update, and delete shared cache entries
    with optional agent group-based access control.
    """

    def __init__(self, mod_name: str = "shared_cache"):
        """Initialize the shared cache mod."""
        super().__init__(mod_name=mod_name)

        # Cache storage
        self.cache_entries: Dict[str, CacheEntry] = {}
        self.storage_path: Optional[Path] = None

        logger.info("Initializing Shared Cache mod")

    def bind_network(self, network):
        """Bind the mod to a network and initialize storage."""
        super().bind_network(network)

        # Set up cache storage
        self._setup_cache_storage()

    def _setup_cache_storage(self):
        """Set up cache storage using workspace."""
        # Use storage path (workspace or fallback)
        storage_path = self.get_storage_path()
        self.storage_path = storage_path / "shared_cache"
        self.storage_path.mkdir(exist_ok=True)

        logger.info(f"Using cache storage at {self.storage_path}")

        self._load_cache_entries()

    def _load_cache_entries(self):
        """Load cache entries from storage."""
        try:
            cache_file = self.storage_path / "cache_data.json"

            if cache_file.exists():
                with open(cache_file, "r") as f:
                    data = json.load(f)
                    for cache_id, entry_data in data.items():
                        self.cache_entries[cache_id] = CacheEntry.from_dict(entry_data)
                logger.info(f"Loaded {len(self.cache_entries)} cache entries from storage")
            else:
                logger.debug("No existing cache data found in storage")
        except Exception as e:
            logger.error(f"Failed to load cache entries: {e}")
            self.cache_entries = {}

    def _save_cache_entries(self):
        """Save cache entries to storage."""
        try:
            cache_file = self.storage_path / "cache_data.json"

            data = {
                cache_id: entry.to_dict()
                for cache_id, entry in self.cache_entries.items()
            }

            with open(cache_file, "w") as f:
                json.dump(data, f, indent=2)
            logger.info(f"Saved {len(self.cache_entries)} cache entries to storage")
        except Exception as e:
            logger.error(f"Failed to save cache entries: {e}")

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
        # Save cache entries to storage
        self._save_cache_entries()

        # Clear all state
        self.cache_entries.clear()

        return True

    def _check_agent_access(self, agent_id: str, allowed_groups: List[str]) -> bool:
        """Check if an agent has access to a cache entry.

        Args:
            agent_id: ID of the agent
            allowed_groups: List of allowed agent groups (empty = all agents)

        Returns:
            bool: True if agent has access, False otherwise
        """
        # Empty allowed_groups means everyone has access
        if not allowed_groups:
            return True

        # Check if agent is in any of the allowed groups
        agent_group = self.network.topology.agent_group_membership.get(agent_id)
        if agent_group in allowed_groups:
            return True

        return False

    async def _send_notification(
        self, event_name: str, cache_entry: CacheEntry, exclude_agent: Optional[str] = None
    ):
        """Send notification to agents with access to the cache entry.

        Args:
            event_name: Name of the notification event
            cache_entry: The cache entry that was modified
            exclude_agent: Optional agent ID to exclude from notifications
        """
        # Determine which agents should be notified
        notify_agents = set()

        if cache_entry.allowed_agent_groups:
            # Notify only agents in allowed groups
            for agent_id, group in self.network.topology.agent_group_membership.items():
                if group in cache_entry.allowed_agent_groups:
                    notify_agents.add(agent_id)
        else:
            # Notify all registered agents
            notify_agents = set(self.network.topology.agent_registry.keys())

        # Exclude the agent who triggered the notification
        if exclude_agent:
            notify_agents.discard(exclude_agent)

        # Send notifications
        for agent_id in notify_agents:
            notification = Event(
                event_name=event_name,
                source_id=self.network.network_id,
                destination_id=agent_id,
                payload={
                    "cache_id": cache_entry.cache_id,
                    "mime_type": cache_entry.mime_type,
                    "created_by": cache_entry.created_by,
                    "allowed_agent_groups": cache_entry.allowed_agent_groups,
                },
            )
            try:
                await self.network.process_event(notification)
                logger.debug(f"Sent {event_name} notification to {agent_id}")
            except Exception as e:
                logger.error(f"Failed to send notification to {agent_id}: {e}")

    @mod_event_handler("shared_cache.create")
    async def _handle_cache_create(self, event: Event) -> Optional[EventResponse]:
        """Handle cache creation request.

        Args:
            event: The cache creation event

        Returns:
            EventResponse: Response with cache_id if successful
        """
        try:
            payload = event.payload or {}

            # Validate required fields
            value = payload.get("value")
            if value is None:
                response_data = {"success": False, "error": "value is required"}
            else:
                # Extract optional fields
                mime_type = payload.get("mime_type", "text/plain")
                allowed_agent_groups = payload.get("allowed_agent_groups", [])

                # Ensure value is a string
                if not isinstance(value, str):
                    value = str(value)

                # Create cache entry
                cache_id = str(uuid.uuid4())
                current_time = int(time.time())

                cache_entry = CacheEntry(
                    cache_id=cache_id,
                    value=value,
                    mime_type=mime_type,
                    allowed_agent_groups=allowed_agent_groups,
                    created_by=event.source_id,
                    created_at=current_time,
                    updated_at=current_time,
                )

                self.cache_entries[cache_id] = cache_entry
                self._save_cache_entries()

                logger.info(
                    f"Created cache entry {cache_id} by {event.source_id} "
                    f"(groups: {allowed_agent_groups})"
                )

                # Send notification
                await self._send_notification(
                    "shared_cache.notification.created", cache_entry, exclude_agent=event.source_id
                )

                response_data = {"success": True, "cache_id": cache_id}

            return EventResponse(
                success=response_data.get("success", False),
                message="Cache entry created successfully" if response_data.get("success") else response_data.get("error", "Failed"),
                data=response_data,
            )

        except Exception as e:
            logger.error(f"Error creating cache entry: {e}")
            return EventResponse(
                success=False,
                message=f"Error creating cache entry: {str(e)}",
                data={"error": str(e)},
            )

    @mod_event_handler("shared_cache.get")
    async def _handle_cache_get(self, event: Event) -> Optional[EventResponse]:
        """Handle cache retrieval request.

        Args:
            event: The cache get event

        Returns:
            EventResponse: Response with cache entry if successful
        """
        try:
            payload = event.payload or {}

            # Validate required fields
            cache_id = payload.get("cache_id")
            if not cache_id:
                response_data = {"success": False, "error": "cache_id is required"}
            elif cache_id not in self.cache_entries:
                response_data = {"success": False, "error": "Cache entry not found"}
            else:
                cache_entry = self.cache_entries[cache_id]

                # Check access permissions
                if not self._check_agent_access(event.source_id, cache_entry.allowed_agent_groups):
                    logger.warning(
                        f"Agent {event.source_id} denied access to cache entry {cache_id}"
                    )
                    response_data = {
                        "success": False,
                        "error": "Agent does not have permission to access this cache entry",
                    }
                else:
                    logger.debug(f"Retrieved cache entry {cache_id} for {event.source_id}")
                    response_data = cache_entry.to_dict()
                    response_data["success"] = True

            return EventResponse(
                success=response_data.get("success", False),
                message="Cache entry retrieved" if response_data.get("success") else response_data.get("error", "Failed"),
                data=response_data,
            )

        except Exception as e:
            logger.error(f"Error retrieving cache entry: {e}")
            return EventResponse(
                success=False,
                message=f"Error retrieving cache entry: {str(e)}",
                data={"error": str(e)},
            )

    @mod_event_handler("shared_cache.update")
    async def _handle_cache_update(self, event: Event) -> Optional[EventResponse]:
        """Handle cache update request.

        Args:
            event: The cache update event

        Returns:
            EventResponse: Response indicating success or failure
        """
        try:
            payload = event.payload or {}

            # Validate required fields
            cache_id = payload.get("cache_id")
            value = payload.get("value")

            if not cache_id:
                response_data = {"success": False, "error": "cache_id is required"}
            elif value is None:
                response_data = {"success": False, "error": "value is required"}
            elif cache_id not in self.cache_entries:
                response_data = {"success": False, "error": "Cache entry not found"}
            else:
                cache_entry = self.cache_entries[cache_id]

                # Check access permissions
                if not self._check_agent_access(event.source_id, cache_entry.allowed_agent_groups):
                    logger.warning(
                        f"Agent {event.source_id} denied access to update cache entry {cache_id}"
                    )
                    response_data = {
                        "success": False,
                        "error": "Agent does not have permission to update this cache entry",
                    }
                else:
                    # Update cache entry
                    if not isinstance(value, str):
                        value = str(value)

                    cache_entry.value = value
                    cache_entry.updated_at = int(time.time())

                    self._save_cache_entries()

                    logger.info(f"Updated cache entry {cache_id} by {event.source_id}")

                    # Send notification
                    await self._send_notification(
                        "shared_cache.notification.updated", cache_entry, exclude_agent=event.source_id
                    )

                    response_data = {"success": True, "cache_id": cache_id}

            return EventResponse(
                success=response_data.get("success", False),
                message="Cache entry updated successfully" if response_data.get("success") else response_data.get("error", "Failed"),
                data=response_data,
            )

        except Exception as e:
            logger.error(f"Error updating cache entry: {e}")
            return EventResponse(
                success=False,
                message=f"Error updating cache entry: {str(e)}",
                data={"error": str(e)},
            )

    @mod_event_handler("shared_cache.delete")
    async def _handle_cache_delete(self, event: Event) -> Optional[EventResponse]:
        """Handle cache deletion request.

        Args:
            event: The cache delete event

        Returns:
            EventResponse: Response indicating success or failure
        """
        try:
            payload = event.payload or {}

            # Validate required fields
            cache_id = payload.get("cache_id")

            if not cache_id:
                response_data = {"success": False, "error": "cache_id is required"}
            elif cache_id not in self.cache_entries:
                response_data = {"success": False, "error": "Cache entry not found"}
            else:
                cache_entry = self.cache_entries[cache_id]

                # Check access permissions
                if not self._check_agent_access(event.source_id, cache_entry.allowed_agent_groups):
                    logger.warning(
                        f"Agent {event.source_id} denied access to delete cache entry {cache_id}"
                    )
                    response_data = {
                        "success": False,
                        "error": "Agent does not have permission to delete this cache entry",
                    }
                else:
                    # Delete cache entry
                    del self.cache_entries[cache_id]
                    self._save_cache_entries()

                    logger.info(f"Deleted cache entry {cache_id} by {event.source_id}")

                    # Send notification
                    await self._send_notification(
                        "shared_cache.notification.deleted", cache_entry, exclude_agent=event.source_id
                    )

                    response_data = {"success": True, "cache_id": cache_id}

            return EventResponse(
                success=response_data.get("success", False),
                message="Cache entry deleted successfully" if response_data.get("success") else response_data.get("error", "Failed"),
                data=response_data,
            )

        except Exception as e:
            logger.error(f"Error deleting cache entry: {e}")
            return EventResponse(
                success=False,
                message=f"Error deleting cache entry: {str(e)}",
                data={"error": str(e)},
            )

    def get_state(self) -> Dict[str, Any]:
        """Get the current state of the shared cache mod.

        Returns:
            Dict[str, Any]: Current mod state
        """
        return {
            "cache_count": len(self.cache_entries),
            "storage_path": str(self.storage_path) if self.storage_path else None,
        }
