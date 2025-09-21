import { useEffect } from 'react';
import { useModStore } from '@/stores/modStore';
import { useNetworkStore } from '@/stores/networkStore';
import { checkNetworkHealth } from '@/services/networkService';
import { updateRouteVisibility } from '@/config/routeConfig';
import { PLUGIN_NAME_ENUM } from '@/types/plugins';
import { triggerRouteUpdate } from './useRouteUpdates';

export const useModDetection = () => {
  const { setNetworkHealth, modAvailability } = useModStore();
  const { selectedNetwork } = useNetworkStore();

  useEffect(() => {
    const detectMods = async () => {
      if (!selectedNetwork?.host || !selectedNetwork?.port) {
        console.log('No network connection available for mod detection');
        return;
      }

      try {
        console.log('Checking for available mods on:', selectedNetwork.host, selectedNetwork.port); 
        const health = await checkNetworkHealth(
          selectedNetwork.host,
          selectedNetwork.port
        );

        if (health) {
          console.log('Network health check completed:', health);
          setNetworkHealth(health);
          
          // Update route visibility based on mod availability
          updateRouteVisibility(PLUGIN_NAME_ENUM.FORUM, health.forum_available || false);
          updateRouteVisibility(PLUGIN_NAME_ENUM.WIKI, health.wiki_available || false);
          
          // Trigger UI updates
          triggerRouteUpdate();
          
          console.log(`Forum mod ${health.forum_available ? 'enabled' : 'disabled'}`);
          console.log(`Wiki mod ${health.wiki_available ? 'enabled' : 'disabled'}`);
        } else {
          console.log('Failed to get network health information');
          // Disable mods if health check fails
          updateRouteVisibility(PLUGIN_NAME_ENUM.FORUM, false);
          updateRouteVisibility(PLUGIN_NAME_ENUM.WIKI, false);
          triggerRouteUpdate();
        }
      } catch (error) {
        console.error('Error during mod detection:', error);
        // Disable mods on error
        updateRouteVisibility(PLUGIN_NAME_ENUM.FORUM, false);
        updateRouteVisibility(PLUGIN_NAME_ENUM.WIKI, false);
        triggerRouteUpdate();
      }
    };

    // Run detection when network is available
    if (selectedNetwork?.host && selectedNetwork?.port) {
      console.log('Network available, starting mod detection...');
      detectMods();
    } else {
      console.log('Network not available:', selectedNetwork);
    }
  }, [selectedNetwork, setNetworkHealth]);

  // Return current mod availability for components to use
  return {
    forumAvailable: modAvailability.forum,
    wikiAvailable: modAvailability.wiki,
    lastChecked: modAvailability.lastChecked
  };
};