import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AdminRouteGuard from "@/components/auth/AdminRouteGuard";
import AdminDashboard from "./AdminDashboard";

// Import pages from profile (to be migrated)
import AgentManagement from "@/pages/profile/AgentManagement";
import NetworkProfile from "@/pages/profile/NetworkProfile";
import AgentGroupsManagement from "@/pages/profile/AgentGroupsManagement";
import EventLogs from "@/pages/profile/EventLogs";
import EventDebugger from "@/pages/profile/EventDebugger";
import ModManagementPage from "@/pages/mod-management/ModManagementPage";
import TransportConfig from "./TransportConfig";
import ConnectionGuide from "./ConnectionGuide";

// Admin-only pages
import LLMLogsMainPage from "@/pages/llmlogs/LLMLogsMainPage";
import ServiceAgentsMainPage from "@/pages/serviceagents/ServiceAgentsMainPage";

/**
 * AdminMainPage - Main router for admin pages
 * All admin routes are protected by AdminRouteGuard
 */
const AdminMainPage: React.FC = () => {
  return (
    <AdminRouteGuard>
      <Routes>
        {/* Default redirect to dashboard */}
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        
        {/* Admin Dashboard */}
        <Route path="dashboard" element={<AdminDashboard />} />
        
        {/* Network Management */}
        <Route path="network" element={<NetworkProfile />} />
        <Route path="transports" element={<TransportConfig />} />
        <Route path="import-export" element={<ImportExportPlaceholder />} />
        
        {/* Agent Management */}
        <Route path="agents" element={<AgentManagement />} />
        <Route path="groups" element={<AgentGroupsManagement />} />
        <Route path="service-agents/*" element={<ServiceAgentsMainPage />} />
        <Route path="connect" element={<ConnectionGuide />} />

        {/* Modules */}
        <Route path="mods" element={<ModManagementPage />} />

        {/* Monitoring */}
        <Route path="events" element={<EventLogs />} />
        <Route path="llm-logs/*" element={<LLMLogsMainPage />} />
        <Route path="debugger" element={<EventDebugger />} />
      </Routes>
    </AdminRouteGuard>
  );
};

const ImportExportPlaceholder: React.FC = () => {
  return (
    <div className="p-6 h-full">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Import / Export
      </h1>
      <p className="text-gray-600 dark:text-gray-400">
        Network import/export functionality coming soon...
      </p>
    </div>
  );
};

export default AdminMainPage;

