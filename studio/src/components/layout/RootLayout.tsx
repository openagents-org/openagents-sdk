import React, { ReactNode, useContext, useState } from "react";
import ModSidebar from "./ModSidebar";
import Sidebar from "./Sidebar";
import MobileDrawer from "./MobileDrawer";
import ConnectionLoadingOverlay from "./ConnectionLoadingOverlay";
import {
  OpenAgentsProvider,
  OpenAgentsContext,
} from "@/context/OpenAgentsProvider";
import { useAuthStore } from "@/stores/authStore";
import { Navigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { LayoutProvider, useLayout } from "./components/context";
import { HeaderBreadcrumbs } from "./components/header-breadcrumbs";
import { SidebarSecondary } from "./components/sidebar-secondary";

interface RootLayoutProps {
  children: ReactNode;
}

// Conditionally rendered OpenAgents Provider wrapper
const ConditionalOpenAgentsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { selectedNetwork, agentName } = useAuthStore();

  // Only initialize OpenAgentsProvider after basic setup is complete
  if (selectedNetwork && agentName) {
    console.log("🚀 RootLayout: Initializing OpenAgentsProvider", {
      network:
        selectedNetwork?.networkInfo?.name ||
        `${selectedNetwork?.host}:${selectedNetwork?.port}`,
      agentName,
    });
    return <OpenAgentsProvider>{children}</OpenAgentsProvider>;
  }

  return <Navigate to="/network-selection" />;
};

/**
 * Root layout component - responsible for overall layout structure
 * Contains: left module navigation + middle content area (sidebar + main content)
 *
 * Now also responsible for conditionally rendering OpenAgentsProvider:
 * - Only initializes OpenAgentsProvider after user completes network selection and agent setup
 * - This ensures all pages using RootLayout can access OpenAgents context
 */
const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  return (
    <ConditionalOpenAgentsProvider>
      <RootLayoutContent>{children}</RootLayoutContent>
    </ConditionalOpenAgentsProvider>
  );
};

// Internal component that can access LayoutProvider context
const MainContentArea: React.FC<{
  children: ReactNode;
  shouldHideSidebar: boolean;
}> = ({ children, shouldHideSidebar }) => {
  const isMobile = useIsMobile();
  const { isSidebarOpen } = useLayout();

  return (
    <main
      className={`
      flex-1 flex flex-col overflow-hidden relative
      ${
        isMobile
          ? "m-0 rounded-none border-0"
          : "m-2 rounded-xl shadow-md border border-gray-200 dark:border-gray-700"
      }
      bg-white
      dark:bg-[#09090B]
    `}
    >
      {/* Content area with secondary sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Secondary Sidebar */}
        {!shouldHideSidebar && isSidebarOpen && (
          <div
            className="hidden md:block flex-shrink-0"
            style={{
              width:
                "calc(var(--sidebar-width) - var(--sidebar-collapsed-width))",
            }}
          >
            <SidebarSecondary />
          </div>
        )}

        {/* Page Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#09090B]">
          {/* Breadcrumb Navigation - fixed at top, doesn't scroll */}
          {!shouldHideSidebar && (
            <div className="flex-shrink-0">
              <HeaderBreadcrumbs />
            </div>
          )}
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-auto bg-white dark:bg-[#09090B]">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
};

// Actual layout content component
const RootLayoutContent: React.FC<RootLayoutProps> = ({ children }) => {
  const context = useContext(OpenAgentsContext);
  const isConnected = context?.isConnected || false;
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Determine if current route should hide the sidebar
  const shouldHideSidebar = location.pathname.startsWith("/agentworld");

  // Hide ModSidebar (left navigation) on admin routes
  const shouldHideModSidebar = location.pathname.startsWith("/admin");

  // Close drawer when route changes on mobile
  React.useEffect(() => {
    if (isMobile) {
      setIsDrawerOpen(false);
    }
  }, [location.pathname, isMobile]);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#F4F4F5] dark:bg-[#09090B] text-gray-900 dark:text-gray-100">
      {/* Connection status overlay - only shown when OpenAgentsProvider exists but not connected */}
      {context && !isConnected && <ConnectionLoadingOverlay />}

      {context && isConnected && (
        <LayoutProvider>
          {/* Mobile Drawer - only shown on mobile */}
          {/* Use both conditional rendering and ensure it's hidden on larger screens */}
          <div className="md:hidden">
            <MobileDrawer
              isOpen={isDrawerOpen}
              onClose={() => setIsDrawerOpen(false)}
            />
          </div>

          {/* Left module navigation bar - hidden on mobile and admin routes */}
          {/* Use Tailwind responsive classes: hidden by default, show on md (768px) and up */}
          {/* {!shouldHideModSidebar && (
            <div className="hidden md:block">
              <ModSidebar />
            </div>
          )} */}

          {/* Middle content area: sidebar + main content */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Feature sidebar - hidden on mobile, shown in drawer instead */}
            {/* Use Tailwind responsive classes: hidden by default, show on md (768px) and up */}
            {!shouldHideSidebar && (
              <div className="hidden md:block">
                <Sidebar />
              </div>
            )}

            {/* Mobile menu button - only shown on mobile */}
            {/* Use Tailwind responsive classes: show by default, hide on md (768px) and up */}
            {!shouldHideSidebar && (
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="
                    fixed top-4 left-4 z-30
                    p-3 rounded-lg
                    bg-white dark:bg-gray-800
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    transition-colors duration-200
                    shadow-lg
                    border border-gray-200 dark:border-gray-700
                    md:hidden
                  "
                aria-label="Open menu"
              >
                <svg
                  className="w-6 h-6 text-gray-600 dark:text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            )}

            {/* Main content area - uses internal component to access LayoutProvider context */}
            <MainContentArea shouldHideSidebar={shouldHideSidebar}>
              {children}
            </MainContentArea>
          </div>
        </LayoutProvider>
      )}
    </div>
  );
};

export default RootLayout;
