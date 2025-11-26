import { PLUGIN_NAME_ENUM } from "@/types/plugins"
import { updateRouteVisibility } from "@/config/routeConfig"

// 模块名到插件枚举的映射
const MODULE_PLUGIN_MAP: Record<string, PLUGIN_NAME_ENUM> = {
  messaging: PLUGIN_NAME_ENUM.MESSAGING,
  project: PLUGIN_NAME_ENUM.PROJECT,
  "openagents.mods.workspace.project": PLUGIN_NAME_ENUM.PROJECT,
  documents: PLUGIN_NAME_ENUM.DOCUMENTS,
  forum: PLUGIN_NAME_ENUM.FORUM,
  wiki: PLUGIN_NAME_ENUM.WIKI,
}

// 从 API 健康检查响应中提取启用的模块
export interface ModuleInfo {
  name: string
  enabled: boolean
  config?: Record<string, any>
}

export interface HealthResponse {
  success: boolean
  status: string
  data: {
    network_id: string
    network_name: string
    is_running: boolean
    mods: ModuleInfo[]
    [key: string]: any
  }
}

/**
 * 从模块全名中提取模块名称
 * 例：'openagents.mods.workspace.messaging' -> 'messaging'
 */
export const extractModuleName = (fullModuleName: string): string => {
  return fullModuleName.split(".").pop() || ""
}

/**
 * 从健康检查响应中获取启用的模块列表
 */
export const getEnabledModules = (healthResponse: HealthResponse): string[] => {
  if (!healthResponse.success || !healthResponse.data?.mods) {
    return []
  }

  return healthResponse.data.mods
    .filter((mod) => mod.enabled)
    .map((mod) => extractModuleName(mod.name))
    .filter((moduleName) => moduleName in MODULE_PLUGIN_MAP)
}

/**
 * 根据启用的模块更新路由可见性
 */
export const updateRouteVisibilityFromModules = (
  enabledModules: string[]
): void => {
  // 首先隐藏所有主要路由（只保留 Profile 始终可见，它不是一个 mod）
  // Settings 如果作为 mod 存在，也应该由网络返回来控制
  Object.values(PLUGIN_NAME_ENUM).forEach((plugin) => {
    if (plugin !== PLUGIN_NAME_ENUM.PROFILE) {
      updateRouteVisibility(plugin, false)
    }
  })

  // 然后根据网络返回的 mods 启用对应的路由
  enabledModules.forEach((moduleName) => {
    const plugin = MODULE_PLUGIN_MAP[moduleName]
    if (plugin) {
      console.log(`✅ updateRouteVisibility: ${moduleName} -> ${plugin}`)
      updateRouteVisibility(plugin, true)
    }
  })
  
  console.log(`📊 updateRouteVisibilityFromModules: ${enabledModules.join(', ')}`)
}

/**
 * 获取默认路由（第一个启用的模块）
 */
export const getDefaultRoute = (enabledModules: string[]): string => {
  if (enabledModules.length === 0) {
    // 如果没有启用的模块，回退到 profile
    return "/profile"
  }

  // 按优先级排序模块
  const priorityOrder = ["messaging", "documents", "forum", "wiki"]

  for (const priority of priorityOrder) {
    if (enabledModules.includes(priority)) {
      return `/${priority}`
    }
  }

  // 如果没有匹配的优先级模块，返回第一个可用的
  return `/${enabledModules[0]}`
}

/**
 * 检查特定模块是否启用
 */
export const isModuleEnabled = (
  moduleName: string,
  enabledModules: string[]
): boolean => {
  return enabledModules.includes(moduleName)
}

/**
 * 验证路由是否在启用的模块中可用
 */
export const isRouteAvailable = (
  route: string,
  enabledModules: string[]
): boolean => {
  // 提取路径的第一段作为模块名称
  const routeName = route.replace(/^\//, "").split("/")[0]

  // 检查特殊路由（总是可用）
  const alwaysAvailableRoutes = [
    "profile",
    "settings",
    "network-selection",
    "agent-setup",
  ]
  if (alwaysAvailableRoutes.includes(routeName)) {
    return true
  }

  return enabledModules.includes(routeName)
}

/**
 * 从健康检查响应生成完整的路由配置
 */
export const generateRouteConfigFromHealth = (
  healthResponse: HealthResponse
) => {
  const enabledModules = getEnabledModules(healthResponse)
  const defaultRoute = getDefaultRoute(enabledModules)

  return {
    enabledModules,
    defaultRoute,
    networkId: healthResponse.data.network_id,
    networkName: healthResponse.data.network_name,
  }
}
