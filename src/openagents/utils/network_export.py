"""Network export utilities for OpenAgents."""

import json
import logging
import yaml
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Dict, Any, Optional
from zipfile import ZipFile, ZIP_DEFLATED

from openagents.models.network_management import ExportManifest

logger = logging.getLogger(__name__)


class NetworkExporter:
    """Handles exporting network configuration to ZIP archive."""

    def __init__(self, network):
        """Initialize exporter with network instance.
        
        Args:
            network: AgentNetwork instance to export
        """
        self.network = network

    def export_to_zip(
        self,
        include_password_hashes: bool = False,
        include_sensitive_config: bool = False,
        notes: Optional[str] = None
    ) -> BytesIO:
        """Export network configuration to ZIP file.
        
        Args:
            include_password_hashes: Whether to include password hashes
            include_sensitive_config: Whether to include sensitive config fields
            notes: Optional notes about this export
            
        Returns:
            BytesIO: ZIP file in memory
        """
        logger.info(f"Starting network export for '{self.network.network_name}'")
        
        zip_buffer = BytesIO()
        
        with ZipFile(zip_buffer, 'w', ZIP_DEFLATED) as zip_file:
            # Create manifest
            manifest = self._create_manifest(
                include_password_hashes=include_password_hashes,
                include_sensitive_config=include_sensitive_config,
                notes=notes
            )
            zip_file.writestr('manifest.json', json.dumps(manifest.model_dump(), indent=2))
            
            # Export network configuration
            network_config = self._get_network_config(
                include_password_hashes=include_password_hashes,
                include_sensitive_config=include_sensitive_config
            )
            zip_file.writestr('network.yaml', yaml.safe_dump(network_config, sort_keys=False))
            
            # Export network profile if exists
            if hasattr(self.network.config, 'network_profile') and self.network.config.network_profile:
                profile_data = self._get_network_profile(include_sensitive_config=include_sensitive_config)
                if profile_data:
                    zip_file.writestr('network_profile.yaml', yaml.safe_dump(profile_data, sort_keys=False))
            
            # Export mods configuration
            self._export_mods(zip_file, include_sensitive_config=include_sensitive_config)
        
        zip_buffer.seek(0)
        logger.info(f"Network export completed: {len(zip_buffer.getvalue())} bytes")
        return zip_buffer

    def _create_manifest(
        self,
        include_password_hashes: bool,
        include_sensitive_config: bool,
        notes: Optional[str]
    ) -> ExportManifest:
        """Create export manifest."""
        mods_count = len(self.network.config.mods) if self.network.config.mods else 0
        has_network_profile = (
            hasattr(self.network.config, 'network_profile') 
            and self.network.config.network_profile is not None
        )
        
        # Try to get OpenAgents version
        try:
            import openagents
            version = getattr(openagents, '__version__', None)
        except Exception:
            version = None
        
        return ExportManifest(
            export_version="1.0",
            network_name=self.network.network_name,
            export_timestamp=datetime.utcnow().isoformat() + "Z",
            openagents_version=version,
            notes=notes,
            includes_password_hashes=include_password_hashes,
            includes_sensitive_config=include_sensitive_config,
            mods_count=mods_count,
            has_network_profile=has_network_profile
        )

    def _get_network_config(
        self,
        include_password_hashes: bool,
        include_sensitive_config: bool
    ) -> Dict[str, Any]:
        """Get network configuration with optional sanitization."""
        # Get base config
        if hasattr(self.network.config, 'model_dump'):
            # Use mode='json' to ensure enums and other types are serialized properly
            # exclude_none=True to avoid exporting None values which cause validation errors
            config_dict = self.network.config.model_dump(mode='json', exclude_none=True)
        elif hasattr(self.network.config, 'dict'):
            config_dict = self.network.config.dict(exclude_none=True)
        else:
            config_dict = {}
        
        # Sanitize sensitive fields
        if not include_password_hashes:
            self._strip_password_hashes(config_dict)
        
        if not include_sensitive_config:
            self._strip_sensitive_fields(config_dict)
        
        # Format for YAML export
        network_config = {"network": config_dict}
        
        return network_config

    def _get_network_profile(self, include_sensitive_config: bool) -> Optional[Dict[str, Any]]:
        """Get network profile configuration."""
        if not hasattr(self.network.config, 'network_profile') or not self.network.config.network_profile:
            return None
        
        profile = self.network.config.network_profile
        if hasattr(profile, 'model_dump'):
            # Use mode='json' to ensure enums and other types are serialized properly
            # exclude_none=True to avoid exporting None values which cause validation errors
            profile_dict = profile.model_dump(mode='json', exclude_none=True)
        elif hasattr(profile, 'dict'):
            profile_dict = profile.dict(exclude_none=True)
        else:
            profile_dict = {}
        
        if not include_sensitive_config:
            self._strip_sensitive_fields(profile_dict)
        
        return profile_dict

    def _export_mods(self, zip_file: ZipFile, include_sensitive_config: bool):
        """Export mods configuration to separate files."""
        if not self.network.config.mods:
            return
        
        for mod_config in self.network.config.mods:
            if hasattr(mod_config, 'model_dump'):
                # Use mode='json' to ensure enums and other types are serialized properly
                # exclude_none=True to avoid exporting None values which cause validation errors
                mod_dict = mod_config.model_dump(mode='json', exclude_none=True)
            elif hasattr(mod_config, 'dict'):
                mod_dict = mod_config.dict(exclude_none=True)
            else:
                continue
            
            if not include_sensitive_config:
                self._strip_sensitive_fields(mod_dict)
            
            mod_name = mod_dict.get('name', 'unknown')
            # Sanitize filename
            safe_name = mod_name.replace('/', '_').replace('\\', '_').replace('.', '_')
            filename = f"mods/{safe_name}.yaml"
            
            zip_file.writestr(filename, yaml.safe_dump(mod_dict, sort_keys=False))

    def _strip_password_hashes(self, config: Dict[str, Any]):
        """Remove password hashes from configuration."""
        # Remove from agent_groups
        if 'agent_groups' in config and isinstance(config['agent_groups'], dict):
            for group_name, group_config in config['agent_groups'].items():
                if isinstance(group_config, dict) and 'password_hash' in group_config:
                    del group_config['password_hash']
        
        # Remove network-level password hash if exists
        if 'password_hash' in config:
            del config['password_hash']

    def _strip_sensitive_fields(self, config: Dict[str, Any]):
        """Remove sensitive configuration fields."""
        # List of sensitive field names to strip (exact matches only to avoid false positives)
        sensitive_keys = [
            'agent_secret', 'api_key', 'token', 'private_key', 'certificate',
            'credentials', 'auth_token', 'access_token', 'refresh_token',
            'secret_key', 'encryption_key'
        ]
        
        def strip_recursive(obj):
            if isinstance(obj, dict):
                # Collect keys to delete
                keys_to_delete = []
                for key in obj.keys():
                    # Check if key name matches sensitive keywords (exact or contains)
                    key_lower = key.lower()
                    # Exact match or ends with sensitive key
                    if key_lower in sensitive_keys or any(
                        key_lower.endswith('_' + sensitive) or key_lower.endswith(sensitive)
                        for sensitive in sensitive_keys
                    ):
                        keys_to_delete.append(key)
                
                # Delete sensitive keys
                for key in keys_to_delete:
                    del obj[key]
                
                # Recurse into remaining values
                for value in obj.values():
                    strip_recursive(value)
            elif isinstance(obj, list):
                for item in obj:
                    strip_recursive(item)
        
        strip_recursive(config)

