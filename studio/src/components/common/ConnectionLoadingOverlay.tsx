import React, { useCallback, useMemo, useContext } from "react";
import {
  ConnectionState,
  OpenAgentsContext,
} from "@/contexts/OpenAgentsProvider";
import { useAuthStore } from "../../stores/authStore";

const ConnectionLoadingOverlay: React.FC = () => {
  const context = useContext(OpenAgentsContext);
  const { agentName } = useAuthStore();

  const currentStatus = useMemo(
    () => context?.connectionStatus.state || ConnectionState.DISCONNECTED,
    [context?.connectionStatus.state]
  );

  const isError = useMemo(
    () => currentStatus === ConnectionState.ERROR,
    [currentStatus]
  );

  const onRetry = useCallback(async () => {
    if (context?.connect) {
      await context.connect();
    } else {
      window.location.reload();
    }
  }, [context]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">
          Connecting as {agentName || ""}...
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Status: {currentStatus}
        </p>
        {isError && (
          <div className="mt-4">
            <p className="text-red-600 dark:text-red-400 text-sm mb-2">
              Connection failed. Please try again.
            </p>
            <button
              onClick={() => onRetry()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionLoadingOverlay;
