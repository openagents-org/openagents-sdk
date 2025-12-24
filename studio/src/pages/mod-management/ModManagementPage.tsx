import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useProfileData } from '@/pages/profile/hooks/useProfileData';
import { useAuthStore } from '@/stores/authStore';
import { useOpenAgents } from '@/context/OpenAgentsProvider';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Button } from '@/components/layout/ui/button';
import { Input } from '@/components/layout/ui/input';
import { Textarea } from '@/components/layout/ui/textarea';
import { Badge } from '@/components/layout/ui/badge';
import { Lock, Settings, Trash2 } from 'lucide-react';

interface DynamicModInfo {
  mod_id: string;
  mod_path: string;
  loaded_at: number;
}

interface DynamicModsData {
  loaded: string[];
  count: number;
  details: { [mod_id: string]: DynamicModInfo };
}

const ModManagementPage: React.FC = () => {
  const { t } = useTranslation('admin');
  const { agentName } = useAuthStore();
  const { connector } = useOpenAgents();
  const { healthData, refresh } = useProfileData();
  const { isAdmin, isLoading: isCheckingAdmin } = useIsAdmin();

  const [loading, setLoading] = useState(false);
  const [modPath, setModPath] = useState('');
  const [modConfig, setModConfig] = useState('{}');
  const [dynamicMods, setDynamicMods] = useState<DynamicModsData | null>(null);

  // Extract dynamic_mods information from healthData
  useEffect(() => {
    if (healthData?.data?.dynamic_mods) {
      setDynamicMods(healthData.data.dynamic_mods as DynamicModsData);
    } else {
      setDynamicMods({
        loaded: [],
        count: 0,
        details: {},
      });
    }
  }, [healthData]);

  // Load Mod
  const handleLoadMod = useCallback(async () => {
    if (!modPath.trim()) {
      toast.error(t('modManagement.loadMod.enterModPath'));
      return;
    }

    if (!connector) {
      toast.error(t('modManagement.loadMod.notConnected'));
      return;
    }

    setLoading(true);
    try {
      let configObj = {};
      try {
        if (modConfig.trim()) {
          configObj = JSON.parse(modConfig);
        }
      } catch (e) {
        toast.error(t('modManagement.loadMod.invalidJson'));
        setLoading(false);
        return;
      }

      const response = await connector.sendEvent({
        event_name: 'system.mod.load',
        source_id: agentName || 'system',
        destination_id: 'system:system',
        payload: {
          mod_path: modPath.trim(),
          config: configObj,
        },
      });

      if (response.success) {
        toast.success(t('modManagement.loadMod.loadSuccess', { modId: response.data?.mod_id || modPath }));
        setModPath('');
        setModConfig('{}');
        // Refresh data
        setTimeout(() => {
          refresh();
        }, 500);
      } else {
        toast.error(t('modManagement.loadMod.loadFailed', { error: response.message || 'Unknown error' }));
      }
    } catch (error: any) {
      console.error('Failed to load Mod:', error);
      toast.error(t('modManagement.loadMod.loadFailed', { error: error.message || 'Unknown error' }));
    } finally {
      setLoading(false);
    }
  }, [modPath, modConfig, connector, agentName, refresh, t]);

  // Unload Mod
  const handleUnloadMod = useCallback(async (modPathToUnload: string) => {
    if (!connector) {
      toast.error(t('modManagement.loadMod.notConnected'));
      return;
    }

    setLoading(true);
    try {
      const response = await connector.sendEvent({
        event_name: 'system.mod.unload',
        source_id: agentName || 'system',
        destination_id: 'system:system',
        payload: {
          mod_path: modPathToUnload,
        },
      });

      if (response.success) {
        toast.success(t('modManagement.loadedMods.unloadSuccess', { modId: response.data?.mod_id || modPathToUnload }));
        // Refresh data
        setTimeout(() => {
          refresh();
        }, 500);
      } else {
        toast.error(t('modManagement.loadedMods.unloadFailed', { error: response.message || 'Unknown error' }));
      }
    } catch (error: any) {
      console.error('Failed to unload Mod:', error);
      toast.error(t('modManagement.loadedMods.unloadFailed', { error: error.message || 'Unknown error' }));
    } finally {
      setLoading(false);
    }
  }, [connector, agentName, refresh, t]);

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US');
  };

  // Check admin permission
  if (isCheckingAdmin) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {t('modManagement.checkingPermissions')}
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mb-6">
            <Lock className="w-24 h-24 mx-auto text-gray-400 dark:text-gray-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('modManagement.accessDenied')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('modManagement.adminOnly')}
          </p>
          <Button
            variant="primary"
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('modManagement.goBack')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('modManagement.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('modManagement.subtitle')}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Load Mod Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('modManagement.loadMod.title')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('modManagement.loadMod.modPath')} <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  variant="lg"
                  value={modPath}
                  onChange={(e) => setModPath(e.target.value)}
                  placeholder={t('modManagement.loadMod.modPathPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('modManagement.loadMod.config')}
                </label>
                <Textarea
                  variant="lg"
                  value={modConfig}
                  onChange={(e) => setModConfig(e.target.value)}
                  placeholder={t('modManagement.loadMod.configPlaceholder')}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                  disabled={loading}
                />
              </div>
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={handleLoadMod}
                disabled={loading || !modPath.trim()}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('modManagement.loadMod.loading') : t('modManagement.loadMod.button')}
              </Button>
            </div>
          </div>

          {/* Loaded Mods List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('modManagement.loadedMods.title')}
              </h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {t('modManagement.loadedMods.total')}: {dynamicMods?.count || 0}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={refresh}
                  disabled={loading}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                >
                  {t('modManagement.loadedMods.refresh')}
                </Button>
              </div>
            </div>

            {dynamicMods && dynamicMods.count > 0 ? (
              <div className="space-y-3">
                {Object.values(dynamicMods.details).map((mod) => (
                  <div
                    key={mod.mod_id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {mod.mod_id}
                        </span>
                        <Badge variant="success" appearance="light" size="sm">
                          Loaded
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                        {mod.mod_path}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Loaded at: {formatTimestamp(mod.loaded_at)}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleUnloadMod(mod.mod_path)}
                      disabled={loading}
                      className="ml-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {loading ? t('modManagement.loadedMods.unloading') : t('modManagement.loadedMods.unload')}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Settings className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {t('modManagement.loadedMods.empty')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModManagementPage;
