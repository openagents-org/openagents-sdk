#!/usr/bin/env python3
"""
Bulk Agent Manager for OpenAgents

This module provides utilities for discovering, starting, and managing multiple agents
from a directory of YAML configuration files.
"""

import asyncio
import logging
import yaml
import signal
import sys
import os
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import threading
import time

from openagents.agents.runner import AgentRunner

logger = logging.getLogger(__name__)


@dataclass
class AgentInfo:
    """Information about an agent configuration."""
    config_path: Path
    agent_id: str
    agent_type: str
    connection_settings: Dict
    is_valid: bool = True
    error_message: Optional[str] = None


@dataclass
class AgentInstance:
    """A running agent instance."""
    info: AgentInfo
    runner: Optional[AgentRunner] = None
    status: str = "stopped"  # stopped, starting, running, error, stopping
    error_message: Optional[str] = None
    start_time: Optional[float] = None
    log_buffer: List[str] = None
    
    def __post_init__(self):
        if self.log_buffer is None:
            self.log_buffer = []


class BulkAgentManager:
    """Manages multiple agents from YAML configurations in a directory."""
    
    def __init__(self):
        self.agents: Dict[str, AgentInstance] = {}
        self.running = False
        self._shutdown_event = threading.Event()
        self._executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix="AgentRunner")
        self._setup_grpc_environment()
        self._setup_error_filtering()
        
    def _setup_grpc_environment(self):
        """Configure gRPC environment to prevent BlockingIOError."""
        # Aggressive gRPC optimization to prevent resource errors
        os.environ['GRPC_POLL_STRATEGY'] = 'poll'  # Use more stable polling
        os.environ['GRPC_ENABLE_FORK_SUPPORT'] = '1'
        os.environ['GRPC_SO_REUSEPORT'] = '0'  # Disable to prevent conflicts
        
        # Minimize gRPC resource usage
        os.environ['GRPC_VERBOSITY'] = 'NONE'
        os.environ['GRPC_TRACE'] = ''
        
        # Set resource limits to prevent overload
        os.environ['GRPC_MAX_SEND_MESSAGE_LENGTH'] = '4194304'  # 4MB
        os.environ['GRPC_MAX_RECEIVE_MESSAGE_LENGTH'] = '4194304'  # 4MB
        
        # Configure asyncio to handle more concurrent connections
        try:
            import asyncio
            if hasattr(asyncio, 'set_event_loop_policy'):
                # Use a more robust event loop policy
                if sys.platform != 'win32':
                    asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())
        except Exception:
            pass
    
    def _setup_error_filtering(self):
        """Setup logging filter to suppress BlockingIOError messages."""
        class BlockingIOErrorFilter(logging.Filter):
            def filter(self, record):
                # Suppress BlockingIOError and gRPC connection messages
                if hasattr(record, 'msg'):
                    msg = str(record.msg)
                    if any(pattern in msg for pattern in [
                        'BlockingIOError',
                        'Resource temporarily unavailable',
                        'PollerCompletionQueue._handle_events',
                        'failed to connect to all addresses',
                        'Connection refused'
                    ]):
                        return False
                return True
        
        # Apply filter to root logger and asyncio logger
        root_logger = logging.getLogger()
        asyncio_logger = logging.getLogger('asyncio')
        grpc_logger = logging.getLogger('grpc')
        
        blocker_filter = BlockingIOErrorFilter()
        root_logger.addFilter(blocker_filter)
        asyncio_logger.addFilter(blocker_filter)
        grpc_logger.addFilter(blocker_filter)
        
    def discover_agents(self, directory: Path) -> List[AgentInfo]:
        """Discover and validate agent configurations in a directory.
        
        Args:
            directory: Directory to scan for YAML files
            
        Returns:
            List of AgentInfo objects for valid agent configurations
        """
        agent_configs = []
        yaml_files = list(directory.glob("*.yaml")) + list(directory.glob("*.yml"))
        
        if not yaml_files:
            logger.warning(f"No YAML files found in {directory}")
            return []
        
        for yaml_file in yaml_files:
            try:
                agent_info = self._parse_agent_config(yaml_file)
                if agent_info:
                    agent_configs.append(agent_info)
            except Exception as e:
                logger.error(f"Error parsing {yaml_file}: {e}")
                # Still add invalid configs for user feedback
                agent_configs.append(AgentInfo(
                    config_path=yaml_file,
                    agent_id=yaml_file.stem,
                    agent_type="unknown",
                    connection_settings={},
                    is_valid=False,
                    error_message=str(e)
                ))
        
        return agent_configs
    
    def _parse_agent_config(self, config_path: Path) -> Optional[AgentInfo]:
        """Parse a single YAML agent configuration.
        
        Args:
            config_path: Path to the YAML configuration file
            
        Returns:
            AgentInfo if valid agent config, None if not an agent config
        """
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            
            # Check if this is an agent configuration (not a network config)
            if not config or 'type' not in config:
                logger.debug(f"Skipping {config_path}: not an agent config (no 'type' field)")
                return None
            
            # Skip network configurations
            if 'network' in config and 'agent_id' not in config:
                logger.debug(f"Skipping {config_path}: appears to be a network config")
                return None
            
            # Extract agent information
            agent_type = config.get('type', 'unknown')
            agent_id = config.get('agent_id', config_path.stem)
            connection_settings = config.get('connection', {})
            
            return AgentInfo(
                config_path=config_path,
                agent_id=agent_id,
                agent_type=agent_type,
                connection_settings=connection_settings,
                is_valid=True
            )
            
        except Exception as e:
            logger.error(f"Error parsing config {config_path}: {e}")
            raise
    
    def add_agents(self, agent_infos: List[AgentInfo]) -> None:
        """Add agent configurations to the manager.
        
        Args:
            agent_infos: List of agent configurations to add
        """
        for info in agent_infos:
            if info.agent_id in self.agents:
                logger.warning(f"Agent ID '{info.agent_id}' already exists, skipping")
                continue
                
            self.agents[info.agent_id] = AgentInstance(info=info)
    
    async def start_agent(self, agent_id: str, connection_override: Optional[Dict] = None) -> bool:
        """Start a single agent.
        
        Args:
            agent_id: ID of the agent to start
            connection_override: Optional connection settings to override config
            
        Returns:
            True if agent started successfully, False otherwise
        """
        if agent_id not in self.agents:
            logger.error(f"Agent '{agent_id}' not found")
            return False
        
        agent_instance = self.agents[agent_id]
        
        if not agent_instance.info.is_valid:
            logger.error(f"Agent '{agent_id}' has invalid configuration: {agent_instance.info.error_message}")
            agent_instance.status = "error"
            agent_instance.error_message = agent_instance.info.error_message
            return False
        
        if agent_instance.status == "running":
            logger.warning(f"Agent '{agent_id}' is already running")
            return True
        
        try:
            agent_instance.status = "starting"
            agent_instance.start_time = time.time()
            agent_instance.error_message = None
            
            # Load agent using AgentRunner.from_yaml
            runner = AgentRunner.from_yaml(
                str(agent_instance.info.config_path),
                connection_override=connection_override
            )
            agent_instance.runner = runner
            
            # Start the agent in background thread with gRPC error handling
            def start_agent_sync():
                try:
                    # Prepare connection settings
                    connection_settings = agent_instance.info.connection_settings.copy()
                    if connection_override:
                        connection_settings.update(connection_override)
                    
                    # Add retry logic for gRPC connection issues
                    max_retries = 3
                    retry_delay = 1.0
                    
                    for attempt in range(max_retries):
                        try:
                            # Start the agent
                            runner.start(
                                network_host=connection_settings.get("host"),
                                network_port=connection_settings.get("port"),
                                network_id=connection_settings.get("network_id"),
                                metadata={
                                    "agent_type": agent_instance.info.agent_type,
                                    "config_file": str(agent_instance.info.config_path)
                                }
                            )
                            
                            agent_instance.status = "running"
                            logger.info(f"Agent '{agent_id}' started successfully")
                            break
                            
                        except (OSError, ConnectionError, Exception) as e:
                            error_msg = str(e)
                            if "BlockingIOError" in error_msg or "Resource temporarily unavailable" in error_msg:
                                if attempt < max_retries - 1:
                                    logger.warning(f"Agent '{agent_id}' gRPC connection failed (attempt {attempt + 1}), retrying in {retry_delay}s...")
                                    time.sleep(retry_delay)
                                    retry_delay *= 1.5  # Exponential backoff
                                    continue
                                else:
                                    logger.error(f"Agent '{agent_id}' failed after {max_retries} attempts due to gRPC resource issues")
                                    agent_instance.status = "error"
                                    agent_instance.error_message = "Failed to start agent: gRPC resource temporarily unavailable"
                                    return
                            else:
                                # Non-gRPC error, don't retry
                                raise e
                    
                    if agent_instance.status == "running":
                        # Keep agent running until shutdown
                        runner.wait_for_stop()
                    
                except Exception as e:
                    agent_instance.status = "error"
                    agent_instance.error_message = str(e)
                    logger.error(f"Error starting agent '{agent_id}': {e}")
                finally:
                    if agent_instance.status == "running":
                        agent_instance.status = "stopped"
            
            # Submit to thread pool
            future = self._executor.submit(start_agent_sync)
            
            # Wait a moment for startup to complete
            await asyncio.sleep(0.5)
            
            if agent_instance.status == "starting":
                # Give it a bit more time
                await asyncio.sleep(1.0)
            
            return agent_instance.status in ["running", "starting"]
            
        except Exception as e:
            agent_instance.status = "error" 
            agent_instance.error_message = str(e)
            logger.error(f"Failed to start agent '{agent_id}': {e}")
            return False
    
    async def start_all_agents(
        self,
        connection_override: Optional[Dict] = None,
        max_concurrent: int = 3  # Reduced default to minimize gRPC resource contention
    ) -> Dict[str, bool]:
        """Start all agents concurrently with gRPC error handling.
        
        Args:
            connection_override: Optional connection settings to override all agent configs
            max_concurrent: Maximum number of agents to start concurrently (reduced default)
            
        Returns:
            Dictionary mapping agent_id to success status
        """
        if not self.agents:
            logger.warning("No agents to start")
            return {}
        
        self.running = True
        
        # Reduce concurrency further for gRPC stability
        effective_max_concurrent = min(max_concurrent, 2)
        logger.info(f"Starting agents with max concurrency: {effective_max_concurrent}")
        
        # Create semaphore to limit concurrent startups
        semaphore = asyncio.Semaphore(effective_max_concurrent)
        
        async def start_single_agent(agent_id: str) -> Tuple[str, bool]:
            async with semaphore:
                # Add delay between agent starts to prevent resource conflicts
                await asyncio.sleep(1.0)
                success = await self.start_agent(agent_id, connection_override)
                # Add delay after startup to allow stabilization
                await asyncio.sleep(2.0)
                return agent_id, success
        
        # Start all agents concurrently
        tasks = [
            start_single_agent(agent_id) 
            for agent_id in self.agents.keys() 
            if self.agents[agent_id].info.is_valid
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        success_map = {}
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Error in agent startup: {result}")
                continue
            agent_id, success = result
            success_map[agent_id] = success
        
        return success_map
    
    def stop_agent(self, agent_id: str) -> bool:
        """Stop a single agent.
        
        Args:
            agent_id: ID of the agent to stop
            
        Returns:
            True if agent stopped successfully, False otherwise
        """
        if agent_id not in self.agents:
            logger.error(f"Agent '{agent_id}' not found")
            return False
        
        agent_instance = self.agents[agent_id]
        
        if agent_instance.status != "running":
            logger.warning(f"Agent '{agent_id}' is not running")
            return True
        
        try:
            agent_instance.status = "stopping"
            
            if agent_instance.runner:
                agent_instance.runner.stop()
            
            agent_instance.status = "stopped"
            logger.info(f"Agent '{agent_id}' stopped successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping agent '{agent_id}': {e}")
            agent_instance.status = "error"
            agent_instance.error_message = str(e)
            return False
    
    def stop_all_agents(self) -> Dict[str, bool]:
        """Stop all running agents.
        
        Returns:
            Dictionary mapping agent_id to success status
        """
        self.running = False
        self._shutdown_event.set()
        
        results = {}
        for agent_id in self.agents.keys():
            results[agent_id] = self.stop_agent(agent_id)
        
        return results
    
    def get_agent_status(self, agent_id: str) -> Optional[Dict]:
        """Get status information for an agent.
        
        Args:
            agent_id: ID of the agent
            
        Returns:
            Dictionary with agent status information, None if agent not found
        """
        if agent_id not in self.agents:
            return None
        
        agent_instance = self.agents[agent_id]
        
        status = {
            "agent_id": agent_id,
            "config_path": str(agent_instance.info.config_path),
            "agent_type": agent_instance.info.agent_type,
            "status": agent_instance.status,
            "is_valid": agent_instance.info.is_valid,
            "error_message": agent_instance.error_message,
            "start_time": agent_instance.start_time,
            "uptime": time.time() - agent_instance.start_time if agent_instance.start_time else None
        }
        
        return status
    
    def get_all_status(self) -> Dict[str, Dict]:
        """Get status information for all agents.
        
        Returns:
            Dictionary mapping agent_id to status information
        """
        return {
            agent_id: self.get_agent_status(agent_id)
            for agent_id in self.agents.keys()
        }
    
    def get_running_agents(self) -> List[str]:
        """Get list of currently running agent IDs.
        
        Returns:
            List of agent IDs with status 'running'
        """
        return [
            agent_id for agent_id, instance in self.agents.items()
            if instance.status == "running"
        ]
    
    def get_agent_logs(self, agent_id: str, max_lines: int = 100) -> List[str]:
        """Get recent log entries for an agent.
        
        Args:
            agent_id: ID of the agent
            max_lines: Maximum number of log lines to return
            
        Returns:
            List of log lines, empty if agent not found
        """
        if agent_id not in self.agents:
            return []
        
        agent_instance = self.agents[agent_id]
        return agent_instance.log_buffer[-max_lines:] if agent_instance.log_buffer else []
    
    def shutdown(self) -> None:
        """Shutdown the bulk agent manager and clean up resources."""
        logger.info("Shutting down BulkAgentManager...")
        
        # Stop all agents
        self.stop_all_agents()
        
        # Shutdown executor
        self._executor.shutdown(wait=True)
        
        logger.info("BulkAgentManager shutdown complete")