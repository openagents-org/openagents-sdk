import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { getCurrentNetworkHealth } from "@/services/networkService";
import OpenAgentsLogo from "@/assets/images/openagents-logo-trans-white.png";
import LocalNetwork from "@/components/network/LocalNetwork";
import ManualNetwork from "@/components/network/ManualNetwork";
import OnboardingPage from "@/pages/OnboardingPage";

const NetworkSelectionView: React.FC = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { selectedNetwork } = useAuthStore();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);

  // Check onboarding status when network is selected
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!selectedNetwork) {
        setShowOnboarding(false);
        return;
      }

      // Don't check if we're already showing onboarding (to avoid navigation conflicts)
      if (showOnboarding) {
        return;
      }

      setCheckingOnboarding(true);
      try {
        const healthResult = await getCurrentNetworkHealth(selectedNetwork);
        const onboardingCompleted = healthResult.data?.data?.onboarding_completed;
        
        if (!onboardingCompleted) {
          // Show onboarding if not completed
          setShowOnboarding(true);
        } else {
          // Already completed, don't show onboarding
          // Don't navigate here - let the user continue with agent setup from the network selection page
          setShowOnboarding(false);
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
        // On error, assume onboarding is needed
        setShowOnboarding(true);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    checkOnboardingStatus();
  }, [selectedNetwork, showOnboarding]);

  // Show loading state while checking onboarding
  if (checkingOnboarding && selectedNetwork) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">检查网络状态...</p>
        </div>
      </div>
    );
  }

  // If onboarding should be shown, render OnboardingPage
  if (showOnboarding && selectedNetwork) {
    return <OnboardingPage />;
  }

  const Header = React.memo(() => {
    return (
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white">
        <div className="flex items-center justify-center mb-4">
          <img
            src={OpenAgentsLogo}
            alt="OpenAgents Logo"
            className="w-16 h-16 mr-4"
          />
          <h1 className="text-4xl font-bold">{t('networkSelection.title')}</h1>
        </div>
        <p className="text-center text-lg opacity-90">
          {t('networkSelection.subtitle')}
        </p>
      </div>
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        <Header />

        <div className="p-8">
          <LocalNetwork />

          <ManualNetwork />

          {/* <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              Public Networks
            </h2>
            <button
              onClick={() => {}}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Go To Public Networks
            </button>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default NetworkSelectionView;
