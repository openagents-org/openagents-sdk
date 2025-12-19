import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/layout/ui/button";
import {
  LayoutDashboard,
  Globe,
  ArrowLeftRight,
  Download,
  Users,
  UserCog,
  Server,
  Link2,
  Settings,
  FileText,
  Search,
  Monitor,
  Bug,
} from "lucide-react";

const AdminSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("admin");
  const { isAdmin } = useIsAdmin();

  const isActive = (path: string) => {
    const currentPath = location.pathname;
    // Exact match for dashboard
    if (path === "/admin/dashboard") {
      return (
        currentPath === "/admin" ||
        currentPath === "/admin/" ||
        currentPath === "/admin/dashboard"
      );
    }
    // For other paths, check if current path starts with the path
    return currentPath === path || currentPath.startsWith(path + "/");
  };

  const navSections = [
    {
      title: t("sidebar.sections.overview"),
      items: [
        {
          id: "dashboard",
          label: t("sidebar.items.dashboard"),
          path: "/admin/dashboard",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: t("sidebar.sections.network"),
      items: [
        {
          id: "network-profile",
          label: t("sidebar.items.networkProfile"),
          path: "/admin/network",
          icon: Globe,
        },
        {
          id: "transports",
          label: t("sidebar.items.transports"),
          path: "/admin/transports",
          icon: ArrowLeftRight,
        },
        {
          id: "import-export",
          label: t("sidebar.items.importExport"),
          path: "/admin/import-export",
          icon: Download,
        },
      ],
    },
    {
      title: t("sidebar.sections.agents"),
      items: [
        {
          id: "agents",
          label: t("sidebar.items.connectedAgents"),
          path: "/admin/agents",
          icon: Users,
        },
        {
          id: "groups",
          label: t("sidebar.items.agentGroups"),
          path: "/admin/groups",
          icon: UserCog,
        },
        ...(isAdmin
          ? [
              {
                id: "service-agents",
                label: t("sidebar.items.serviceAgents"),
                path: "/admin/service-agents",
                icon: Server,
              },
            ]
          : []),
        {
          id: "connect",
          label: t("sidebar.items.connectionGuide"),
          path: "/admin/connect",
          icon: Link2,
        },
      ],
    },
    {
      title: t("sidebar.sections.modules"),
      items: [
        {
          id: "mods",
          label: t("sidebar.items.modManagement"),
          path: "/admin/mods",
          icon: Settings,
        },
      ],
    },
    {
      title: t("sidebar.sections.monitoring"),
      items: [
        {
          id: "events",
          label: t("sidebar.items.eventLogs"),
          path: "/admin/events",
          icon: FileText,
        },
        {
          id: "event-explorer",
          label: t("sidebar.items.eventExplorer"),
          path: "/admin/event-explorer",
          icon: Search,
        },
        ...(isAdmin
          ? [
              {
                id: "llm-logs",
                label: t("sidebar.items.llmLogs"),
                path: "/admin/llm-logs",
                icon: Monitor,
              },
            ]
          : []),
        {
          id: "debugger",
          label: t("sidebar.items.eventDebugger"),
          path: "/admin/debugger",
          icon: Bug,
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      {/* <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("sidebar.title")}
        </h2>
      </div> */}

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto">
        {navSections.map((section, sectionIndex) => (
          <div
            key={section.title}
            className={
              sectionIndex > 0
                ? "border-t border-gray-200 dark:border-gray-700"
                : ""
            }
          >
            <div className="px-4 py-3">
              {/* Section Title */}
              <div className="px-2 mb-3">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  {section.title}
                </span>
              </div>

              {/* Section Items */}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const IconComponent = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Button
                      key={item.id}
                      variant={active ? "secondary" : "ghost"}
                      mode="default"
                      style={{ justifyContent: 'flex-start' }}
                      className={`
                        w-full h-9 px-4
                        ${active
                          ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-300"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                        }
                        transition-colors duration-150
                      `}
                      onClick={() => navigate(item.path)}
                    >
                      <IconComponent className="w-5 h-5 flex-shrink-0 mr-3" />
                      <span className="text-left">{item.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminSidebar;
