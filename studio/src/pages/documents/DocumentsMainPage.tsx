import React, { useCallback } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { DocumentsView } from "@/components";
import { useDocumentStore } from "@/stores/documentStore";
import DocumentEditor from "@/components/documents/DocumentEditor";

/**
 * 文档主页面 - 处理文档相关的所有功能
 */
const DocumentsMainPage: React.FC = () => {
  const navigate = useNavigate();

  const { documents, selectedDocumentId, setSelectedDocument, setDocuments } =
    useDocumentStore();

  // 文档选择处理器
  const handleDocumentSelect = useCallback(
    (documentId: string | null) => {
      setSelectedDocument(documentId);
    },
    [setSelectedDocument]
  );

  return (
    <Routes>
      {/* 默认文档视图 */}
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

      {/* 文档编辑页面 */}
      <Route
        path=":documentId"
        element={<DocumentEditor />}
      />
    </Routes>
  );
};

export default DocumentsMainPage;
