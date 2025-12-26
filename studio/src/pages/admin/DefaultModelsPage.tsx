import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, ChevronDown, Save, Check, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { networkFetch } from "@/utils/httpClient";

interface ModelConfig {
  provider: string;
  modelName: string;
  apiKey: string;
}

const MODEL_PROVIDERS = [
  { id: "openai", name: "OpenAI", models: ["gpt-5.2", "gpt-5.2-pro", "gpt-5.1", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "o4-mini", "o3-mini"] },
  { id: "anthropic", name: "Anthropic", models: ["claude-opus-4-5-20251124", "claude-sonnet-4-5-20250514", "claude-haiku-4-5-20251015", "claude-sonnet-4-20250514"] },
  { id: "google", name: "Google", models: ["gemini-3-flash", "gemini-3-pro", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"] },
  { id: "deepseek", name: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "openrouter", name: "OpenRouter", models: [] },
  { id: "custom", name: "Custom", models: [] },
];

const DefaultModelsPage: React.FC = () => {
  const { t } = useTranslation("admin");
  const { selectedNetwork } = useAuthStore();

  const [provider, setProvider] = useState("");
  const [modelName, setModelName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const selectedProvider = MODEL_PROVIDERS.find((p) => p.id === provider);
  const hasModels = selectedProvider && selectedProvider.models.length > 0;
  const isConfigured = provider && modelName && apiKey;

  // Load current config on mount
  useEffect(() => {
    const loadConfig = async () => {
      if (!selectedNetwork) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await networkFetch(
          selectedNetwork.host,
          selectedNetwork.port,
          "/api/admin/default-model",
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            useHttps: selectedNetwork.useHttps,
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.config) {
            setProvider(data.config.provider || "");
            setModelName(data.config.model_name || "");
            setApiKey(data.config.api_key || "");
          }
        }
      } catch (error) {
        console.error("Failed to load default model config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [selectedNetwork]);

  const handleSave = async () => {
    if (!selectedNetwork) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      const response = await networkFetch(
        selectedNetwork.host,
        selectedNetwork.port,
        "/api/admin/default-model",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider,
            model_name: modelName,
            api_key: apiKey,
          }),
          useHttps: selectedNetwork.useHttps,
        }
      );

      const data = await response.json();

      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(data.error_message || t("defaultModels.saveFailed"));
      }
    } catch (error) {
      console.error("Failed to save default model config:", error);
      setSaveError(t("defaultModels.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!selectedNetwork) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      const response = await networkFetch(
        selectedNetwork.host,
        selectedNetwork.port,
        "/api/admin/default-model",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          useHttps: selectedNetwork.useHttps,
        }
      );

      const data = await response.json();

      if (data.success) {
        setProvider("");
        setModelName("");
        setApiKey("");
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(data.error_message || t("defaultModels.clearFailed"));
      }
    } catch (error) {
      console.error("Failed to clear default model config:", error);
      setSaveError(t("defaultModels.clearFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t("defaultModels.title")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t("defaultModels.subtitle")}
        </p>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        {/* Provider Dropdown */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("defaultModels.providerLabel")}
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setProviderDropdownOpen(!providerDropdownOpen)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-left flex items-center justify-between"
            >
              <span className={provider ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}>
                {selectedProvider?.name || t("defaultModels.selectProvider")}
              </span>
              <ChevronDown className="w-5 h-5 text-gray-400" />
            </button>
            {providerDropdownOpen && (
              <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                {MODEL_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProvider(p.id);
                      setModelName("");
                      setProviderDropdownOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Model Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("defaultModels.modelNameLabel")}
          </label>
          {hasModels ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-left flex items-center justify-between"
              >
                <span className={modelName ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}>
                  {modelName || t("defaultModels.selectModel")}
                </span>
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </button>
              {modelDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {selectedProvider.models.map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => {
                        setModelName(model);
                        setModelDropdownOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                    >
                      {model}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              placeholder={t("defaultModels.modelNamePlaceholder")}
            />
          )}
        </div>

        {/* API Key */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("defaultModels.apiKeyLabel")}
          </label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 pr-12"
              placeholder={t("defaultModels.apiKeyPlaceholder")}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Info hint */}
        <div className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>{t("defaultModels.hint")}</p>
        </div>

        {/* Save status */}
        {saveSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-4">
            <Check className="w-4 h-4" />
            <span>{t("defaultModels.saveSuccess")}</span>
          </div>
        )}

        {saveError && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-4">
            <AlertCircle className="w-4 h-4" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClear}
            disabled={isSaving}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {t("defaultModels.clearButton")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isConfigured || isSaving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>{t("defaultModels.saving")}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{t("defaultModels.saveButton")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DefaultModelsPage;
