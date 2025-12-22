import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Template } from "@/pages/OnboardingPage";
import StarfieldBackground from "./StarfieldBackground";

interface OnboardingStep2Props {
  onNext: (template: Template) => void;
  onBack: () => void;
}

const OnboardingStep2: React.FC<OnboardingStep2Props> = ({ onNext, onBack }) => {
  const { t } = useTranslation('onboarding');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const templates: Template[] = useMemo(() => [
    {
      id: "news-info",
      name: t('step2.templates.news-info.name'),
      description: t('step2.templates.news-info.description'),
      icon: "📰",
      agentCount: 3,
      mods: ["messaging mod"],
      setupTime: t('step2.setupTime.quick'),
      agents: ["Curator", "Editor", "Broadcaster"],
    },
    {
      id: "knowledge-wiki",
      name: t('step2.templates.knowledge-wiki.name'),
      description: t('step2.templates.knowledge-wiki.description'),
      icon: "📚",
      agentCount: 4,
      mods: ["wiki mod"],
      setupTime: t('step2.setupTime.quick'),
      agents: ["Researcher", "Writer", "Editor", "Publisher"],
    },
    {
      id: "task-automation",
      name: t('step2.templates.task-automation.name'),
      description: t('step2.templates.task-automation.description'),
      icon: "✅",
      agentCount: 3,
      mods: ["task mod"],
      setupTime: t('step2.setupTime.quick'),
      agents: ["Coordinator", "Executor", "Validator"],
    },
    {
      id: "blank-network",
      name: t('step2.templates.blank-network.name'),
      description: t('step2.templates.blank-network.description'),
      icon: "⚙️",
      agentCount: 0,
      mods: [t('step2.noMods')],
      setupTime: t('step2.setupTime.manual'),
      agents: [],
    },
  ], [t]);

  const handleSelect = (template: Template) => {
    setSelectedTemplateId(template.id);
    onNext(template);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <StarfieldBackground />
      <div className="max-w-6xl w-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden relative z-10 border border-white/20">
        <div className="p-8">
          <div className="mb-6">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {t('step2.stepIndicator')}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t('step2.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {t('step2.description')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`border-2 rounded-xl p-6 cursor-pointer transition-all ${
                  selectedTemplateId === template.id
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700"
                }`}
                onClick={() => handleSelect(template)}
              >
                <div className="text-5xl mb-4">{template.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {template.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                  {template.description}
                </p>
                <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                  <div>○ {template.agentCount} {t('step2.agents')}</div>
                  <div>○ {template.mods.join(", ")}</div>
                  <div>○ {template.setupTime}</div>
                </div>
                <button
                  className={`mt-4 w-full py-2 rounded-lg font-medium transition-colors ${
                    selectedTemplateId === template.id
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {t('step2.selectButton')}
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              onClick={onBack}
              className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              {t('step2.backButton')}
            </button>
            <button
              onClick={() => {}}
              className="px-6 py-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
            >
              {t('step2.browseMoreButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStep2;

