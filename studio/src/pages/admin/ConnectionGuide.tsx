import React, { useState, useEffect, useCallback } from "react";
import { useOpenAgents } from "@/context/OpenAgentsProvider";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";

interface TransportInfo {
  type: string;
  enabled: boolean;
  port: number;
  host: string;
  url?: string;
}

interface ConnectionGuideData {
  transports: TransportInfo[];
  groups: string[];
  requiresPassword: boolean;
  defaultGroup: string;
  recommendedTransport?: string;
}

const ConnectionGuide: React.FC = () => {
  const { connector } = useOpenAgents();
  const { selectedNetwork } = useAuthStore();

  const [data, setData] = useState<ConnectionGuideData>({
    transports: [],
    groups: [],
    requiresPassword: false,
    defaultGroup: "default",
  });
  const [loading, setLoading] = useState(true);
  const [selectedExample, setSelectedExample] = useState<"python" | "langchain" | "mcp" | "http">("python");
  const [selectedTransport, setSelectedTransport] = useState<string>("");

  // Load connection guide data
  const fetchGuideData = useCallback(async () => {
    if (!connector) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const healthData = await connector.getNetworkHealth();

      // Get transport information
      const transportsData = healthData?.data?.transports || [];
      const transportsList: TransportInfo[] = transportsData
        .filter((t: any) => t.enabled !== false)
        .map((t: any) => {
          const host = t.host || selectedNetwork?.host || "0.0.0.0";
          const port = t.port || t.config?.port || 8700;
          const protocol = t.tls?.enabled ? "https" : "http";
          let url = "";

          if (t.type === "http") {
            url = `${protocol}://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
          } else if (t.type === "grpc") {
            url = `${host === "0.0.0.0" ? "localhost" : host}:${port}`;
          } else if (t.type === "websocket") {
            const wsProtocol = t.tls?.enabled ? "wss" : "ws";
            url = `${wsProtocol}://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
          }

          return {
            type: t.type || "http",
            enabled: true,
            port,
            host,
            url,
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

      // Get agent group information
      const groups = healthData?.data?.groups
        ? Object.keys(healthData.data.groups)
        : healthData?.groups
        ? Object.keys(healthData.groups)
        : [];

      // Get password requirement and default group
      const requiresPassword = healthData?.data?.requires_password || false;
      const defaultGroup = healthData?.data?.default_agent_group || "default";
      const recommendedTransport = healthData?.data?.recommended_transport || transportsList[0]?.type || "http";

      // Set default selected transport (only on first load)
      if (transportsList.length > 0 && !selectedTransport) {
        setSelectedTransport(recommendedTransport || transportsList[0].type);
      }

      setData({
        transports: transportsList,
        groups,
        requiresPassword,
        defaultGroup,
        recommendedTransport,
      });
    } catch (error) {
      console.error("Failed to fetch connection guide data:", error);
      toast.error("Failed to load connection guide");
    } finally {
      setLoading(false);
    }
  }, [connector, selectedNetwork, selectedTransport]);

  useEffect(() => {
    fetchGuideData();
  }, [fetchGuideData]);

  // Get currently selected transport
  const currentTransport = data.transports.find((t) => t.type === selectedTransport) || data.transports[0];

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  // Copy URL to clipboard
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  };

  // Generate Python code example
  const generatePythonCode = (): string => {
    if (!currentTransport) return "";

    const host = currentTransport.host === "0.0.0.0" ? "localhost" : currentTransport.host;
    const port = currentTransport.port;

    if (currentTransport.type === "http") {
      return `from openagents import AgentRunner

runner = AgentRunner(agent_id="my-agent")
await runner.async_start(host="${host}", port=${port})`;
    } else if (currentTransport.type === "grpc") {
      return `from openagents import AgentRunner

runner = AgentRunner(agent_id="my-agent")
await runner.async_start(host="${host}", port=${port})`;
    } else {
      return `from openagents import AgentRunner

runner = AgentRunner(agent_id="my-agent")
await runner.async_start(host="${host}", port=${port})`;
    }
  };

  // Generate Python code example with authentication
  const generatePythonCodeWithAuth = (): string => {
    if (!currentTransport) return "";

    const host = currentTransport.host === "0.0.0.0" ? "localhost" : currentTransport.host;
    const port = currentTransport.port;
    const group = data.groups.length > 0 ? data.groups[0] : "default";

    return `from openagents import AgentRunner
from openagents.utils.password_utils import hash_password

runner = AgentRunner(
    agent_id="my-agent",
    agent_group="${group}",
    password="your_password_here"
)
await runner.async_start(host="${host}", port=${port})`;
  };

  // Generate LangChain integration code
  const generateLangChainCode = (): string => {
    if (!currentTransport) return "";

    const host = currentTransport.host === "0.0.0.0" ? "localhost" : currentTransport.host;
    const port = currentTransport.port;

    return `from langchain.agents import initialize_agent
from openagents.langchain import OpenAgentsTool

# Create OpenAgents tool
openagents_tool = OpenAgentsTool(
    host="${host}",
    port=${port},
    agent_id="my-agent"
)

# Initialize agent with tool
agent = initialize_agent(
    tools=[openagents_tool],
    llm=llm,
    agent="zero-shot-react-description"
)`;
  };

  // Generate MCP Client code
  const generateMCPCode = (): string => {
    if (!currentTransport || currentTransport.type !== "http") return "";

    const url = currentTransport.url || `http://${currentTransport.host === "0.0.0.0" ? "localhost" : currentTransport.host}:${currentTransport.port}`;

    return `import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Connect to OpenAgents network via MCP
const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "@openagents/mcp-server", "--url", "${url}/mcp"]
});

const client = new Client({
  name: "my-mcp-client",
  version: "1.0.0"
}, {
  capabilities: {}
});

await client.connect(transport);`;
  };

  // Generate HTTP API code
  const generateHTTPCode = (): string => {
    if (!currentTransport) return "";

    const url = currentTransport.url || `http://${currentTransport.host === "0.0.0.0" ? "localhost" : currentTransport.host}:${currentTransport.port}`;

    return `import requests

# Register agent
response = requests.post("${url}/api/register", json={
    "agent_id": "my-agent",
    "metadata": {},
    "password_hash": "your_password_hash_here"  # Optional
})

# Send event
response = requests.post("${url}/api/send_event", json={
    "event_name": "mod:example.event",
    "source_id": "my-agent",
    "payload": {"message": "Hello, network!"}
})

# Poll for messages
response = requests.get("${url}/api/poll?agent_id=my-agent")
messages = response.json()`;
  };

  // Get current code example
  const getCurrentCode = (): string => {
    switch (selectedExample) {
      case "python":
        return data.requiresPassword ? generatePythonCodeWithAuth() : generatePythonCode();
      case "langchain":
        return generateLangChainCode();
      case "mcp":
        return generateMCPCode();
      case "http":
        return generateHTTPCode();
      default:
        return generatePythonCode();
    }
  };

  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading connection guide...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto dark:bg-gray-800">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Connect to Network
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Step-by-step guide for connecting agents to this network
        </p>
      </div>

      {/* Network Info */}
      {selectedNetwork && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            Network: {selectedNetwork.host}:{selectedNetwork.port}
          </div>
        </div>
      )}

      {/* Quick Start */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Start</h2>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <pre className="text-sm text-gray-900 dark:text-gray-100 font-mono whitespace-pre-wrap overflow-x-auto">
                <code>{getCurrentCode()}</code>
              </pre>
            </div>
            <button
              onClick={() => handleCopyCode(getCurrentCode())}
              className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Copy Code
            </button>
          </div>
          <div className="flex space-x-2 mt-4">
            <button
              onClick={() => setSelectedExample("python")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                selectedExample === "python"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              Python
            </button>
            <button
              onClick={() => setSelectedExample("langchain")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                selectedExample === "langchain"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              LangChain
            </button>
            <button
              onClick={() => setSelectedExample("mcp")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                selectedExample === "mcp"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              MCP Client
            </button>
            <button
              onClick={() => setSelectedExample("http")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                selectedExample === "http"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              HTTP API
            </button>
          </div>
        </div>
      </section>

      {/* Available Transports */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Available Transports</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.transports.map((transport) => (
            <div
              key={transport.type}
              className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                selectedTransport === transport.type
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
              onClick={() => setSelectedTransport(transport.type)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {transport.type.toUpperCase()}
                </h3>
                {transport.type === data.recommendedTransport && (
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                    Recommended
                  </span>
                )}
              </div>
              {transport.url ? (
                <div className="flex items-center space-x-2 mt-2">
                  <code className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                    {transport.url}
                  </code>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyUrl(transport.url!);
                    }}
                    className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                    title="Copy URL"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Disabled</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Authentication */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Authentication</h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-4">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password Required: </span>
              <span className={`text-sm font-semibold ${data.requiresPassword ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                {data.requiresPassword ? "Yes" : "No"}
              </span>
            </div>
            {data.groups.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Available Groups: </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {data.groups.map((group) => (
                    <span
                      key={group}
                      className={`px-3 py-1 rounded-full text-sm ${
                        group === data.defaultGroup
                          ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {group} {group === data.defaultGroup && "(default)"}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.requiresPassword && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Note:</strong> All agents must provide a valid password hash during registration.
                  Use <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900 rounded">hash_password()</code> to generate the hash.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Troubleshooting</h2>
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Common Connection Errors</h3>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                <span><strong>Connection refused:</strong> Verify the network is running and the host/port are correct.</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                <span><strong>Timeout:</strong> Check network connectivity and firewall settings.</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                <span><strong>Agent ID already exists:</strong> Use a unique agent ID or disconnect the existing agent first.</span>
              </li>
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Firewall / Port Issues</h3>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>Ensure the network ports are open in your firewall: {data.transports.map((t) => t.port).join(", ")}</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>For localhost connections, verify the network is binding to <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">0.0.0.0</code> or <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">127.0.0.1</code></span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>Check if other services are using the same ports: <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">netstat -an | grep {currentTransport?.port || 8700}</code></span>
              </li>
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Authentication Failures</h3>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="text-yellow-500 mr-2">•</span>
                <span><strong>Invalid password:</strong> Verify you're using the correct password for the agent group.</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-500 mr-2">•</span>
                <span><strong>Group not found:</strong> Check available groups and ensure the group name is correct.</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-500 mr-2">•</span>
                <span><strong>Password required:</strong> If the network requires passwords, ensure you provide a <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">password_hash</code> during registration.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ConnectionGuide;

