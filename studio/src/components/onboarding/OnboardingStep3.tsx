import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import StarfieldBackground from "./StarfieldBackground";

interface OnboardingStep3Props {
  onNext: (password: string) => void;
  onBack: () => void;
}

const OnboardingStep3: React.FC<OnboardingStep3Props> = ({ onNext, onBack }) => {
  const { t } = useTranslation('onboarding');
  const { selectedNetwork } = useAuthStore();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = password.length >= 8 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !selectedNetwork) return;

    try {
      setSubmitting(true);
      setError(null);

      const protocol = selectedNetwork.useHttps ? "https" : "http";
      const baseUrl = `${protocol}://${selectedNetwork.host}:${selectedNetwork.port}`;

      const response = await fetch(`${baseUrl}/api/network/initialize/admin-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      onNext(password);
    } catch (err: any) {
      console.error("Failed to set admin password:", err);
      setError(err.message || "Failed to set admin password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <StarfieldBackground />
      <div className="max-w-2xl w-full bg-white/10 dark:bg-gray-800/20 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden relative z-10 border border-white/20">
        <div className="p-8">
          <div className="mb-8">
            <div className="text-sm text-gray-300 mb-2">
              {t('step3.stepIndicator')}
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {t('step3.title')}
            </h1>
            <p className="text-gray-200">
              {t('step3.description')}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/10">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  {t('step3.adminPasswordLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/10 text-white placeholder-gray-400 pr-20"
                    placeholder={t('step3.passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  {t('step3.confirmPasswordLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/10 text-white placeholder-gray-400 pr-20"
                    placeholder={t('step3.passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div
                  className={`flex items-center ${
                    password.length >= 8
                      ? "text-green-400"
                      : "text-gray-500"
                  }`}
                >
                  <span className="mr-2">{password.length >= 8 ? "✓" : "○"}</span>
                  {t('step3.minLength')}
                </div>
                <div
                  className={`flex items-center ${
                    password === confirmPassword && confirmPassword.length > 0
                      ? "text-green-400"
                      : "text-gray-500"
                  }`}
                >
                  <span className="mr-2">
                    {password === confirmPassword && confirmPassword.length > 0
                      ? "✓"
                      : "○"}
                  </span>
                  {t('step3.passwordMatch')}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm text-gray-400 mb-6">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>{t('step3.hint')}</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={onBack}
                className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
              >
                {t('step3.backButton')}
              </button>
              <button
                type="submit"
                disabled={!isValid || submitting}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('step3.continueButton')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStep3;

