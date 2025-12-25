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
import { Card, CardContent } from '@/components/layout/ui/card';
import { ScrollArea } from '@/components/layout/ui/scroll-area';
import { Lock, Settings, Trash2, RefreshCw, Package, Clock, FolderCode } from 'lucide-react';

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
  const [refreshing, setRefreshing] = useState(false);
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

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

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
    return date.toLocaleString();
  };

  // Check admin permission
  if (isCheckingAdmin) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('modManagement.checkingPermissions')}
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <Lock className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('modManagement.accessDenied')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {t('modManagement.adminOnly')}
          </p>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
          >
            {t('modManagement.goBack')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t('modManagement.title')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {t('modManagement.subtitle')}
            </p>
          </div>

          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? t('modManagement.loadedMods.refreshing') : t('modManagement.loadedMods.refresh')}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Load Module Form */}
          <Card className="border-gray-200 dark:border-gray-700">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <Package className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('modManagement.loadMod.title')}
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('modManagement.loadMod.modPath')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={modPath}
                    onChange={(e) => setModPath(e.target.value)}
                    placeholder={t('modManagement.loadMod.modPathPlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('modManagement.loadMod.config')}
                  </label>
                  <Textarea
                    value={modConfig}
                    onChange={(e) => setModConfig(e.target.value)}
                    placeholder={t('modManagement.loadMod.configPlaceholder')}
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono resize-none"
                    disabled={loading}
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleLoadMod}
                  disabled={loading || !modPath.trim()}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400"
                >
                  {loading ? t('modManagement.loadMod.loading') : t('modManagement.loadMod.button')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Loaded Modules List */}
          <Card className="border-gray-200 dark:border-gray-700">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                    <FolderCode className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t('modManagement.loadedMods.title')}
                  </h2>
                </div>
                <Badge variant="secondary" appearance="light" size="sm">
                  {t('modManagement.loadedMods.total')}: {dynamicMods?.count || 0}
                </Badge>
              </div>

              {dynamicMods && dynamicMods.count > 0 ? (
                <div className="space-y-3">
                  {Object.values(dynamicMods.details).map((mod) => (
                    <div
                      key={mod.mod_id}
                      className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {mod.mod_id}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                              {t('modManagement.loadedMods.loaded')}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate mb-1">
                            {mod.mod_path}
                          </div>
                          <div className="flex items-center text-xs text-gray-400 dark:text-gray-500">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatTimestamp(mod.loaded_at)}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnloadMod(mod.mod_path)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {t('modManagement.loadedMods.unload')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Settings className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('modManagement.loadedMods.empty')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
};

export default ModManagementPage;
