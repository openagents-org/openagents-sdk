import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import OpenAgentsLogo from "@/assets/images/openagents-logo-trans-white.png";
import StarfieldBackground from "./StarfieldBackground";
import "./OnboardingStep1.css";

interface OnboardingStep1Props {
  onNext: () => void;
}

const OnboardingStep1: React.FC<OnboardingStep1Props> = ({ onNext }) => {
  const { t } = useTranslation('onboarding');
  const [isVisible, setIsVisible] = useState(false);
  const [pulseIndex, setPulseIndex] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    // 循环脉冲动画
    const interval = setInterval(() => {
      setPulseIndex((prev) => (prev + 1) % 3);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* 3D 星空背景 */}
      <StarfieldBackground />
      
      {/* 紫色渐变光晕叠加层 */}
      <div className="absolute inset-0 bg-gradient-radial from-purple-600/20 via-indigo-600/10 to-transparent pointer-events-none" />

      <div
        className={`max-w-4xl w-full bg-white/10 dark:bg-gray-800/20 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/20 transition-all duration-1000 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="p-12 text-center relative z-10">
          {/* Logo 淡入旋转动画 */}
          <div
            className={`mb-8 transition-all duration-1000 delay-200 ${
              isVisible ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 rotate-180"
            }`}
          >
            <div className="relative inline-block">
              <img
                src={OpenAgentsLogo}
                alt="OpenAgents Logo"
                className="w-24 h-24 mx-auto mb-6 drop-shadow-2xl animate-float"
              />
              {/* Logo 光晕 */}
              <div className="absolute inset-0 bg-indigo-400/30 rounded-full blur-2xl animate-pulse" />
            </div>
            <h1 className="text-6xl font-bold mb-4 text-white drop-shadow-lg">
              <span className="bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent animate-gradient-text">
                OpenAgents
              </span>
            </h1>
            <p
              className={`text-xl text-gray-200 mb-2 transition-all duration-1000 delay-500 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              {t('step1.subtitle')}
            </p>
          </div>

          {/* 代理网络可视化 - 带动画 */}
          <div
            className={`mb-12 transition-all duration-1000 delay-700 ${
              isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
          >
            <div className="bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl p-8 mb-8 backdrop-blur-sm border border-white/20 relative overflow-hidden">
              {/* 背景网格动画 */}
              <div className="absolute inset-0 opacity-10">
                <div
                  className="absolute inset-0 animate-grid-move"
                  style={{
                    backgroundImage: `
                      linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px),
                      linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: "50px 50px",
                  }}
                />
              </div>

              <div className="flex items-center justify-center space-x-8 mb-6 relative z-10">
                {/* 代理 A */}
                <div className="text-center">
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-2 relative transition-all duration-500 ${
                      pulseIndex === 0
                        ? "bg-indigo-500 scale-110 shadow-lg shadow-indigo-500/50 animate-pulse-ring"
                        : "bg-indigo-500/80 scale-100"
                    }`}
                  >
                    <span className="relative z-10">A</span>
                    {pulseIndex === 0 && (
                      <div className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-75" />
                    )}
                  </div>
                  <div className="text-sm text-gray-200 font-medium">{t('step1.agentA')}</div>
                </div>

                {/* 连接线 1 - 带流动动画 */}
                <div className="flex-1 relative h-1">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full opacity-60" />
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent rounded-full animate-flow"
                    style={{ width: "30%" }}
                  />
                </div>

                {/* 代理 B */}
                <div className="text-center">
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-2 relative transition-all duration-500 ${
                      pulseIndex === 1
                        ? "bg-purple-500 scale-110 shadow-lg shadow-purple-500/50 animate-pulse-ring"
                        : "bg-purple-500/80 scale-100"
                    }`}
                  >
                    <span className="relative z-10">B</span>
                    {pulseIndex === 1 && (
                      <div className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-75" />
                    )}
                  </div>
                  <div className="text-sm text-gray-200 font-medium">{t('step1.agentB')}</div>
                </div>

                {/* 连接线 2 - 带流动动画 */}
                <div className="flex-1 relative h-1">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-60" />
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent rounded-full animate-flow"
                    style={{ width: "30%", animationDelay: "1s" }}
                  />
                </div>

                {/* 代理 C */}
                <div className="text-center">
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-2 relative transition-all duration-500 ${
                      pulseIndex === 2
                        ? "bg-pink-500 scale-110 shadow-lg shadow-pink-500/50 animate-pulse-ring"
                        : "bg-pink-500/80 scale-100"
                    }`}
                  >
                    <span className="relative z-10">C</span>
                    {pulseIndex === 2 && (
                      <div className="absolute inset-0 rounded-full bg-pink-400 animate-ping opacity-75" />
                    )}
                  </div>
                  <div className="text-sm text-gray-200 font-medium">{t('step1.agentC')}</div>
                </div>
              </div>

              {/* 网络标签 - 带闪烁效果 */}
              <div className="text-center relative z-10">
                <div className="inline-block bg-gradient-to-r from-indigo-500/30 to-purple-500/30 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/30">
                  <span className="text-white font-semibold text-lg flex items-center justify-center">
                    <span className="mr-2">🌐</span>
                    <span className="animate-pulse">{t('step1.network')}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 按钮区域 - 带淡入动画 */}
          <div
            className={`space-y-4 transition-all duration-1000 delay-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            }`}
          >
            <button
              onClick={onNext}
              className="group relative w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-semibold py-5 px-8 rounded-xl text-lg transition-all transform hover:scale-105 active:scale-95 shadow-2xl shadow-purple-500/50 overflow-hidden"
            >
              {/* 按钮光效 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <span className="relative z-10 flex items-center justify-center">
                {t('step1.startButton')}
                <span className="ml-2 group-hover:translate-x-1 transition-transform duration-300">
                  →
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default OnboardingStep1;

