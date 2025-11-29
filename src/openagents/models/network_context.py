"""
Network Context - Shared context for network components.

This module provides the NetworkContext class which encapsulates all network
information needed by various components (transports, tool collectors, etc.)
without requiring direct access to the AgentNetwork instance.
"""

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, Optional, OrderedDict, TYPE_CHECKING

if TYPE_CHECKING:
    from openagents.core.base_mod import BaseMod
    from openagents.models.network_config import NetworkConfig, NetworkProfile
    from openagents.models.external_access import ExternalAccessConfig
    from openagents.models.event import Event


@dataclass
class NetworkContext:
    """
    Context object providing shared network information to components.

    This class consolidates all network-related data and callbacks that various
    components need, eliminating the need to pass the full AgentNetwork instance.

    Attributes:
        network_name: Name of the network
        workspace_path: Path to the workspace directory (for tools, events, etc.)
        config: The network configuration object
        mods: Dictionary of loaded network mods (name -> mod instance)
        emit_event: Async callback for emitting events through the event gateway
    """

    network_name: str = "OpenAgents"
    workspace_path: Optional[str] = None
    config: Optional["NetworkConfig"] = None
    mods: OrderedDict[str, "BaseMod"] = field(default_factory=OrderedDict)
    emit_event: Optional[Callable[["Event", bool], Awaitable[Any]]] = None

    @property
    def external_access(self) -> Optional["ExternalAccessConfig"]:
        """Get the external_access configuration from network config."""
        if self.config:
            return getattr(self.config, "external_access", None)
        return None

    @property
    def network_profile(self) -> Optional["NetworkProfile"]:
        """Get the network_profile from network config."""
        if self.config:
            return getattr(self.config, "network_profile", None)
        return None
