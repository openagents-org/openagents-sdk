import React, { useState, useEffect, useCallback } from "react";
import { useOpenAgents } from "@/context/OpenAgentsProvider";
import { useAuthStore } from "@/stores/authStore";
import { useConfirm } from "@/context/ConfirmContext";
import { toast } from "sonner";
import { Button } from "@/components/layout/ui/button";

interface TransportConfig {
  type: "http" | "grpc" | "websocket" | "mcp";
  enabled: boolean;
  port: number;
  host: string;
  tls?: {
    enabled: boolean;
    certPath?: string;
    keyPath?: string;
  };
  // HTTP-specific configuration
  corsOrigins?: string[];
  maxBodySize?: number;
  serveMcp?: boolean;
  serveStudio?: boolean;
  // gRPC-specific configuration
  maxMessageSize?: number;
  keepAliveInterval?: number;
  // WebSocket-specific configuration
  pingInterval?: number;
  maxConnections?: number;
}

interface TransportInfo extends TransportConfig {
  url?: string;
  connectionCount?: number;
}

const TransportConfigPage: React.FC = () => {
  const { connector } = useOpenAgents();
  const { selectedNetwork } = useAuthStore();
  const { confirm } = useConfirm();

  const [transports, setTransports] = useState<TransportInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTransport, setEditingTransport] = useState<TransportInfo | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load transport information from health check data
  const fetchTransports = useCallback(async () => {
    if (!connector) {
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      const healthData = await connector.getNetworkHealth();
      const transportsData = healthData?.transports || [];

      // Convert to TransportInfo format
      const transportsList: TransportInfo[] = transportsData.map((t: any) => {
        // Extract config values - backend returns { type, config: { port, host, serve_mcp, ... } }
        const config = t.config || {};
        const host = t.host || config.host || selectedNetwork?.host || "0.0.0.0";
        const port = t.port || config.port || 8700;
        const tls = t.tls || config.tls;
        const protocol = tls?.enabled ? "https" : "http";
        let url = "";

        if (t.type === "http") {
          url = `${protocol}://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
        } else if (t.type === "grpc") {
          url = `${host === "0.0.0.0" ? "localhost" : host}:${port}`;
        } else if (t.type === "websocket") {
          const wsProtocol = tls?.enabled ? "wss" : "ws";
          url = `${wsProtocol}://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
        }

        return {
          type: t.type || "http",
          enabled: t.enabled !== false && config.enabled !== false,
          port,
          host,
          url,
          tls,
          corsOrigins: t.cors_origins || t.corsOrigins || config.cors_origins || config.corsOrigins,
          maxBodySize: t.max_body_size || t.maxBodySize || config.max_body_size || config.maxBodySize,
          serveMcp: t.serve_mcp || t.serveMcp || config.serve_mcp || config.serveMcp,
          serveStudio: t.serve_studio || t.serveStudio || config.serve_studio || config.serveStudio,
          maxMessageSize: t.max_message_size || t.maxMessageSize || config.max_message_size || config.maxMessageSize,
          keepAliveInterval: t.keepalive_interval || t.keepAliveInterval || config.keepalive_interval || config.keepAliveInterval,
          pingInterval: t.ping_interval || t.pingInterval || config.ping_interval || config.pingInterval,
          maxConnections: t.max_connections || t.maxConnections || config.max_connections || config.maxConnections,
        };
      });

      // If no transport information, add default HTTP transport
      if (transportsList.length === 0 && selectedNetwork) {
        transportsList.push({
          type: "http",
          enabled: true,
          port: selectedNetwork.port || 8700,
          host: selectedNetwork.host || "0.0.0.0",
          url: `http://${selectedNetwork.host === "0.0.0.0" ? "localhost" : selectedNetwork.host}:${selectedNetwork.port || 8700}`,
        });
      }

      setTransports(transportsList);
    } catch (error) {
      console.error("Failed to fetch transports:", error);
      toast.error("Failed to load transport configuration");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [connector, selectedNetwork]);

  useEffect(() => {
    fetchTransports();
  }, [fetchTransports]);

  // Copy URL to clipboard
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  };

  // Toggle transport enable/disable status
  const handleToggleTransport = async (transport: TransportInfo) => {
    const action = transport.enabled ? "disable" : "enable";
    const confirmed = await confirm(
      `${action === "enable" ? "Enable" : "Disable"} Transport`,
      `Are you sure you want to ${action} the ${transport.type.toUpperCase()} transport? Network restart may be required.`,
      {
        type: "warning",
        confirmText: action === "enable" ? "Enable" : "Disable",
      }
    );

    if (!confirmed) {
      return;
    }

    // TODO: Call API to update transport status
    toast.info(`Transport ${action} requested (not implemented yet)`);
    
    // Temporarily update local state
    setTransports((prev) =>
      prev.map((t) =>
        t.type === transport.type ? { ...t, enabled: !t.enabled } : t
      )
    );
  };

  // Edit transport configuration
  const handleEditTransport = (transport: TransportInfo) => {
    setEditingTransport(transport);
  };

  // Delete transport
  const handleDeleteTransport = async (transport: TransportInfo) => {
    const confirmed = await confirm(
      "Delete Transport",
      `Are you sure you want to delete the ${transport.type.toUpperCase()} transport? This action cannot be undone.`,
      {
        type: "danger",
        confirmText: "Delete",
      }
    );

    if (!confirmed) {
      return;
    }

    // TODO: Call API to delete transport
    toast.info("Transport deletion requested (not implemented yet)");
    
    // Temporarily update local state
    setTransports((prev) => prev.filter((t) => t.type !== transport.type));
  };

  // Save transport configuration
  const handleSaveTransport = (updatedTransport: TransportInfo) => {
    // TODO: Call API to save configuration
    toast.info("Transport configuration saved (not implemented yet)");
    
    // Temporarily update local state
    setTransports((prev) =>
      prev.map((t) =>
        t.type === updatedTransport.type ? updatedTransport : t
      )
    );
    
    setEditingTransport(null);
  };

  // Add new transport
  const handleAddTransport = (newTransport: TransportInfo) => {
    // TODO: Call API to add transport
    toast.info("New transport added (not implemented yet)");
    
    // Temporarily update local state
    setTransports((prev) => [...prev, newTransport]);
    setShowAddModal(false);
  };

  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading transport configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Transport Configuration
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage network transport layers (HTTP, gRPC, WebSocket)
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            onClick={fetchTransports}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <svg
              className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>

          <Button
            onClick={() => setShowAddModal(true)}
            variant="primary"
            size="sm"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add New Transport
          </Button>
        </div>
      </div>

      {/* Network Info */}
      {selectedNetwork && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            Network: {selectedNetwork.host}:{selectedNetwork.port}
          </div>
        </div>
      )}

      {/* Warning Banner */}
      <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 text-amber-400 mr-2 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Transport changes require network restart
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Any changes to transport configuration will take effect after restarting the network.
            </p>
          </div>
        </div>
      </div>

      {/* Transport Cards */}
      <div className="space-y-4">
        {transports.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">
              No transports configured. Click "Add New Transport" to add one.
            </p>
          </div>
        ) : (
          transports.map((transport) => (
            <TransportCard
              key={transport.type}
              transport={transport}
              onToggle={handleToggleTransport}
              onEdit={handleEditTransport}
              onDelete={handleDeleteTransport}
              onCopyUrl={handleCopyUrl}
            />
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editingTransport && (
        <TransportEditModal
          transport={editingTransport}
          onSave={handleSaveTransport}
          onClose={() => setEditingTransport(null)}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <TransportAddModal
          existingTypes={transports.map((t) => t.type)}
          onSave={handleAddTransport}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};

// Transport Card Component
interface TransportCardProps {
  transport: TransportInfo;
  onToggle: (transport: TransportInfo) => void;
  onEdit: (transport: TransportInfo) => void;
  onDelete: (transport: TransportInfo) => void;
  onCopyUrl: (url: string) => void;
}

const TransportCard: React.FC<TransportCardProps> = ({
  transport,
  onToggle,
  onEdit,
  onDelete,
  onCopyUrl,
}) => {
  const getTransportIcon = (type: string) => {
    switch (type) {
      case "http":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        );
      case "grpc":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case "websocket":
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${transport.enabled ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-gray-700"}`}>
            <div className={`${transport.enabled ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
              {getTransportIcon(transport.type)}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {transport.type.toUpperCase()} Transport
            </h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${transport.enabled ? "bg-green-500" : "bg-gray-400"}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {transport.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={transport.enabled}
            onChange={() => onToggle(transport)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Port:</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{transport.port}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Host:</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{transport.host}</span>
          </div>
          {transport.url && (
            <div className="col-span-2">
              <span className="text-gray-500 dark:text-gray-400">URL:</span>
              <div className="flex items-center space-x-2 mt-1">
                <code className="flex-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-900 dark:text-gray-100 truncate">
                  {transport.url}
                </code>
                <Button
                  onClick={() => onCopyUrl(transport.url!)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  title="Copy URL"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Transport-specific configurations */}
        {transport.type === "http" && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2 text-sm">
            {transport.corsOrigins && transport.corsOrigins.length > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">CORS Origins:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">{transport.corsOrigins.join(", ")}</span>
              </div>
            )}
            {transport.serveMcp && (
              <div className="flex items-center space-x-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span className="text-gray-600 dark:text-gray-400">MCP Protocol Enabled</span>
              </div>
            )}
            {transport.serveStudio && (
              <div className="flex items-center space-x-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span className="text-gray-600 dark:text-gray-400">Studio Frontend Enabled</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center space-x-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={() => onEdit(transport)}
            variant="ghost"
            size="sm"
            className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
          >
            Edit Configuration
          </Button>
          <Button
            onClick={() => onDelete(transport)}
            variant="ghost"
            size="sm"
            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
};

// Transport Edit Modal Component
interface TransportEditModalProps {
  transport: TransportInfo;
  onSave: (transport: TransportInfo) => void;
  onClose: () => void;
}

const TransportEditModal: React.FC<TransportEditModalProps> = ({
  transport,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<TransportInfo>({ ...transport });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Edit {transport.type.toUpperCase()} Transport
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Basic Configuration */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Port
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 0 })}
                min="1"
                max="65535"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Host
              </label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            {/* HTTP-specific fields */}
            {formData.type === "http" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    CORS Origins (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.corsOrigins?.join(", ") || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        corsOrigins: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="*, http://localhost:3000"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="serveMcp"
                    checked={formData.serveMcp || false}
                    onChange={(e) => setFormData({ ...formData, serveMcp: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <label htmlFor="serveMcp" className="text-sm text-gray-700 dark:text-gray-300">
                    Serve MCP Protocol
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="serveStudio"
                    checked={formData.serveStudio || false}
                    onChange={(e) => setFormData({ ...formData, serveStudio: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <label htmlFor="serveStudio" className="text-sm text-gray-700 dark:text-gray-300">
                    Serve Studio Frontend
                  </label>
                </div>
              </>
            )}

            {/* gRPC-specific fields */}
            {formData.type === "grpc" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Message Size (bytes)
                </label>
                <input
                  type="number"
                  value={formData.maxMessageSize || 104857600}
                  onChange={(e) => setFormData({ ...formData, maxMessageSize: parseInt(e.target.value) || 0 })}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            )}

            {/* WebSocket-specific fields */}
            {formData.type === "websocket" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ping Interval (ms)
                  </label>
                  <input
                    type="number"
                    value={formData.pingInterval || 30000}
                    onChange={(e) => setFormData({ ...formData, pingInterval: parseInt(e.target.value) || 0 })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Connections
                  </label>
                  <input
                    type="number"
                    value={formData.maxConnections || 100}
                    onChange={(e) => setFormData({ ...formData, maxConnections: parseInt(e.target.value) || 0 })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Transport Add Modal Component
interface TransportAddModalProps {
  existingTypes: string[];
  onSave: (transport: TransportInfo) => void;
  onClose: () => void;
}

const TransportAddModal: React.FC<TransportAddModalProps> = ({
  existingTypes,
  onSave,
  onClose,
}) => {
  const availableTypes: ("http" | "grpc" | "websocket")[] = ["http", "grpc", "websocket"];
  const [selectedType, setSelectedType] = useState<"http" | "grpc" | "websocket">("http");
  const [port, setPort] = useState(8700);
  const [host, setHost] = useState("0.0.0.0");

  const getDefaultPort = (type: string): number => {
    switch (type) {
      case "http":
        return 8700;
      case "grpc":
        return 8600;
      case "websocket":
        return 8400;
      default:
        return 8700;
    }
  };

  const handleTypeChange = (type: "http" | "grpc" | "websocket") => {
    setSelectedType(type);
    setPort(getDefaultPort(type));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTransport: TransportInfo = {
      type: selectedType,
      enabled: true,
      port,
      host,
    };
    onSave(newTransport);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Add New Transport
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Transport Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value as "http" | "grpc" | "websocket")}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {availableTypes
                .filter((type) => !existingTypes.includes(type))
                .map((type) => (
                  <option key={type} value={type}>
                    {type.toUpperCase()}
                  </option>
                ))}
            </select>
            {existingTypes.includes(selectedType) && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                This transport type already exists
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Port
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 0)}
              min="1"
              max="65535"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Host
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={existingTypes.includes(selectedType)}
              variant="primary"
            >
              Add Transport
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransportConfigPage;

