import React from "react";
import { useTranslation } from "react-i18next";
import { Template } from "@/pages/OnboardingPage";
import StarfieldBackground from "./StarfieldBackground";

interface OnboardingSuccessProps {
  template: Template;
  agentCount: number;
  onEnterDashboard: () => void;
}

const OnboardingSuccess: React.FC<OnboardingSuccessProps> = ({
  template,
  agentCount,
  onEnterDashboard,
}) => {
  const { t } = useTranslation('onboarding');
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <StarfieldBackground />
      <div className="max-w-2xl w-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden relative z-10 border border-white/20">
        <div className="p-12 text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {t('success.title')}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            {t('success.message', { templateName: template.name, agentCount })}
          </p>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-4">
                {template.agents.map((agent, index) => (
                  <React.Fragment key={index}>
                    <div className="text-center">
                      <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold mb-2">
                        {agent[0]}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {agent}
                      </div>
                    </div>
                    {index < template.agents.length - 1 && (
                      <div className="text-2xl text-gray-400">→</div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={onEnterDashboard}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-all transform hover:scale-105 shadow-lg"
          >
            {t('success.enterDashboardButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingSuccess;

