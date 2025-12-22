import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { getCurrentNetworkHealth } from "@/services/networkService";
import OnboardingStep1 from "@/components/onboarding/OnboardingStep1";
import OnboardingStep2 from "@/components/onboarding/OnboardingStep2";
import OnboardingStep3 from "@/components/onboarding/OnboardingStep3";
import OnboardingStep4 from "@/components/onboarding/OnboardingStep4";
import OnboardingSuccess from "@/components/onboarding/OnboardingSuccess";

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  agentCount: number;
  mods: string[];
  setupTime: string;
  agents: string[];
}

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedNetwork } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Check if onboarding is already completed
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!selectedNetwork) {
        navigate("/");
        return;
      }

      try {
        const healthResult = await getCurrentNetworkHealth(selectedNetwork);
        if (healthResult.success && healthResult.data?.data?.onboarding_completed) {
          // Already completed, redirect to admin dashboard
          navigate("/admin");
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      }
    };

    checkOnboardingStatus();
  }, [selectedNetwork, navigate]);

  const handleStep1Next = () => {
    setCurrentStep(2);
  };

  const handleStep1Skip = () => {
    // Skip onboarding - navigate directly to admin
    navigate("/admin");
  };

  const handleStep2Next = (template: Template) => {
    setSelectedTemplate(template);
    setCurrentStep(3);
  };

  const handleStep2Back = () => {
    setCurrentStep(1);
  };

  const handleStep3Next = (password: string) => {
    setAdminPassword(password);
    setCurrentStep(4);
    // Start deployment
    handleDeployment();
  };

  const handleStep3Back = () => {
    setCurrentStep(2);
  };

  const handleDeployment = async () => {
    setIsDeploying(true);
    setDeploymentProgress(0);

    // Simulate deployment progress
    const steps = [
      { progress: 25, message: "创建网络配置" },
      { progress: 50, message: "安装 mods" },
      { progress: 75, message: "配置代理" },
      { progress: 90, message: "启动代理中..." },
      { progress: 100, message: "验证连接" },
    ];

    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setDeploymentProgress(step.progress);
    }

    // 模拟部署成功，不调用真实API
    try {
      // 模拟部署延迟
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // 标记onboarding完成（可选，如果需要的话）
      // await markOnboardingComplete();
      
      setIsDeploying(false);
      setIsComplete(true);
    } catch (error) {
      console.error("Deployment simulation failed:", error);
      setIsDeploying(false);
      // Handle error
    }
  };

  const markOnboardingComplete = async () => {
    if (!selectedNetwork) return;

    const protocol = selectedNetwork.useHttps ? "https" : "http";
    const baseUrl = `${protocol}://${selectedNetwork.host}:${selectedNetwork.port}`;

    try {
      await fetch(`${baseUrl}/api/onboarding/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Failed to mark onboarding complete:", error);
    }
  };

  const handleSuccess = () => {
    navigate("/admin");
  };

  if (isComplete) {
    return (
      <OnboardingSuccess
        template={selectedTemplate!}
        agentCount={selectedTemplate?.agentCount || 0}
        onEnterDashboard={handleSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {currentStep === 1 && (
        <OnboardingStep1 onNext={handleStep1Next} onSkip={handleStep1Skip} />
      )}
      {currentStep === 2 && (
        <OnboardingStep2
          onNext={handleStep2Next}
          onBack={handleStep2Back}
        />
      )}
      {currentStep === 3 && (
        <OnboardingStep3
          onNext={handleStep3Next}
          onBack={handleStep3Back}
        />
      )}
      {currentStep === 4 && (
        <OnboardingStep4
          template={selectedTemplate!}
          isDeploying={isDeploying}
          progress={deploymentProgress}
        />
      )}
    </div>
  );
};

export default OnboardingPage;

