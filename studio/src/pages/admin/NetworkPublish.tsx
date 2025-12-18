import React, { useState, useCallback, useEffect } from "react";
import { useOpenAgents } from "@/context/OpenAgentsProvider";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface ValidationResult {
  success: boolean;
  message?: string;
  networkName?: string;
  onlineAgents?: number;
  mods?: string[];
}

const OPENAGENTS_API_BASE = "https://endpoint.openagents.org/v1";

const NetworkPublishPage: React.FC = () => {
  const { t } = useTranslation("admin");
  useOpenAgents(); // Ensure OpenAgents context is available
  const { selectedNetwork, moduleState } = useAuthStore();

  // Form state
  const [networkId, setNetworkId] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [organization, setOrganization] = useState("");
  const [networkHost, setNetworkHost] = useState("");
  const [networkPort, setNetworkPort] = useState("");

  // UI state
  const [isValidating, setIsValidating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidated, setIsValidated] = useState(false);

  // Pre-fill form with current network info
  useEffect(() => {
    if (selectedNetwork) {
      setNetworkHost(selectedNetwork.host || "");
      setNetworkPort(selectedNetwork.port?.toString() || "8700");
    }
    if (moduleState.networkId) {
      setNetworkId(moduleState.networkId);
    }
    if (moduleState.networkName) {
      setNetworkName(moduleState.networkName);
    }
  }, [selectedNetwork, moduleState]);

  // Reset validation when form changes
  useEffect(() => {
    setIsValidated(false);
    setValidationResult(null);
  }, [networkId, networkHost, networkPort, organization]);

  // Validate network configuration
  const handleValidate = useCallback(async () => {
    // Basic validation
    if (!networkId.trim()) {
      toast.error(t("publish.errors.networkIdRequired", "Network ID is required"));
      return;
    }
    if (!networkHost.trim()) {
      toast.error(t("publish.errors.hostRequired", "Host is required"));
      return;
    }
    if (!networkPort.trim()) {
      toast.error(t("publish.errors.portRequired", "Port is required"));
      return;
    }

    const port = parseInt(networkPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      toast.error(t("publish.errors.invalidPort", "Port must be between 1 and 65535"));
      return;
    }

    if (networkId.length < 7) {
      toast.error(t("publish.errors.networkIdTooShort", "Network ID must be at least 7 characters"));
      return;
    }

    if (!organization.trim()) {
      toast.error(t("publish.errors.organizationRequired", "Organization is required"));
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      // First, check if the network health endpoint is reachable
      const protocol = selectedNetwork?.useHttps ? "https" : "http";
      const healthUrl = `${protocol}://${networkHost}:${port}/api/health`;

      let healthData: any = null;
      try {
        const healthResponse = await fetch(healthUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!healthResponse.ok) {
          setValidationResult({
            success: false,
            message: t("publish.errors.healthCheckFailed", `Health check failed with status ${healthResponse.status}`),
          });
          return;
        }

        healthData = await healthResponse.json();
      } catch (error: any) {
        setValidationResult({
          success: false,
          message: t("publish.errors.networkUnreachable", `Cannot reach network at ${networkHost}:${port}. Make sure it's running and accessible.`),
        });
        return;
      }

      // Call the OpenAgents API to validate
      const response = await fetch(`${OPENAGENTS_API_BASE}/networks/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          network_id: networkId,
          network_host: networkHost,
          network_port: port.toString(),
          org: organization,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const result = await response.json();

      if (response.ok && result.code === 200) {
        setValidationResult({
          success: true,
          message: t("publish.validation.success", "Network configuration is valid!"),
          networkName: healthData?.data?.network_name || networkName,
          onlineAgents: healthData?.data?.agent_count || 0,
          mods: healthData?.data?.mods?.filter((m: any) => m.enabled).map((m: any) => m.name) || [],
        });
        setIsValidated(true);
        toast.success(t("publish.validation.successToast", "Validation successful!"));
      } else {
        setValidationResult({
          success: false,
          message: result.message || t("publish.errors.validationFailed", "Validation failed"),
        });
      }
    } catch (error: any) {
      console.error("Validation error:", error);
      setValidationResult({
        success: false,
        message: error.message || t("publish.errors.validationError", "An error occurred during validation"),
      });
    } finally {
      setIsValidating(false);
    }
  }, [networkId, networkHost, networkPort, organization, networkName, selectedNetwork, t]);

  // Publish network
  const handlePublish = useCallback(async () => {
    if (!isValidated) {
      toast.error(t("publish.errors.validateFirst", "Please validate the configuration first"));
      return;
    }

    setIsPublishing(true);

    try {
      const port = parseInt(networkPort, 10);

      const response = await fetch(`${OPENAGENTS_API_BASE}/networks/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          network_id: networkId,
          network_name: networkName || validationResult?.networkName || networkId,
          network_host: networkHost,
          network_port: port.toString(),
          org: organization,
        }),
        signal: AbortSignal.timeout(30000),
      });

      const result = await response.json();

      if (response.ok && result.code === 200) {
        toast.success(t("publish.success", "Network published successfully!"));
        setIsValidated(false);
        setValidationResult(null);
      } else {
        toast.error(result.message || t("publish.errors.publishFailed", "Failed to publish network"));
      }
    } catch (error: any) {
      console.error("Publish error:", error);
      toast.error(error.message || t("publish.errors.publishError", "An error occurred while publishing"));
    } finally {
      setIsPublishing(false);
    }
  }, [isValidated, networkId, networkName, networkHost, networkPort, organization, validationResult, t]);

  return (
    <div className="p-6 h-full overflow-y-auto dark:bg-gray-900">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t("publish.title", "Publish Network")}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t("publish.subtitle", "Publish your network to the OpenAgents directory to make it discoverable by others.")}
        </p>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-6">
            {/* Network ID */}
            <div>
              <label
                htmlFor="networkId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t("publish.form.networkId", "Network ID")} *
              </label>
              <input
                type="text"
                id="networkId"
                value={networkId}
                onChange={(e) => setNetworkId(e.target.value)}
                placeholder={t("publish.form.networkIdPlaceholder", "e.g., my-awesome-network")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("publish.form.networkIdHelp", "Unique identifier for your network (min 7 characters)")}
              </p>
            </div>

            {/* Network Name */}
            <div>
              <label
                htmlFor="networkName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t("publish.form.networkName", "Network Name")}
              </label>
              <input
                type="text"
                id="networkName"
                value={networkName}
                onChange={(e) => setNetworkName(e.target.value)}
                placeholder={t("publish.form.networkNamePlaceholder", "e.g., My Awesome Network")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("publish.form.networkNameHelp", "Display name for your network (optional, auto-detected from health endpoint)")}
              </p>
            </div>

            {/* Organization */}
            <div>
              <label
                htmlFor="organization"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t("publish.form.organization", "Organization")} *
              </label>
              <input
                type="text"
                id="organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder={t("publish.form.organizationPlaceholder", "e.g., openagents")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("publish.form.organizationHelp", "Your organization identifier on OpenAgents")}
              </p>
            </div>

            {/* Host and Port */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="networkHost"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t("publish.form.host", "Host")} *
                </label>
                <input
                  type="text"
                  id="networkHost"
                  value={networkHost}
                  onChange={(e) => setNetworkHost(e.target.value)}
                  placeholder={t("publish.form.hostPlaceholder", "e.g., mynetwork.example.com")}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="networkPort"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t("publish.form.port", "Port")} *
                </label>
                <input
                  type="number"
                  id="networkPort"
                  value={networkPort}
                  onChange={(e) => setNetworkPort(e.target.value)}
                  placeholder="8700"
                  min={1}
                  max={65535}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Validation Result */}
            {validationResult && (
              <div
                className={`p-4 rounded-lg ${
                  validationResult.success
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                }`}
              >
                <div className="flex items-start">
                  {validationResult.success ? (
                    <svg
                      className="w-5 h-5 text-green-500 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 text-red-500 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                  <div className="ml-3">
                    <p
                      className={`text-sm font-medium ${
                        validationResult.success
                          ? "text-green-800 dark:text-green-200"
                          : "text-red-800 dark:text-red-200"
                      }`}
                    >
                      {validationResult.message}
                    </p>
                    {validationResult.success && (
                      <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                        {validationResult.networkName && (
                          <p>
                            <span className="font-medium">{t("publish.validation.detectedName", "Detected Name:")}</span>{" "}
                            {validationResult.networkName}
                          </p>
                        )}
                        {validationResult.onlineAgents !== undefined && (
                          <p>
                            <span className="font-medium">{t("publish.validation.onlineAgents", "Online Agents:")}</span>{" "}
                            {validationResult.onlineAgents}
                          </p>
                        )}
                        {validationResult.mods && validationResult.mods.length > 0 && (
                          <p>
                            <span className="font-medium">{t("publish.validation.enabledMods", "Enabled Mods:")}</span>{" "}
                            {validationResult.mods.join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleValidate}
                disabled={isValidating || isPublishing}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isValidating ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t("publish.buttons.validating", "Validating...")}
                  </span>
                ) : (
                  t("publish.buttons.validate", "Validate Configuration")
                )}
              </button>

              <button
                type="button"
                onClick={handlePublish}
                disabled={!isValidated || isPublishing || isValidating}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPublishing ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t("publish.buttons.publishing", "Publishing...")}
                  </span>
                ) : (
                  t("publish.buttons.publish", "Publish Network")
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex">
            <svg
              className="w-5 h-5 text-blue-500 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {t("publish.info.title", "About Publishing")}
              </h3>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p>{t("publish.info.point1", "Your network must be publicly accessible at the specified host and port.")}</p>
                <p>{t("publish.info.point2", "The health endpoint (/api/health) must be reachable for validation.")}</p>
                <p>{t("publish.info.point3", "Published networks will appear in the OpenAgents directory.")}</p>
                <p>{t("publish.info.point4", "You need to be registered with an organization on OpenAgents to publish.")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkPublishPage;
