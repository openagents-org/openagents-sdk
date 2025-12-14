import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useOpenAgents } from "@/context/OpenAgentsProvider";
import { useAuthStore } from "@/stores/authStore";
import { useConfirm } from "@/context/ConfirmContext";
import { toast } from "sonner";

interface DashboardStats {
  totalAgents: number;
  onlineAgents: number;
  activeChannels: number;
  totalChannels: number;
  uptime: string;
  eventsPerMinute: number;
  totalGroups: number;
}

interface RecentActivity {
  timestamp: string;
  message: string;
  type: "connect" | "disconnect" | "config" | "system";
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { connector } = useOpenAgents();
  const { selectedNetwork, agentName } = useAuthStore();
  const { confirm } = useConfirm();

  const [stats, setStats] = useState<DashboardStats>({
    totalAgents: 0,
    onlineAgents: 0,
    activeChannels: 0,
    totalChannels: 0,
    uptime: "0h 0m",
    eventsPerMinute: 0,
    totalGroups: 0,
  });

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    if (!connector) {
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      const healthData = await connector.getNetworkHealth();

      // Calculate stats from health data
      const agents = healthData?.agents || {};
      const agentsList = Object.values(agents);
      const totalAgents = agentsList.length;
      const onlineAgents = agentsList.filter(
        (agent: any) =>
          agent.status === "online" || agent.status === "connected"
      ).length;

      // Get channels (if available in health data)
      const channels = healthData?.channels || {};
      const totalChannels = Object.keys(channels).length;
      const activeChannels = Object.values(channels).filter(
        (channel: any) => channel.active !== false
      ).length;

      // Get groups count
      const groups = healthData?.groups || {};
      const totalGroups = Object.keys(groups).length;

      // Get uptime from health data and format to 3 decimal places
      const uptimeSeconds = healthData?.uptime_seconds;
      console.log("healthData", healthData);
      const uptime =
        uptimeSeconds !== undefined && uptimeSeconds !== null
          ? `${Number(uptimeSeconds).toFixed(3)}s`
          : "N/A";
      console.log("uptime", uptime);
      // Events per minute (simplified)
      const eventsPerMinute = 0; // TODO: Calculate from event logs

      setStats({
        totalAgents,
        onlineAgents,
        activeChannels,
        totalChannels,
        uptime,
        eventsPerMinute,
        totalGroups,
      });

      // Generate mock recent activities (in real app, fetch from event logs)
      const mockActivities: RecentActivity[] = [
        {
          timestamp: new Date().toLocaleTimeString(),
          message: "System initialized",
          type: "system",
        },
      ];

      // Add agent connection activities
      agentsList.slice(0, 5).forEach((agent: any, index: number) => {
        mockActivities.unshift({
          timestamp: new Date(Date.now() - index * 60000).toLocaleTimeString(),
          message: `${agent.agent_id || "agent"} connected`,
          type: "connect",
        });
      });

      setRecentActivities(mockActivities.slice(0, 10));
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [connector]);

  useEffect(() => {
    fetchDashboardData();
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleRestartNetwork = async () => {
    const confirmed = await confirm(
      "Restart Network",
      "Are you sure you want to restart the network? This will disconnect all agents.",
      {
        type: "danger",
        confirmText: "Restart",
        cancelText: "Cancel",
      }
    );
    if (!confirmed || !connector) {
      return;
    }

    try {
      // TODO: Call system restart command (requires backend support)
      // const response = await connector.sendEvent({
      //   event_name: "system.restart_network",
      //   source_id: agentName || "admin",
      //   payload: {},
      // });

      toast.info(
        "Network restart requested. This feature requires backend support."
      );

      // Simulate data refresh after restart
      setTimeout(() => {
        fetchDashboardData();
      }, 2000);
    } catch (error) {
      console.error("Failed to restart network:", error);
      toast.error("Failed to restart network");
    }
  };

  const handleBroadcastMessage = () => {
    setShowBroadcastModal(true);
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim() || !connector) {
      toast.error("Please enter a message");
      return;
    }

    try {
      setSendingBroadcast(true);

      // Send broadcast message
      const response = await connector.sendEvent({
        event_name: "mod:openagents.mods.communication.simple_messaging",
        source_id: agentName || "admin",
        destination_id: "agent:broadcast",
        payload: {
          text: broadcastMessage.trim(),
          type: "broadcast",
        },
      });

      if (response.success) {
        toast.success("Broadcast message sent successfully");
        setBroadcastMessage("");
        setShowBroadcastModal(false);
        // Refresh activity list
        fetchDashboardData();
      } else {
        toast.error(response.message || "Failed to send broadcast message");
      }
    } catch (error) {
      console.error("Failed to send broadcast:", error);
      toast.error("Failed to send broadcast message");
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Network overview and management
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className={`
              inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600
              rounded-md shadow-sm text-xs font-medium text-gray-700 dark:text-gray-300
              bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            `}
          >
            <svg
              className={`w-3 h-3 mr-1.5 ${refreshing ? "animate-spin" : ""}`}
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
          </button>
        </div>
      </div>

      {/* Network Info */}
      {selectedNetwork && (
        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="text-xs font-semibold text-blue-900 dark:text-blue-100">
            Network: {selectedNetwork.host}:{selectedNetwork.port}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* Agents Card */}
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate("/admin/agents")}
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Agents
            </h3>
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalAgents}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {stats.onlineAgents} online
          </div>
        </div>

        {/* Channels Card */}
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate("/admin/events")}
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Channels
            </h3>
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalChannels}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {stats.activeChannels} active
          </div>
        </div>

        {/* Uptime Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Uptime
            </h3>
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.uptime}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Network status
          </div>
        </div>

        {/* Events Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Events/min
            </h3>
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.eventsPerMinute}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Activity rate
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {/* Network Profile */}
          <button
            onClick={() => navigate("/admin/network")}
            className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                Network Profile
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                Configure network settings
              </div>
            </div>
          </button>

          {/* Transports */}
          <button
            onClick={() => navigate("/admin/transports")}
            className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                Transports
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                Manage transport protocols
              </div>
            </div>
          </button>

          {/* Import / Export */}
          <button
            onClick={() => navigate("/admin/import-export")}
            className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-purple-600 dark:text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                Import / Export
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                Backup or restore config
              </div>
            </div>
          </button>

          {/* Connected Agents */}
          <button
            onClick={() => navigate("/admin/agents")}
            className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-indigo-600 dark:text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                Connected Agents
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                View all connected agents
              </div>
            </div>
          </button>

          {/* Agent Groups */}
          <button
            onClick={() => navigate("/admin/groups")}
            className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-amber-600 dark:text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                Agent Groups
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                Manage agent groups
              </div>
            </div>
          </button>

          {/* Connection Guide */}
          <button
            onClick={() => navigate("/admin/connect")}
            className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-teal-600 dark:text-teal-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                Connection Guide
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                Setup connection steps
              </div>
            </div>
          </button>

          {/* Mod Management */}
          <button
            onClick={() => navigate("/admin/mods")}
            className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-pink-600 dark:text-pink-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19.11 4.89l-1.72 1.72a8 8 0 010 11.32l1.72-1.72a6 6 0 000-8.48l-1.72-1.72zM8.29 6.29l-1.72 1.72a6 6 0 000 8.48l1.72 1.72a8 8 0 010-11.32L8.29 6.29zM7 12a5 5 0 011.46-3.54l7.08 7.08A5 5 0 0117 12a5 5 0 01-1.46-3.54L8.46 15.54A5 5 0 017 12z"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                Mod Management
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                Enable or disable mods
              </div>
            </div>
          </button>

          {/* Event Logs */}
          <button
            onClick={() => navigate("/admin/events")}
            className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-cyan-600 dark:text-cyan-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                Event Logs
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                View system event logs
              </div>
            </div>
          </button>

          {/* Event Debugger */}
          <button
            onClick={() => navigate("/admin/debugger")}
            className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-orange-600 dark:text-orange-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                Event Debugger
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                Debug and test events
              </div>
            </div>
          </button>

          {/* Restart Network */}
          <button
            onClick={handleRestartNetwork}
            className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-red-600 dark:text-red-400"
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
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                Restart Network
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                Restart network server
              </div>
            </div>
          </button>

          {/* Broadcast Message */}
          <button
            onClick={handleBroadcastMessage}
            className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-yellow-600 dark:text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                Broadcast Message
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                Send message to all agents
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Recent Activity
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {recentActivities.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              No recent activity
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentActivities.map((activity, index) => (
                <div
                  key={index}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`
                        w-2 h-2 rounded-full
                        ${activity.type === "connect" ? "bg-green-500" : ""}
                        ${activity.type === "disconnect" ? "bg-red-500" : ""}
                        ${activity.type === "config" ? "bg-blue-500" : ""}
                        ${activity.type === "system" ? "bg-gray-500" : ""}
                      `}
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {activity.message}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {activity.timestamp}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Broadcast Message Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Broadcast Message
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Send a message to all connected agents
              </p>
            </div>

            <div className="p-6">
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Enter your message..."
                rows={6}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={sendingBroadcast}
              />
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  setShowBroadcastModal(false);
                  setBroadcastMessage("");
                }}
                disabled={sendingBroadcast}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendBroadcast}
                disabled={sendingBroadcast || !broadcastMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingBroadcast ? "Sending..." : "Send Broadcast"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
