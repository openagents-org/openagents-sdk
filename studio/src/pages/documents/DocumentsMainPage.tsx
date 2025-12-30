import React, { useCallback, useEffect, useContext, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/useMediaQuery";
import DocumentsSidebar from "./DocumentsSidebar";
import { DocumentsView } from "@/components";
import { useDocumentStore } from "@/stores/documentStore";
import DocumentEditor from "@/components/documents/DocumentEditor";
import { OpenAgentsContext } from "@/context/OpenAgentsProvider";

/**
 * Documents Main Page - handles all document-related functionality
 * Contains sidebar and main content area
 */
const DocumentsMainPage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const location = useLocation();

  const context = useContext(OpenAgentsContext);
  const openAgentsService = context?.connector;
  const isConnected = context?.isConnected;

  const {
    documents,
    selectedDocumentId,
    setSelectedDocument,
    setDocuments,
    setConnection,
    loadDocuments,
    setupEventListeners,
    cleanupEventListeners,
  } = useDocumentStore();

  // Setup connection
  useEffect(() => {
    if (openAgentsService) {
      setConnection(openAgentsService);
    }
  }, [openAgentsService, setConnection]);

  // Load documents when connected
  useEffect(() => {
    if (openAgentsService && isConnected) {
      console.log("DocumentsMainPage: Connection ready, loading documents");
      loadDocuments();
    }
  }, [openAgentsService, isConnected, loadDocuments]);

  // Setup document event listeners
  useEffect(() => {
    if (openAgentsService) {
      console.log("DocumentsMainPage: Setting up document event listeners");
      setupEventListeners();

      return () => {
        console.log("DocumentsMainPage: Cleaning up document event listeners");
        cleanupEventListeners();
      };
    }
  }, [openAgentsService, setupEventListeners, cleanupEventListeners]);

  // Close drawer when route changes on mobile
  React.useEffect(() => {
    if (isMobile) {
      setIsDrawerOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Document selection handler
  const handleDocumentSelect = useCallback(
    (documentId: string | null) => {
      setSelectedDocument(documentId);
    },
    [setSelectedDocument]
  );

  // Sidebar content component
  const SidebarContent = () => (
    <div className=" bg-white dark:bg-gray-800 overflow-hidden border-r border-gray-200 dark:border-gray-700 flex flex-col w-full h-full">
      <ScrollArea className="shrink-0 flex-1 mt-0 mb-2.5 h-full">
        <div className="h-full">
          <DocumentsSidebar />
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
          {/* Default document view */}
          <Route
            index
            element={
              <DocumentsView
                onBackClick={() => navigate("/chat")}
                documents={documents}
                selectedDocumentId={selectedDocumentId}
                onDocumentSelect={handleDocumentSelect}
                onDocumentsChange={setDocuments}
              />
            }
          />

          {/* Document editor page */}
          <Route
            path=":documentId"
            element={<DocumentEditor />}
          />
        </Routes>
      </div>
    </div>
  );
};

export default DocumentsMainPage;
