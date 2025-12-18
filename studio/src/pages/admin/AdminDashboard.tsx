import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOpenAgents } from "@/context/OpenAgentsProvider";
import { useAuthStore } from "@/stores/authStore";
import { useConfirm } from "@/context/ConfirmContext";
import { toast } from "sonner";
import DashboardTour from "@/components/admin/DashboardTour";

interface DashboardStats {
  totalAgents: number;
  onlineAgents: number;
  activeChannels: number;
  totalChannels: number;
  uptime: string;
  eventsPerMinute: number;
  totalGroups: number;
}

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation('admin');
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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Check if user has seen the tour
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('admin-dashboard-tour-seen');
    if (!hasSeenTour) {
      // Wait for page to load before showing tour
      setTimeout(() => {
        setShowTour(true);
      }, 1000);
    }
  }, []);

  const tourSteps = [
    {
      target: '[data-tour="stats"]',
      title: t('tour.step1.title'),
      content: t('tour.step1.content'),
      position: 'bottom' as const,
    },
    {
      target: '[data-tour="quick-actions"]',
      title: t('tour.step2.title'),
      content: t('tour.step2.content'),
      position: 'bottom' as const,
    },
    {
      target: '[data-tour="agent-groups"]',
      title: t('tour.step3.title'),
      content: t('tour.step3.content'),
      position: 'bottom' as const,
    },
    {
      target: '[data-tour="update-password"]',
      title: t('tour.step4.title'),
      content: t('tour.step4.content'),
      position: 'top' as const,
    },
  ];

  const handleTourComplete = () => {
    setShowTour(false);
    localStorage.setItem('admin-dashboard-tour-seen', 'true');
  };

  const handleTourClose = () => {
    setShowTour(false);
    localStorage.setItem('admin-dashboard-tour-seen', 'true');
  };

  const startTour = () => {
    setShowTour(true);
  };

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
      t('dashboard.restart.title'),
      t('dashboard.restart.confirm'),
      {
        type: "danger",
        confirmText: t('dashboard.restart.restart'),
        cancelText: t('dashboard.restart.cancel'),
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

      toast.info(t('dashboard.restart.requested'));

      // Simulate data refresh after restart
      setTimeout(() => {
        fetchDashboardData();
      }, 2000);
    } catch (error) {
      console.error("Failed to restart network:", error);
      toast.error(t('dashboard.restart.failed'));
    }
  };

  const handleBroadcastMessage = () => {
    setShowBroadcastModal(true);
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim() || !connector) {
      toast.error(t('dashboard.broadcast.enterMessage'));
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
        toast.success(t('dashboard.broadcast.success'));
        setBroadcastMessage("");
        setShowBroadcastModal(false);
        // Refresh activity list
        fetchDashboardData();
      } else {
        toast.error(response.message || t('dashboard.broadcast.failed'));
      }
    } catch (error) {
      console.error("Failed to send broadcast:", error);
      toast.error(t('dashboard.broadcast.failed'));
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
            {t('dashboard.loading')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto dark:bg-gray-900">
      {/* Header with Stats Tags */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('dashboard.title')}
          </h1>
          {/* Stats Tags */}
          <div className="flex flex-wrap items-center gap-2" data-tour="stats">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              onClick={() => navigate("/admin/agents")}
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {stats.onlineAgents}/{stats.totalAgents} {t('dashboard.stats.agents')}
            </span>
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 cursor-pointer hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              onClick={() => navigate("/admin/events")}
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {stats.activeChannels}/{stats.totalChannels} {t('dashboard.stats.channels')}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {stats.uptime}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={startTour}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            title={t('dashboard.quickActions.startTour')}
          >
            <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('dashboard.quickActions.startTour')}
          </button>
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className={`w-3 h-3 mr-1.5 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? t('dashboard.refreshing') : t('dashboard.refresh')}
          </button>
        </div>
      </div>

      {/* Network Info */}
      {selectedNetwork && (
        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="text-xs font-semibold text-blue-900 dark:text-blue-100">
            {t('dashboard.networkInfo')}: {selectedNetwork.host}:{selectedNetwork.port}
          </div>
        </div>
      )}

      {/* Quick Actions - Only 3 essential actions */}
      <div className="mb-4" data-tour="quick-actions">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {t('dashboard.quickActions.title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Update Admin Password */}
          <button
            onClick={() => navigate("/admin/groups?changePassword=admin")}
            data-tour="update-password"
            className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dashboard.quickActions.updateAdminPassword')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickActions.updateAdminPasswordDesc')}</div>
            </div>
          </button>

          {/* Import / Export */}
          <button
            onClick={() => navigate("/admin/import-export")}
            className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dashboard.quickActions.importExport')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickActions.importExportDesc')}</div>
            </div>
          </button>

          {/* Service Agents */}
          <button
            onClick={() => navigate("/admin/service-agents")}
            className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('sidebar.items.serviceAgents')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.menuGroups.serviceAgentsDesc')}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Menu Groups - Quick Actions Style */}
      <div className="space-y-4">
        {/* Network Group */}
        <div>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
            {t('sidebar.sections.network')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <button onClick={() => navigate("/admin/network")} className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dashboard.quickActions.networkProfile')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickActions.networkProfileDesc')}</div>
              </div>
            </button>
            <button onClick={() => navigate("/admin/transports")} className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dashboard.quickActions.transports')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickActions.transportsDesc')}</div>
              </div>
            </button>
            <button onClick={() => navigate("/admin/import-export")} className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dashboard.quickActions.importExport')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickActions.importExportDesc')}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Agents Group */}
        <div>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
            {t('sidebar.sections.agents')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <button onClick={() => navigate("/admin/agents")} className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dashboard.quickActions.connectedAgents')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickActions.connectedAgentsDesc')}</div>
              </div>
            </button>
            <button onClick={() => navigate("/admin/groups")} data-tour="agent-groups" className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dashboard.quickActions.agentGroups')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickActions.agentGroupsDesc')}</div>
              </div>
            </button>
            <button onClick={() => navigate("/admin/service-agents")} className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('sidebar.items.serviceAgents')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.menuGroups.serviceAgentsDesc')}</div>
              </div>
            </button>
            <button onClick={() => navigate("/admin/connect")} className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dashboard.quickActions.connectionGuide')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickActions.connectionGuideDesc')}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Modules Group */}
        <div>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
            {t('sidebar.sections.modules')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <button onClick={() => navigate("/admin/mods")} className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.11 4.89l-1.72 1.72a8 8 0 010 11.32l1.72-1.72a6 6 0 000-8.48l-1.72-1.72zM8.29 6.29l-1.72 1.72a6 6 0 000 8.48l1.72 1.72a8 8 0 010-11.32L8.29 6.29zM7 12a5 5 0 011.46-3.54l7.08 7.08A5 5 0 0117 12a5 5 0 01-1.46-3.54L8.46 15.54A5 5 0 017 12z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dashboard.quickActions.modManagement')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickActions.modManagementDesc')}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Monitoring Group */}
        <div>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
            {t('sidebar.sections.monitoring')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <button onClick={() => navigate("/admin/events")} className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dashboard.quickActions.eventLogs')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickActions.eventLogsDesc')}</div>
              </div>
            </button>
            <button onClick={() => navigate("/admin/event-explorer")} className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('sidebar.items.eventExplorer')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.menuGroups.eventExplorerDesc')}</div>
              </div>
            </button>
            <button onClick={() => navigate("/admin/llm-logs")} className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('sidebar.items.llmLogs')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.menuGroups.llmLogsDesc')}</div>
              </div>
            </button>
            <button onClick={() => navigate("/admin/debugger")} className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dashboard.quickActions.eventDebugger')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickActions.eventDebuggerDesc')}</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Broadcast Message Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t('dashboard.broadcast.title')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('dashboard.broadcast.subtitle')}
              </p>
            </div>

            <div className="p-6">
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder={t('dashboard.broadcast.placeholder')}
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
                {t('dashboard.broadcast.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSendBroadcast}
                disabled={sendingBroadcast || !broadcastMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingBroadcast ? t('dashboard.broadcast.sending') : t('dashboard.broadcast.send')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Tour */}
      <DashboardTour
        steps={tourSteps}
        isActive={showTour}
        onClose={handleTourClose}
        onComplete={handleTourComplete}
      />
    </div>
  );
};

export default AdminDashboard;
