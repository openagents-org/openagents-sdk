import React, { useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/useMediaQuery";
import ForumSidebar from "./ForumSidebar";
import ForumTopicList from "@/components/forum/ForumTopicList";
import ForumTopicDetail from "@/components/forum/ForumTopicDetail";

/**
 * Forum main page - Handle all Forum-related features
 * Contains sidebar and main content area
 */
const ForumMainPage: React.FC = () => {
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const location = useLocation();

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
          <ForumSidebar />
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="h-full flex overflow-hidden dark:bg-gray-800 relative">
      {/* Mobile menu button */}
      {isMobile && (
        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
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
        <Routes>
          {/* Topic list page */}
          <Route
            index
            element={<ForumTopicList />}
          />

          {/* Topic detail page */}
          <Route
            path=":topicId"
            element={<ForumTopicDetail />}
          />
        </Routes>
      </div>
    </div>
  );
};

export default ForumMainPage;