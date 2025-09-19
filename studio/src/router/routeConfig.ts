import React from "react";
import { Navigate } from "react-router-dom";

// Pages
import NetworkSelectionPage from "@/pages/NetworkSelectionPage";
import AgentSetupPage from "@/pages/AgentSetupPage";
import ConnectionLoadingPage from "@/pages/ConnectionLoadingPage";
import ChatPage from "@/pages/ChatPage";

export interface RouteConfig {
  path: string;
  element: React.ComponentType;
  requiresAuth?: boolean;
  title?: string;
  exact?: boolean;
}

export const routes: RouteConfig[] = [
  {
    path: "/network-selection",
    element: NetworkSelectionPage,
    title: "Network Selection",
  },
  {
    path: "/agent-setup",
    element: AgentSetupPage,
    title: "Agent Setup",
  },
  {
    path: "/connection-loading",
    element: ConnectionLoadingPage,
    title: "Connecting",
  },
  {
    path: "/chat/*",
    element: ChatPage,
    title: "Chat",
    requiresAuth: true,
  },
];

// Special routes that don't need RouteGuard wrapping
export const specialRoutes = [
  {
    path: "/",
    element: () => React.createElement(Navigate, { to: "/network-selection", replace: true }),
  },
  {
    path: "*",
    element: () => React.createElement(Navigate, { to: "/network-selection", replace: true }),
  },
];