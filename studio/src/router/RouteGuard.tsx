import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { routes } from "./routeConfig";
import { useDynamicRoutes } from "@/hooks/useDynamicRoutes";
import { isRouteAvailable } from "@/utils/moduleUtils";
import { fetchNetworkById } from "@/services/networkService";

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Global route guard - centralized handling of all page flow routing logic
 * Determines which page the user should be on based on current state
 */
const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const location = useLocation();
  const { selectedNetwork, agentName } = useAuthStore();
  const { isModulesLoaded, defaultRoute, enabledModules } = useDynamicRoutes();
  const currentPath = location.pathname;
  
  const [networkIdChecking, setNetworkIdChecking] = useState(false);
  const [shouldRedirectToNetworkSelection, setShouldRedirectToNetworkSelection] = useState(false);

  // Check for network-id URL parameter
  const urlParams = new URLSearchParams(location.search);
  const networkIdParam = urlParams.get('network-id');

  console.log(
    `🛡️ RouteGuard: path=${currentPath}, network=${!!selectedNetwork}, agent=${!!agentName}, modulesLoaded=${isModulesLoaded}, networkIdParam=${networkIdParam}`
  );

  // Helper function to check if current network matches the requested network ID
  const checkNetworkIdMatch = async (networkId: string): Promise<boolean> => {
    if (!selectedNetwork) return false;
    
    try {
      const networkResult = await fetchNetworkById(networkId);
      if (!networkResult.success) return false;
      
      const network = networkResult.network;
      let targetHost = network.profile?.host;
      let targetPort = network.profile?.port;
      
      // Extract host/port from connection endpoint if not directly available
      if (!targetHost || !targetPort) {
        if (network.profile?.connection?.endpoint) {
          const endpoint = network.profile.connection.endpoint;
          
          if (endpoint.startsWith("modbus://")) {
            const url = new URL(endpoint);
            targetHost = url.hostname;
            targetPort = parseInt(url.port);
          } else if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
            const url = new URL(endpoint);
            targetHost = url.hostname;
            targetPort = parseInt(url.port) || (endpoint.startsWith("https://") ? 443 : 80);
          } else {
            const parts = endpoint.split(":");
            if (parts.length >= 2) {
              targetHost = parts[0];
              targetPort = parseInt(parts[1]);
            }
          }
        }
      }
      
      if (!targetPort) targetPort = 8700;
      
      // Compare with current network
      return selectedNetwork.host === targetHost && selectedNetwork.port === targetPort;
    } catch (error) {
      console.error("Error checking network ID match:", error);
      return false;
    }
  };

  // Effect to handle network-id checking for logged-in users
  useEffect(() => {
    if (networkIdParam && selectedNetwork && agentName && currentPath === "/") {
      setNetworkIdChecking(true);
      checkNetworkIdMatch(networkIdParam).then((matches) => {
        if (!matches) {
          console.log(`🔄 Network ID ${networkIdParam} doesn't match current network, redirecting to network selection`);
          setShouldRedirectToNetworkSelection(true);
        }
        setNetworkIdChecking(false);
      });
    }
  }, [networkIdParam, selectedNetwork, agentName, currentPath]);

  // Handle redirect to network selection with network-id
  if (shouldRedirectToNetworkSelection) {
    return <Navigate to={`/?network-id=${encodeURIComponent(networkIdParam!)}`} replace />;
  }

  // Show loading while checking network ID match
  if (networkIdChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Checking network connection...</p>
        </div>
      </div>
    );
  }

  // Handle root path "/" - NetworkSelectionPage is now served directly under /
  if (currentPath === "/") {
    // If user is fully setup (has network and agent), redirect to the default route
    if (selectedNetwork && agentName) {
      // Check if there's a network-id parameter that doesn't match current network
      if (networkIdParam) {
        // network-id checking is handled by useEffect above
        // If we reach here without being redirected, networks match or check is in progress
        if (!networkIdChecking && !shouldRedirectToNetworkSelection) {
          console.log(`🔄 Root path with network-id: User setup complete and networks match, redirecting to ${defaultRoute}`);
          return <Navigate to={defaultRoute} replace />;
        }
      } else {
        // No network-id parameter, normal redirect to default route
        console.log(`🔄 Root path: User setup complete, redirecting to ${defaultRoute}`);
        return <Navigate to={defaultRoute} replace />;
      }
    }
    // If user is not fully setup, show NetworkSelectionPage (which is served under /)
    // Return children to render the NetworkSelectionPage
    console.log("🔄 Root path: Showing network selection page");
    return <>{children}</>;
  }

  // Handle /agent-setup path access control
  if (currentPath === "/agent-setup") {
    if (!selectedNetwork) {
      console.log(
        "🔄 Agent setup accessed without network, redirecting to /"
      );
      return <Navigate to="/" replace />;
    }
    // Has network selection, allow access to agent-setup
    return <>{children}</>;
  }

  // NetworkSelectionPage is now served under /, so no special handling needed here

  // Handle authenticated routes (ModSidebar related routes)
  const isAuthenticatedRoute = routes.some((route) => {
    if (!route.requiresAuth) return false;

    // Handle wildcard paths (e.g. "/forum/*")
    if (route.path.endsWith("/*")) {
      const basePath = route.path.slice(0, -2); // Remove "/*"
      return currentPath === basePath || currentPath.startsWith(basePath + "/");
    }

    // Exact match
    return currentPath === route.path;
  });

  if (isAuthenticatedRoute) {
    // Accessing authenticated route, check if setup is complete
    if (!selectedNetwork) {
      console.log(
        `🔄 Authenticated route ${currentPath} accessed without network, redirecting to /`
      );
      // Preserve network-id parameter if it exists
      const redirectUrl = networkIdParam 
        ? `/?network-id=${encodeURIComponent(networkIdParam)}`
        : "/";
      return <Navigate to={redirectUrl} replace />;
    }

    if (!agentName) {
      console.log(
        `🔄 Authenticated route ${currentPath} accessed without agent, redirecting to /agent-setup`
      );
      return <Navigate to="/agent-setup" replace />;
    }

    // Check if route is available in enabled modules
    if (isModulesLoaded && !isRouteAvailable(currentPath, enabledModules)) {
      console.log(
        `🔄 Route ${currentPath} not available in enabled modules, redirecting to ${defaultRoute}`
      );
      return <Navigate to={defaultRoute} replace />;
    }

    // Setup complete, allow access to authenticated route
    return <>{children}</>;
  }

  // Handle invalid paths - redirect to appropriate page
  if (selectedNetwork && agentName) {
    console.log(
      `🔄 Invalid route ${currentPath} with complete setup, redirecting to ${defaultRoute}`
    );
    return <Navigate to={defaultRoute} replace />;
  } else {
    console.log(
      `🔄 Invalid route ${currentPath} without setup, redirecting to /`
    );
    // Preserve network-id parameter if it exists
    const redirectUrl = networkIdParam 
      ? `/?network-id=${encodeURIComponent(networkIdParam)}`
      : "/";
    return <Navigate to={redirectUrl} replace />;
  }
};

export default RouteGuard;
