import { useMemo } from 'react';
import { Check, ChevronsUpDown, PanelRight } from 'lucide-react';
import { useLayout } from './context';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  NavigationIcons,
  getNavigationRoutesByGroup,
} from '@/config/routeConfig';
import { useAuthStore } from '@/stores/authStore';
import { PLUGIN_NAME_ENUM } from '@/types/plugins';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import React from 'react';

export function SidebarHeader() {
  const { sidebarToggle } = useLayout();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('layout');
  
  // 获取模块状态
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const enabledModules = useAuthStore((state) => state.moduleState.enabledModules);
  const { isAdmin } = useIsAdmin();

  // Translation mapping for navigation labels
  const getTranslatedLabel = (key: PLUGIN_NAME_ENUM): string => {
    const labelMap: Partial<Record<PLUGIN_NAME_ENUM, string>> = {
      [PLUGIN_NAME_ENUM.MESSAGING]: t('navigation.messages'),
      [PLUGIN_NAME_ENUM.FEED]: t('navigation.infoFeed'),
      [PLUGIN_NAME_ENUM.PROJECT]: t('navigation.projects'),
      [PLUGIN_NAME_ENUM.FORUM]: t('navigation.forum'),
      [PLUGIN_NAME_ENUM.ARTIFACT]: t('navigation.artifact'),
      [PLUGIN_NAME_ENUM.WIKI]: t('navigation.wiki'),
      [PLUGIN_NAME_ENUM.DOCUMENTS]: t('navigation.documents'),
      [PLUGIN_NAME_ENUM.AGENTWORLD]: t('navigation.agentWorld'),
      [PLUGIN_NAME_ENUM.PROFILE]: t('navigation.profile'),
      [PLUGIN_NAME_ENUM.README]: t('navigation.readme'),
      [PLUGIN_NAME_ENUM.MOD_MANAGEMENT]: t('navigation.modManagement'),
      [PLUGIN_NAME_ENUM.SERVICE_AGENTS]: t('navigation.serviceAgents'),
      [PLUGIN_NAME_ENUM.LLM_LOGS]: t('navigation.llmLogs'),
    };
    return labelMap[key] || key;
  };

  // Check if current route matches a navigation route
  const isRouteActive = (route: string) => {
    if (route === "/messaging") {
      return location.pathname === "/messaging" || location.pathname === "/messaging/";
    }
    return location.pathname.startsWith(route);
  };

  // Get all navigation routes (same logic as SidebarPrimary)
  const primaryRoutes = getNavigationRoutesByGroup("primary");
  let secondaryRoutes = getNavigationRoutesByGroup("secondary");

  // Extract README route to pin it at the top (same as SidebarPrimary)
  const readmeRoute = primaryRoutes.find(
    (route) => route.navigationConfig?.key === PLUGIN_NAME_ENUM.README
  );
  const otherPrimaryRoutes = primaryRoutes.filter(
    (route) => route.navigationConfig?.key !== PLUGIN_NAME_ENUM.README
  );

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


  // Find current active menu item based on route
  const currentMenuItem = useMemo(() => {
    const allRoutes = [...primaryRoutes, ...secondaryRoutes];
    
    // Find the route that matches current pathname
    for (const route of allRoutes) {
      const routePath = route.path.replace("/*", "");
      if (isRouteActive(routePath) && route.navigationConfig) {
        const IconComponent = NavigationIcons[route.navigationConfig.icon] as React.ComponentType;
        const colors = [
          'bg-teal-600 text-white',
          'bg-violet-500 text-white',
          'bg-lime-500 text-white',
          'bg-blue-500 text-white',
          'bg-yellow-500 text-white',
          'bg-pink-500 text-white',
          'bg-indigo-500 text-white',
          'bg-fuchsia-600 text-white',
        ];
        const colorIndex = allRoutes.indexOf(route) % colors.length;
        
        return {
          icon: IconComponent,
          name: getTranslatedLabel(route.navigationConfig.key),
          color: colors[colorIndex],
          route: routePath,
        };
      }
    }
    
    // Default fallback
    return {
      icon: NavigationIcons.Messages as React.ComponentType,
      name: getTranslatedLabel(PLUGIN_NAME_ENUM.MESSAGING),
      color: 'bg-teal-600 text-white',
      route: '/messaging',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, primaryRoutes, secondaryRoutes, t]);

  // Generate all menu items for dropdown (same order as SidebarPrimary)
  const menuItems = useMemo(() => {
    const items: Array<{
      icon: React.ComponentType;
      name: string;
      color: string;
      route: string;
      active: boolean;
    }> = [];

    let currentIndex = 0;

    // Add README icon at the top if exists (same as SidebarPrimary)
    if (readmeRoute) {
      const route = readmeRoute.path.replace("/*", "");
      items.push({
        icon: NavigationIcons[readmeRoute.navigationConfig!.icon] as React.ComponentType,
        name: getTranslatedLabel(readmeRoute.navigationConfig!.key),
        color: 'bg-blue-500 text-white',
        route: route,
        active: isRouteActive(route),
      });
      currentIndex++;
    }

    // Add primary routes (excluding README) - same colors as SidebarPrimary
    otherPrimaryRoutes.forEach((route) => {
      const routePath = route.path.replace("/*", "");
      const colors = [
        'bg-violet-500 text-white',
        'bg-teal-500 text-white',
        'bg-lime-500 text-white',
        'bg-blue-500 text-white',
        'bg-yellow-500 text-white',
        'bg-pink-500 text-white',
        'bg-indigo-500 text-white',
      ];
      items.push({
        icon: NavigationIcons[route.navigationConfig!.icon] as React.ComponentType,
        name: getTranslatedLabel(route.navigationConfig!.key),
        color: colors[currentIndex % colors.length],
        route: routePath,
        active: isRouteActive(routePath),
      });
      currentIndex++;
    });

    // Add secondary routes - same colors as SidebarPrimary
    secondaryRoutes.forEach((route) => {
      const routePath = route.path.replace("/*", "");
      const colors = [
        'bg-gray-500 text-white',
        'bg-orange-500 text-white',
      ];
      items.push({
        icon: NavigationIcons[route.navigationConfig!.icon] as React.ComponentType,
        name: getTranslatedLabel(route.navigationConfig!.key),
        color: colors[currentIndex % colors.length],
        route: routePath,
        active: isRouteActive(routePath),
      });
      currentIndex++;
    });

    // Debug: log menu items
    if (process.env.NODE_ENV === 'development') {
      console.log('SidebarHeader - menuItems:', items.length, items.map(i => i.name));
    }
    
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readmeRoute, otherPrimaryRoutes, secondaryRoutes, location.pathname, t]);

  return (
    <div className="flex border-b border-border items-center gap-2 h-[calc(var(--header-height)-1px)]">
      <div className="flex items-center w-full">
        {/* Sidebar header */}
        <div className="flex w-full grow items-center justify-between px-5 gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground px-1.5 -ms-1.5 rounded-md hover:bg-accent transition-colors"
              >
                <div className={cn("size-6 flex items-center justify-center rounded-md shrink-0", currentMenuItem.color)}>
                  <div className="size-4">
                    {React.createElement(currentMenuItem.icon)}
                  </div>
                </div>

                <span className="text-foreground text-sm font-medium whitespace-nowrap">
                  {currentMenuItem.name}
                </span>
                <ChevronsUpDown className="opacity-100 shrink-0 size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 bg-white dark:bg-gray-900 shadow-lg z-[100] min-w-[14rem]"
              side="bottom"
              align="start"
              sideOffset={8}
              alignOffset={0}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {menuItems.length > 0 ? (
                menuItems.map((item) => (
                  <DropdownMenuItem 
                    key={item.route} 
                    onClick={() => {
                      navigate(item.route);
                    }} 
                    data-active={item.active}
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 flex items-center gap-2 rounded-md px-2 py-1.5"
                  >
                    <div className={cn("size-6 rounded-md flex items-center justify-center shrink-0", item.color)}>
                      <div className="size-4">
                        {React.createElement(item.icon)}
                      </div>
                    </div>
                    <span className="text-foreground text-sm font-medium flex-1">{item.name}</span>
                    {item.active && (
                      <Check className="ms-auto size-4 text-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled className="text-muted-foreground text-sm">
                  No menu items available
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sidebar toggle */}
          <Button
            mode="icon"
            variant="ghost"
            onClick={sidebarToggle}
            className="hidden lg:inline-flex text-muted-foreground hover:text-foreground"
          >
            <PanelRight className="opacity-100" />
          </Button>
        </div>        
      </div>
    </div>
  );
}
