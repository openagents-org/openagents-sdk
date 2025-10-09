import React, { useCallback } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { DocumentsView } from "@/components";
import { useDocumentStore } from "@/stores/documentStore";
import DocumentEditor from "@/components/documents/DocumentEditor";

/**
 * Documents Main Page - handles all document-related functionality
 */
const DocumentsMainPage: React.FC = () => {
  const navigate = useNavigate();

  const { documents, selectedDocumentId, setSelectedDocument, setDocuments } =
    useDocumentStore();

  // Document selection handler
  const handleDocumentSelect = useCallback(
    (documentId: string | null) => {
      setSelectedDocument(documentId);
    },
    [setSelectedDocument]
  );

  return (
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
  );
};

export default DocumentsMainPage;
