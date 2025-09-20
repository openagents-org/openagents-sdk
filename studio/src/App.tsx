import React, { useEffect } from "react";
import AppRouter from "./router/AppRouter";
import { useNetworkStore } from "@/stores/networkStore";
import { clearAllOpenAgentsData } from "@/utils/cookies";

// Main App component - now simplified to just a router container
const App: React.FC = () => {
  const { clearAgentName, clearNetwork } = useNetworkStore();

  // Add debug function to window for troubleshooting
  useEffect(() => {
    // Only clear data in development or when explicitly needed
    // Don't auto-clear on every app start as it breaks the user flow

    (window as any).clearOpenAgentsData = clearAllOpenAgentsData;
    (window as any).clearNetworkData = () => {
      clearNetwork();
      clearAgentName();
      console.log("🧹 Network data cleared");
    };

    console.log(
      "🔧 Debug: Run clearOpenAgentsData() or clearNetworkData() in console to clear saved data"
    );
  }, [clearNetwork, clearAgentName]);

  return <AppRouter />;
};

export default App;
