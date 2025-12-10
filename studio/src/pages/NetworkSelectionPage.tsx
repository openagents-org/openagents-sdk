import React from "react";
import { useTranslation } from "react-i18next";
import OpenAgentsLogo from "@/assets/images/openagents-logo-trans-white.png";
import LocalNetwork from "@/components/network/LocalNetwork";
import ManualNetwork from "@/components/network/ManualNetwork";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";

const NetworkSelectionView: React.FC = () => {
  const { t } = useTranslation('auth');

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
