import React from "react";
import { useTranslation } from "react-i18next";
import { Template } from "@/pages/OnboardingPage";
import StarfieldBackground from "./StarfieldBackground";

interface OnboardingStep4Props {
  template: Template;
  isDeploying: boolean;
  progress: number;
}

const OnboardingStep4: React.FC<OnboardingStep4Props> = ({ template, isDeploying, progress }) => {
  const { t } = useTranslation('onboarding');
  
  const steps = [
    { name: t('step4.steps.createConfig'), completed: progress >= 25 },
    { name: t('step4.steps.installMods', { mods: template.mods.join(", ") }), completed: progress >= 50 },
    { name: t('step4.steps.configureAgents'), completed: progress >= 75 },
    { name: t('step4.steps.startingAgents'), completed: progress >= 90, inProgress: progress >= 75 && progress < 90 },
    { name: t('step4.steps.verifyConnection'), completed: progress >= 100 },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <StarfieldBackground />
      <div className="max-w-2xl w-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden relative z-10 border border-white/20">
        <div className="p-8">
          <div className="mb-8">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {t('step4.stepIndicator')}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t('step4.title')}
            </h1>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 mb-6">
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center">
                  <div className="mr-4">
                    {step.completed ? (
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    ) : step.inProgress ? (
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-full"></div>
                    )}
                  </div>
                  <span
                    className={`${
                      step.completed
                        ? "text-green-600 dark:text-green-400"
                        : step.inProgress
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-gray-400"
                    }`}
                  >
                    {step.completed ? "✅" : step.inProgress ? "🔄" : "○"} {step.name}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>{t('step4.progress')}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="text-center text-gray-600 dark:text-gray-400">
            <div className="mb-2">
              <strong className="text-gray-900 dark:text-white">{t('step4.template')}</strong> {template.name}
            </div>
            <div>
              <strong className="text-gray-900 dark:text-white">{t('step4.agents')}</strong>{" "}
              {template.agents.join(", ")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStep4;

