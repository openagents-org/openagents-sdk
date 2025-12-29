import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useOpenAgents } from "@/context/OpenAgentsProvider";
import { useReadmeStore } from "@/stores/readmeStore";
import ReadmeSidebar from "./ReadmeSidebar";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";

/**
 * README Main Page - Displays README content fetched from /api/health
 * Contains sidebar and main content area
 */
const ReadmeMainPage: React.FC = () => {
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const location = useLocation();
  const { t } = useTranslation('readme');
  const { connector } = useOpenAgents();
  const [readmeContent, setReadmeContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const setStoreContent = useReadmeStore((state) => state.setContent);

  // Close drawer when route changes on mobile
  React.useEffect(() => {
    if (isMobile) {
      setIsDrawerOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Sidebar content component
  const SidebarContent = () => (
    <div className="lg:rounded-s-xl bg-white dark:bg-gray-800 overflow-hidden border-r border-gray-200 dark:border-gray-700 flex flex-col w-full h-full">
      <ScrollArea className="shrink-0 flex-1 mt-0 mb-2.5 h-full">
        <div className="h-full">
          <ReadmeSidebar />
        </div>
      </ScrollArea>
    </div>
  );

  useEffect(() => {
    const fetchReadme = async () => {
      if (!connector) {
        setError(t('error.notConnected'));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const healthData = await connector.getNetworkHealth();

        // Get readme field from healthData
        // readme may be in network_profile.readme or directly in healthData.readme
        const readme =
          healthData?.network_profile?.readme || healthData?.readme || "";

        if (readme) {
          setReadmeContent(readme);
          setStoreContent(readme);
        } else {
          setReadmeContent("");
          setStoreContent("");
        }
      } catch (err) {
        console.error("Failed to fetch README:", err);
        setError(err instanceof Error ? err.message : t('error.default'));
        setReadmeContent("");
        setStoreContent("");
      } finally {
        setLoading(false);
      }
    };

    fetchReadme();
  }, [connector, setStoreContent, t]);

  // Loading state component
  const LoadingState = () => (
    <div className="p-6 dark:bg-gray-800 h-full">
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          {t('loading')}
        </span>
      </div>
    </div>
  );

  // Error state component
  const ErrorState = () => (
    <div className="p-6 dark:bg-gray-900 h-full flex items-center justify-center">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center justify-center">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3 text-center">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              {t('error.title')}
            </h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Empty content state component
  const EmptyState = () => (
    <div className="h-full flex items-center justify-center dark:bg-gray-800">
      <div className="text-center">
        <div className="text-6xl mb-4 text-gray-400 dark:text-gray-600">
          📄
        </div>
        <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-200">
          {t('empty.title')}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
          {t('empty.description')}
        </p>
      </div>
    </div>
  );

  // Main content component
  const MainContent = () => {
    if (loading) {
      return <LoadingState />;
    }

    if (error) {
      return <ErrorState />;
    }

    if (!readmeContent) {
      return <EmptyState />;
    }

    return (
      <div className="p-6 dark:bg-gray-800 h-full min-h-screen overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('subtitle')}
          </p>
        </div>

        {/* Markdown Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <MarkdownRenderer
            content={readmeContent}
            className="prose prose-gray dark:prose-invert max-w-none"
            addHeadingIds={true}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex overflow-hidden dark:bg-gray-800 relative">
      {/* Mobile menu button */}
      {isMobile && (
        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="fixed top-4 left-4 z-30 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85%] max-w-[400px] p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <div 
          className="hidden md:block flex-shrink-0"
          style={{
            width: "calc(var(--sidebar-width) - var(--sidebar-collapsed-width))",
          }}
        >
          <SidebarContent />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
        <MainContent />
      </div>
    </div>
  );
};

export default ReadmeMainPage;
