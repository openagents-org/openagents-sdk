/* eslint-disable react/jsx-no-undef */
import { useMemo, Fragment, type MouseEvent } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbLink,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { useLayout } from "./context";
import { Button } from "@/components/ui/button";
import { PanelRight, PanelLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getNavigationRoutesByGroup } from "@/config/routeConfig";
import { PLUGIN_NAME_ENUM } from "@/types/plugins";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export function HeaderBreadcrumbs() {
  const { isMobile, sidebarToggle, isSidebarOpen } = useLayout();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation("layout");
  const { isAdmin } = useIsAdmin();

  // Generate breadcrumb items based on current route
  const breadcrumbItems = useMemo(() => {
    const pathname = location.pathname;
    const items: Array<{ label: string; href: string; isActive: boolean }> = [];

    // Translation mapping for navigation labels
    const getTranslatedLabel = (key: PLUGIN_NAME_ENUM): string => {
      const labelMap: Partial<Record<PLUGIN_NAME_ENUM, string>> = {
        [PLUGIN_NAME_ENUM.MESSAGING]: t("navigation.messages"),
        [PLUGIN_NAME_ENUM.FEED]: t("navigation.infoFeed"),
        [PLUGIN_NAME_ENUM.PROJECT]: t("navigation.projects"),
        [PLUGIN_NAME_ENUM.FORUM]: t("navigation.forum"),
        [PLUGIN_NAME_ENUM.ARTIFACT]: t("navigation.artifact"),
        [PLUGIN_NAME_ENUM.WIKI]: t("navigation.wiki"),
        [PLUGIN_NAME_ENUM.DOCUMENTS]: t("navigation.documents"),
        [PLUGIN_NAME_ENUM.AGENTWORLD]: t("navigation.agentWorld"),
        [PLUGIN_NAME_ENUM.PROFILE]: t("navigation.profile"),
        [PLUGIN_NAME_ENUM.README]: t("navigation.readme"),
        [PLUGIN_NAME_ENUM.MOD_MANAGEMENT]: t("navigation.modManagement"),
        [PLUGIN_NAME_ENUM.SERVICE_AGENTS]: t("navigation.serviceAgents"),
        [PLUGIN_NAME_ENUM.LLM_LOGS]: t("navigation.llmLogs"),
        [PLUGIN_NAME_ENUM.ADMIN]: t("navigation.admin"),
      };
      return labelMap[key] || key;
    };

    // Get all routes
    const primaryRoutes = getNavigationRoutesByGroup("primary");
    let secondaryRoutes = getNavigationRoutesByGroup("secondary");

    // Add admin route if user is admin
    if (isAdmin) {
      const adminRoute = secondaryRoutes.find(
        (route) => route.navigationConfig?.key === PLUGIN_NAME_ENUM.ADMIN
      );
      if (adminRoute && !adminRoute.navigationConfig?.visible) {
        secondaryRoutes = [...secondaryRoutes];
        const adminIndex = secondaryRoutes.findIndex(
          (route) => route.navigationConfig?.key === PLUGIN_NAME_ENUM.ADMIN
        );
        if (adminIndex >= 0) {
          secondaryRoutes[adminIndex] = {
            ...secondaryRoutes[adminIndex],
            navigationConfig: {
              ...secondaryRoutes[adminIndex].navigationConfig!,
              visible: true,
            },
          };
        }
      }
    } else {
      secondaryRoutes = secondaryRoutes.filter(
        (route) => route.navigationConfig?.key !== PLUGIN_NAME_ENUM.ADMIN
      );
    }

    const allRoutes = [...primaryRoutes, ...secondaryRoutes];

    // Find matching route
    const findRoute = (path: string) => {
      return allRoutes.find((route) => {
        const routePath = route.path.replace("/*", "");
        if (routePath === "/messaging") {
          return path === "/messaging" || path === "/messaging/";
        }
        return path.startsWith(routePath);
      });
    };

    // Check if route matches
    const isRouteActive = (route: string) => {
      if (route === "/messaging") {
        return pathname === "/messaging" || pathname === "/messaging/";
      }
      return pathname.startsWith(route);
    };

    // Check if this is an admin route
    const isAdminRoute = pathname.startsWith("/admin");

    // Add home/dashboard as first item (only if not on root path and not admin route)
    if (pathname !== "/" && !isAdminRoute) {
      items.push({
        label: "Home",
        href: "/",
        isActive: false,
      });
    }

    // Find current route
    const currentRoute = findRoute(pathname);

    if (currentRoute && currentRoute.navigationConfig) {
      const routePath = currentRoute.path.replace("/*", "");
      const label = getTranslatedLabel(currentRoute.navigationConfig.key);

      // If it's the root route, don't add duplicate
      if (routePath !== "/") {
        items.push({
          label,
          href: routePath,
          isActive: isRouteActive(routePath),
        });
      }

      // Handle sub-routes (e.g., /wiki/detail/xxx)
      if (pathname !== routePath && pathname.startsWith(routePath)) {
        const subPath = pathname.replace(routePath, "");
        const segments = subPath.split("/").filter(Boolean);

        if (segments.length > 0) {
          // Add sub-route segments
          segments.forEach((segment, index) => {
            const segmentPath = `${routePath}/${segments
              .slice(0, index + 1)
              .join("/")}`;
            items.push({
              label: decodeURIComponent(segment),
              href: segmentPath,
              isActive: index === segments.length - 1,
            });
          });
        }
      }
    } else {
      // If no route found, use pathname segments
      const segments = pathname.split("/").filter(Boolean);
      segments.forEach((segment, index) => {
        const segmentPath = "/" + segments.slice(0, index + 1).join("/");
        // Capitalize first letter for admin routes
        const decodedSegment = decodeURIComponent(segment);
        const label = isAdminRoute
          ? decodedSegment.charAt(0).toUpperCase() + decodedSegment.slice(1)
          : decodedSegment;
        items.push({
          label,
          href: segmentPath,
          isActive: index === segments.length - 1,
        });
      });
    }

    return items;
  }, [location.pathname, t, isAdmin]);

  const handleBreadcrumbClick = (
    href: string,
    e: MouseEvent<HTMLAnchorElement>
  ) => {
    e.preventDefault();
    navigate(href);
  };

  return (
    <div className="flex flex-row items-center gap-2 h-[var(--header-height)] px-4 lg:px-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {!isMobile && !isSidebarOpen && (
        <Button
          mode="icon"
          variant="ghost"
          onClick={sidebarToggle}
          className="hidden lg:inline-flex text-muted-foreground hover:text-foreground"
        >
          <PanelLeft className="opacity-100 size-4" />
        </Button>
      )}
      <Breadcrumb className="flex-1 min-w-0 overflow-hidden">
        <BreadcrumbList className="gap-1.5 items-center flex-wrap min-w-0">
          {breadcrumbItems.map((item, index) => (
            <Fragment key={`${item.href}-${index}`}>
              <BreadcrumbItem>
                {item.isActive ? (
                  <BreadcrumbPage className="text-sm font-normal text-gray-700 dark:text-gray-200">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={item.href}
                    onClick={(e) => handleBreadcrumbClick(item.href, e)}
                    className="text-sm font-normal text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-200 cursor-pointer"
                  >
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {index < breadcrumbItems.length - 1 && (
                <BreadcrumbSeparator className="text-gray-400 dark:text-gray-500 text-sm">
                  /
                </BreadcrumbSeparator>
              )}
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
