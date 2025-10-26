"""
Network-level documents mod for OpenAgents.

This standalone mod enables document management with:
- Document creation and storage
- Document saving and content persistence
- Document renaming
- Version control
- Operation history tracking
"""

import logging
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime

from openagents.core.base_mod import BaseMod, mod_event_handler
from openagents.models.event import Event
from openagents.models.event_response import EventResponse
from .document_messages import (
    CreateDocumentMessage,
    SaveDocumentMessage,
    RenameDocumentMessage,
    GetDocumentMessage,
    GetDocumentHistoryMessage,
    ListDocumentsMessage,
    DocumentOperationResponse,
    DocumentGetResponse,
    DocumentListResponse,
    DocumentHistoryResponse,
    DocumentOperation,
)

logger = logging.getLogger(__name__)


class Document:
    """Represents a document with version control."""

    def __init__(
        self,
        document_id: str,
        name: str,
        creator_agent_id: str,
        initial_content: str = "",
    ):
        """Initialize a document."""
        self.document_id = document_id
        self.name = name
        self.creator_agent_id = creator_agent_id
        self.created_timestamp = datetime.now()
        self.last_modified = datetime.now()
        self.version = 1

        # Document content (string)
        self.content: str = initial_content

        # Document metadata
        self.access_permissions: Dict[str, str] = {}  # agent_id -> permission level
        self.operation_history: List[Dict[str, Any]] = []

    def save_content(self, agent_id: str, content: str) -> None:
        """Save document content."""
        self.content = content
        self.version += 1
        self.last_modified = datetime.now()

        # Add to operation history
        self.operation_history.append({
            "operation_id": str(uuid.uuid4()),
            "operation_type": "save",
            "agent_id": agent_id,
            "timestamp": self.last_modified.isoformat(),
            "details": {"version": self.version},
        })

    def rename(self, agent_id: str, new_name: str) -> None:
        """Rename the document."""
        old_name = self.name
        self.name = new_name
        self.last_modified = datetime.now()

        # Add to operation history
        self.operation_history.append({
            "operation_id": str(uuid.uuid4()),
            "operation_type": "rename",
            "agent_id": agent_id,
            "timestamp": self.last_modified.isoformat(),
            "details": {"old_name": old_name, "new_name": new_name},
        })

    def can_access(self, agent_id: str, operation: str) -> bool:
        """Check if agent can access the document for the given operation."""
        # Creator always has access
        if agent_id == self.creator_agent_id:
            return True

        # Check explicit permissions
        if agent_id not in self.access_permissions:
            return False

        permission = self.access_permissions[agent_id]

        if permission == "read_only":
            return operation in ["read"]
        elif permission == "read_write":
            return True
        elif permission == "admin":
            return True

        return False


class DocumentsNetworkMod(BaseMod):
    """Network-level documents mod implementation.

    This standalone mod enables:
    - Document creation and storage
    - Document saving
    - Document renaming
    - Version control and history
    """

    def __init__(self, mod_name: str = "documents"):
        """Initialize the documents mod."""
        super().__init__(mod_name=mod_name)

        # Document storage
        self.documents: Dict[str, Document] = {}

    def initialize(self) -> bool:
        """Initialize the mod."""
        logger.info("Initializing Documents network mod")
        return True

    def shutdown(self) -> bool:
        """Shutdown the mod."""
        logger.info("Shutting down Documents network mod")
        return True

    # Event handlers

    @mod_event_handler("document.create")
    async def _handle_document_create(self, event: Event) -> Optional[EventResponse]:
        """Handle document creation requests."""
        try:
            source_agent_id = (
                event.source_id.replace("agent:", "")
                if event.source_id.startswith("agent:")
                else event.source_id
            )
            logger.info(f"Processing document create request from {source_agent_id}")

            # Extract payload
            payload = event.payload
            document_name = payload.get("document_name")
            initial_content = payload.get("initial_content", "")
            access_permissions = payload.get("access_permissions", {})

            # Create document
            document_id = str(uuid.uuid4())
            document = Document(
                document_id=document_id,
                name=document_name,
                creator_agent_id=source_agent_id,
                initial_content=initial_content,
            )

            # Set access permissions
            document.access_permissions = access_permissions

            self.documents[document_id] = document

            # Add to operation history
            document.operation_history.append({
                "operation_id": str(uuid.uuid4()),
                "operation_type": "create",
                "agent_id": source_agent_id,
                "timestamp": document.created_timestamp.isoformat(),
                "details": {"document_name": document_name},
            })

            logger.info(
                f"Created document {document_id} '{document_name}' for agent {source_agent_id}"
            )

            return EventResponse(
                success=True,
                message=f"Document '{document_name}' created successfully",
                data={
                    "document_id": document_id,
                    "document_name": document_name,
                    "creator_id": source_agent_id,
                    "content": document.content,
                },
            )

        except Exception as e:
            logger.error(f"Error creating document: {e}")
            return EventResponse(
                success=False, message=f"Failed to create document: {str(e)}"
            )

    @mod_event_handler("document.save")
    async def _handle_document_save(self, event: Event) -> Optional[EventResponse]:
        """Handle document save requests."""
        try:
            source_agent_id = (
                event.source_id.replace("agent:", "")
                if event.source_id.startswith("agent:")
                else event.source_id
            )
            payload = event.payload
            document_id = payload.get("document_id")
            content = payload.get("content", "")

            if document_id not in self.documents:
                return EventResponse(
                    success=False, message=f"Document {document_id} not found"
                )

            document = self.documents[document_id]

            # Check permissions
            if not document.can_access(source_agent_id, "write"):
                return EventResponse(success=False, message="Access denied")

            # Save content
            document.save_content(source_agent_id, content)

            return EventResponse(
                success=True,
                message=f"Document saved successfully",
                data={
                    "document_id": document_id,
                    "version": document.version,
                },
            )

        except Exception as e:
            logger.error(f"Error saving document: {e}")
            return EventResponse(
                success=False, message=f"Failed to save document: {str(e)}"
            )

    @mod_event_handler("document.rename")
    async def _handle_document_rename(self, event: Event) -> Optional[EventResponse]:
        """Handle document rename requests."""
        try:
            source_agent_id = (
                event.source_id.replace("agent:", "")
                if event.source_id.startswith("agent:")
                else event.source_id
            )
            payload = event.payload
            document_id = payload.get("document_id")
            new_name = payload.get("new_name")

            if document_id not in self.documents:
                return EventResponse(
                    success=False, message=f"Document {document_id} not found"
                )

            document = self.documents[document_id]

            # Check permissions
            if not document.can_access(source_agent_id, "write"):
                return EventResponse(success=False, message="Access denied")

            # Rename document
            old_name = document.name
            document.rename(source_agent_id, new_name)

            return EventResponse(
                success=True,
                message=f"Document renamed successfully",
                data={
                    "document_id": document_id,
                    "old_name": old_name,
                    "new_name": new_name,
                },
            )

        except Exception as e:
            logger.error(f"Error renaming document: {e}")
            return EventResponse(
                success=False, message=f"Failed to rename document: {str(e)}"
            )

    @mod_event_handler("document.get")
    async def _handle_document_get(self, event: Event) -> Optional[EventResponse]:
        """Handle get document content requests."""
        try:
            source_agent_id = (
                event.source_id.replace("agent:", "")
                if event.source_id.startswith("agent:")
                else event.source_id
            )
            payload = event.payload
            document_id = payload.get("document_id")

            if document_id not in self.documents:
                return EventResponse(
                    success=False, message=f"Document {document_id} not found"
                )

            document = self.documents[document_id]

            # Check permissions
            if not document.can_access(source_agent_id, "read"):
                return EventResponse(success=False, message="Access denied")

            response_data = {
                "document_id": document_id,
                "document_name": document.name,
                "content": document.content,
                "version": document.version,
                "creator_agent_id": document.creator_agent_id,
                "created_timestamp": document.created_timestamp.isoformat(),
                "last_modified": document.last_modified.isoformat(),
            }

            return EventResponse(
                success=True, message="Document content retrieved", data=response_data
            )

        except Exception as e:
            logger.error(f"Error getting document content: {e}")
            return EventResponse(
                success=False, message=f"Failed to get document content: {str(e)}"
            )

    @mod_event_handler("document.get_history")
    async def _handle_document_get_history(
        self, event: Event
    ) -> Optional[EventResponse]:
        """Handle get document history requests."""
        try:
            source_agent_id = (
                event.source_id.replace("agent:", "")
                if event.source_id.startswith("agent:")
                else event.source_id
            )
            payload = event.payload
            document_id = payload.get("document_id")
            limit = int(payload.get("limit", 50))
            offset = int(payload.get("offset", 0))

            if document_id not in self.documents:
                return EventResponse(
                    success=False, message=f"Document {document_id} not found"
                )

            document = self.documents[document_id]

            # Check permissions
            if not document.can_access(source_agent_id, "read"):
                return EventResponse(success=False, message="Access denied")

            # Get paginated history
            total_operations = len(document.operation_history)
            operations = document.operation_history[offset : offset + limit]

            return EventResponse(
                success=True,
                message="Document history retrieved",
                data={
                    "document_id": document_id,
                    "operations": operations,
                    "total_operations": total_operations,
                },
            )

        except Exception as e:
            logger.error(f"Error getting document history: {e}")
            return EventResponse(
                success=False, message=f"Failed to get document history: {str(e)}"
            )

    @mod_event_handler("document.list")
    async def _handle_document_list(self, event: Event) -> Optional[EventResponse]:
        """Handle list documents requests."""
        try:
            source_agent_id = (
                event.source_id.replace("agent:", "")
                if event.source_id.startswith("agent:")
                else event.source_id
            )

            # Get documents accessible to the agent
            accessible_docs = []
            for doc_id, document in self.documents.items():
                if document.can_access(source_agent_id, "read"):
                    accessible_docs.append(
                        {
                            "document_id": doc_id,
                            "name": document.name,
                            "creator_agent_id": document.creator_agent_id,
                            "created_timestamp": document.created_timestamp.isoformat(),
                            "last_modified": document.last_modified.isoformat(),
                            "version": document.version,
                        }
                    )

            return EventResponse(
                success=True,
                message="Documents listed successfully",
                data={"documents": accessible_docs},
            )

        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            return EventResponse(
                success=False, message=f"Failed to list documents: {str(e)}"
            )


# Backward compatibility alias
SharedDocumentNetworkMod = DocumentsNetworkMod
SharedDocument = Document
