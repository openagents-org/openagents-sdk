import React from "react";
import { profileSelectors } from "@/stores/profileStore";
import { useAuthStore } from "@/stores/authStore";

const NetworkInfoCard: React.FC = () => {
  const { selectedNetwork } = useAuthStore();
  const networkInfo = profileSelectors.useNetworkInfo();
  const isOnline = profileSelectors.useIsOnline();
  const connectionLatency = profileSelectors.useConnectionLatency();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Network Information
        </h3>
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isOnline ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Network Connection */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Connection
          </h4>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <div className="grid grid-cols-1 gap-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Host:</span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                  {selectedNetwork?.host || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Port:</span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                  {selectedNetwork?.port || "N/A"}
                </span>
              </div>
              {connectionLatency && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Latency:</span>
                  <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                    {connectionLatency}ms
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Network Details */}
        {networkInfo && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Network Details
            </h4>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
              <div className="grid grid-cols-1 gap-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Network ID:</span>
                  <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                    {networkInfo.networkId || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Network Name:</span>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {networkInfo.networkName || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                  <span className={`text-sm font-medium ${
                    networkInfo.isRunning
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {networkInfo.isRunning ? "Running" : "Stopped"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Health Status:</span>
                  <span className={`text-sm font-medium ${
                    networkInfo.status === "healthy"
                      ? "text-green-600 dark:text-green-400"
                      : "text-yellow-600 dark:text-yellow-400"
                  }`}>
                    {networkInfo.status || "Unknown"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Data State */}
        {!networkInfo && !selectedNetwork && (
          <div className="text-center py-8">
            <div className="text-gray-400 dark:text-gray-500 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No network connection available
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkInfoCard;