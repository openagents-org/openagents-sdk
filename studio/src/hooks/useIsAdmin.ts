import { useState, useEffect } from 'react';
import { useOpenAgents } from '@/context/OpenAgentsProvider';
import { useAuthStore } from '@/stores/authStore';

interface UseIsAdminResult {
  isAdmin: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Custom hook to check if current user is an admin
 * Checks if agentName exists in groups.admin array from /api/health
 */
export const useIsAdmin = (): UseIsAdminResult => {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { connector } = useOpenAgents();
  const { agentName } = useAuthStore();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!connector || !agentName) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const healthData = await connector.getNetworkHealth();

        if (healthData && healthData.groups && healthData.groups.admin) {
          // Check if current agentName is in the admin group array
          const adminAgents = healthData.groups.admin;
          const isUserAdmin = Array.isArray(adminAgents) && adminAgents.includes(agentName);
          setIsAdmin(isUserAdmin);

          console.log(`🔐 Admin check: agentName=${agentName}, isAdmin=${isUserAdmin}`);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Failed to check admin status:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [connector, agentName]);

  return { isAdmin, isLoading, error };
};
