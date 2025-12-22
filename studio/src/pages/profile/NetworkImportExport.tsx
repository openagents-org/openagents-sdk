import React, { useState } from "react";
import { networkManagementService } from "@/services/networkManagementService";
import { ImportMode } from "@/types/networkManagement";
import ImportDropzone from "@/components/network/ImportDropzone";
import ImportPreviewModal from "@/components/network/ImportPreviewModal";
import ExportOptionsModal from "@/components/network/ExportOptionsModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { profileSelectors } from "@/stores/profileStore";
import { useAuthStore } from "@/stores/authStore";
import { useOpenAgents } from "@/context/OpenAgentsProvider";

const NetworkImportExport: React.FC = () => {
  const networkInfo = profileSelectors.useNetworkInfo();
  const { selectedNetwork, agentName } = useAuthStore();
  const { connector } = useOpenAgents();
  const networkName = networkInfo?.networkName || "Network";

  // Export state
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [pendingImportMode, setPendingImportMode] = useState<ImportMode | null>(null);
  const [pendingNewName, setPendingNewName] = useState<string | undefined>(undefined);

  // Handle export
  const handleExportClick = () => {
    setShowExportOptions(true);
  };

  const handleExportConfirm = async (options: any) => {
    setIsExporting(true);
    setShowExportOptions(false);

    try {
      // Get secret and agentId for authentication
      const secret = connector?.getSecret() || null;
      const agentId = agentName || null;

      if (!secret || !agentId) {
        throw new Error("需要先登录才能导出网络配置");
      }

      const blob = await networkManagementService.exportNetwork(
        options,
        agentId,
        secret
      );
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${networkName}_${timestamp}.zip`;
      networkManagementService.downloadBlob(blob, filename);
    } catch (error: any) {
      alert(`导出失败: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle import file selection
  const handleFileSelected = async (file: File) => {
    setSelectedFile(file);
    setIsImporting(true);

    try {
      // Get secret and agentId for authentication
      const secret = connector?.getSecret() || null;
      const agentId = agentName || null;

      if (!secret || !agentId) {
        throw new Error("需要先登录才能验证导入文件");
      }

      const result = await networkManagementService.validateImport(
        file,
        agentId,
        secret
      );
      setValidationResult(result);
      if (result.valid) {
        setShowPreview(true);
      } else {
        alert(`验证失败:\n${result.errors.join("\n")}`);
      }
    } catch (error: any) {
      alert(`验证失败: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle import confirm
  const handleImportConfirm = (mode: ImportMode, newName?: string) => {
    if (mode === ImportMode.OVERWRITE) {
      setPendingImportMode(mode);
      setPendingNewName(newName);
      setShowOverwriteConfirm(true);
    } else {
      performImport(mode, newName);
    }
  };

  const performImport = async (mode: ImportMode, newName?: string) => {
    if (!selectedFile) return;

    setShowPreview(false);
    setShowOverwriteConfirm(false);
    setIsImporting(true);

    try {
      // Get secret and agentId for authentication
      const secret = connector?.getSecret() || null;
      const agentId = agentName || null;

      if (!secret || !agentId) {
        throw new Error("需要先登录才能导入网络配置");
      }

      const result = await networkManagementService.applyImport(
        selectedFile,
        mode,
        newName,
        agentId,
        secret
      );

      if (result.success) {
        const networkName = result.applied_config?.network_name || "网络";
        if (result.network_restarted) {
          alert(`导入成功！网络已重启。\n网络名称: ${networkName}`);
          // Refresh profile data after successful import
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          // 如果是异步执行，network_restarted 会是 false，但导入已启动
          const errorMsg = result.errors && result.errors.length > 0 
            ? result.errors.join("\n")
            : "网络重启状态未知（异步执行中）";
          alert(
            `配置导入已启动。\n网络名称: ${networkName}\n状态: ${errorMsg}`
          );
        }
      } else {
        const errorMsg = result.errors && result.errors.length > 0
          ? result.errors.join("\n")
          : result.message;
        alert(`导入失败: ${errorMsg}`);
      }
    } catch (error: any) {
      alert(`导入失败: ${error.message}`);
    } finally {
      setIsImporting(false);
      setSelectedFile(null);
      setValidationResult(null);
      setPendingImportMode(null);
      setPendingNewName(undefined);
    }
  };

  const handleOverwriteConfirm = () => {
    if (pendingImportMode) {
      performImport(pendingImportMode, pendingNewName);
    }
  };

  if (!selectedNetwork) {
    return (
      <div className="p-6 dark:bg-gray-900 h-full">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            请先连接到网络
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 dark:bg-gray-900 h-full min-h-screen overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          网络导入/导出
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          备份、恢复或迁移网络配置
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <svg
              className="w-6 h-6 text-blue-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              导出网络配置
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            将当前网络配置导出为 .zip 文件，用于备份或分享。
          </p>
          <button
            onClick={handleExportClick}
            disabled={isExporting}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? "导出中..." : "导出网络配置"}
          </button>
        </div>

        {/* Import Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <svg
              className="w-6 h-6 text-green-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              导入网络配置
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            从 .zip 文件导入网络配置，可以覆盖当前配置或创建新网络。
          </p>
          <ImportDropzone
            onFileSelected={handleFileSelected}
            disabled={isImporting}
          />
        </div>
      </div>

      {/* Modals */}
      <ExportOptionsModal
        isOpen={showExportOptions}
        onClose={() => setShowExportOptions(false)}
        onConfirm={handleExportConfirm}
        isExporting={isExporting}
      />

      <ImportPreviewModal
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false);
          setSelectedFile(null);
          setValidationResult(null);
        }}
        onConfirm={handleImportConfirm}
        validationResult={validationResult}
        isImporting={isImporting}
      />

      <ConfirmDialog
        isOpen={showOverwriteConfirm}
        title="确认覆盖"
        message="此操作将覆盖当前网络配置。网络将在导入后自动重启。是否继续？"
        confirmText="确认覆盖"
        cancelText="取消"
        onConfirm={handleOverwriteConfirm}
        onCancel={() => {
          setShowOverwriteConfirm(false);
          setPendingImportMode(null);
          setPendingNewName(undefined);
        }}
        type="warning"
      />
    </div>
  );
};

export default NetworkImportExport;

