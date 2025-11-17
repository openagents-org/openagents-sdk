import { HealthResponse } from "./moduleUtils";

/**
 * 检查项目模式是否启用
 */
export const isProjectModeEnabled = (healthData: HealthResponse | null): boolean => {
  if (!healthData?.data?.mods) {
    return false;
  }

  return healthData.data.mods.some(
    (mod) => mod.name === "openagents.mods.workspace.project" && mod.enabled
  );
};

/**
 * 项目模板接口定义
 */
export interface ProjectTemplate {
  template_id: string;
  name: string;
  description: string;
  agent_groups: string[];
  context: string;
}

/**
 * 从健康数据中获取项目模板列表（备用方法）
 * 主要应该使用 project.template.list 事件获取
 */
export const getProjectTemplatesFromHealth = (
  healthData: HealthResponse | null
): ProjectTemplate[] => {
  if (!healthData?.data?.mods) {
    return [];
  }

  const projectMod = healthData.data.mods.find(
    (mod) => mod.name === "openagents.mods.workspace.project" && mod.enabled
  );

  if (!projectMod?.config?.project_templates) {
    return [];
  }

  const templates = projectMod.config.project_templates;
  return Object.entries(templates).map(([templateId, templateData]: [string, any]) => ({
    template_id: templateId,
    name: templateData.name || templateId,
    description: templateData.description || "",
    agent_groups: templateData.agent_groups || [],
    context: templateData.context || "",
  }));
};

/**
 * 检查频道是否为项目频道
 */
export const isProjectChannel = (channelName: string): boolean => {
  const normalizedName = channelName.startsWith("#") 
    ? channelName.slice(1) 
    : channelName;
  return normalizedName.startsWith("project-");
};

/**
 * 从项目频道名称中提取项目 ID
 * Channel format: project-{template_id}-{project_id}
 */
export const extractProjectIdFromChannel = (channelName: string): string | null => {
  const normalizedName = channelName.startsWith("#") 
    ? channelName.slice(1) 
    : channelName;
  
  if (normalizedName.startsWith("project-")) {
    // Extract project_id from format: project-{template_id}-{project_id}
    const parts = normalizedName.replace("project-", "").split("-");
    if (parts.length >= 2) {
      // Return the project_id (everything after template_id)
      return parts.slice(1).join("-");
    }
    // Fallback for old format: project-{project_id}
    return parts[0];
  }
  
  return null;
};

