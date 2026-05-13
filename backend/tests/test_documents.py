from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models.document import Chunk, Document
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.services import document_service
from app.workers import document_tasks


class FakeScalarResult:
    def __init__(self, items: list[Document]) -> None:
        self.items = items

    def all(self) -> list[Document]:
        return self.items


@dataclass
class DocumentState:
    users: dict[str, User] = field(default_factory=dict)
    workspaces: dict[str, Workspace] = field(default_factory=dict)
    members: dict[str, WorkspaceMember] = field(default_factory=dict)
    documents: dict[str, Document] = field(default_factory=dict)
    chunks: dict[str, Chunk] = field(default_factory=dict)


class FakeDocumentSession:
    def __init__(self, state: DocumentState) -> None:
        self.state = state
        self.pending: list[object] = []

    async def scalar(self, statement: object) -> object | None:
        target = self._target_entity(statement)
        criteria = self._criteria(statement)

        if target is User:
            return self.state.users.get(str(criteria.get("id")))

        if target is Workspace:
            workspace = self.state.workspaces.get(str(criteria.get("id")))
            if workspace is not None:
                self._hydrate_workspace(workspace)
            return workspace

        if target is WorkspaceMember:
            return next(
                (
                    member
                    for member in self.state.members.values()
                    if str(member.workspace_id) == str(criteria.get("workspace_id"))
                    and str(member.user_id) == str(criteria.get("user_id"))
                ),
                None,
            )

        if target is Document:
            return self.state.documents.get(str(criteria.get("id")))

        if target is Chunk:
            return self.state.chunks.get(str(criteria.get("id")))

        return None

    async def scalars(self, statement: object) -> FakeScalarResult:
        target = self._target_entity(statement)
        criteria = self._criteria(statement)
        if target is Document:
            documents = [
                document
                for document in self.state.documents.values()
                if str(document.workspace_id) == str(criteria.get("workspace_id"))
                and document.status != "deleted"
            ]
            return FakeScalarResult(documents)

        if target is Chunk:
            chunks = [
                chunk
                for chunk in self.state.chunks.values()
                if str(chunk.document_id) == str(criteria.get("document_id"))
            ]
            return FakeScalarResult(chunks)

        return FakeScalarResult([])

    async def execute(self, statement: object) -> None:
        table_name = getattr(getattr(statement, "table", None), "name", None)
        if table_name != "chunks":
            return None

        criteria = self._criteria(statement)
        document_id = criteria.get("document_id")
        if document_id is None:
            return None

        self.state.chunks = {
            chunk_id: chunk
            for chunk_id, chunk in self.state.chunks.items()
            if str(chunk.document_id) != str(document_id)
        }
        return None

    async def delete(self, instance: object) -> None:
        if isinstance(instance, Chunk):
            self.state.chunks.pop(str(instance.id), None)
            return

        if isinstance(instance, Document):
            self.state.documents.pop(str(instance.id), None)
            return

        return None

    def add(self, instance: object) -> None:
        self.pending.append(instance)

    async def commit(self) -> None:
        now = datetime.now(UTC)
        for instance in self.pending:
            if isinstance(instance, Document):
                if instance.id is None:
                    instance.id = uuid4()
                if instance.created_at is None:
                    instance.created_at = now
                self.state.documents[str(instance.id)] = instance
            if isinstance(instance, Chunk):
                if instance.id is None:
                    instance.id = uuid4()
                if instance.created_at is None:
                    instance.created_at = now
                self.state.chunks[str(instance.id)] = instance
        self.pending.clear()

    @staticmethod
    def _target_entity(statement: object) -> object | None:
        descriptions = getattr(statement, "column_descriptions", [])
        if not descriptions:
            return None
        return descriptions[0].get("entity")

    @staticmethod
    def _criteria(statement: object) -> dict[str, object]:
        criteria: dict[str, object] = {}
        for criterion in getattr(statement, "_where_criteria", ()):
            field_name = getattr(getattr(criterion, "left", None), "name", None)
            field_value = getattr(getattr(criterion, "right", None), "value", None)
            if field_name is not None:
                criteria[field_name] = field_value
        return criteria

    def _hydrate_workspace(self, workspace: Workspace) -> None:
        workspace.members = [
            member
            for member in self.state.members.values()
            if member.workspace_id == workspace.id
        ]


class FakeDocumentSessionContext:
    def __init__(self, state: DocumentState) -> None:
        self.state = state

    async def __aenter__(self) -> FakeDocumentSession:
        return FakeDocumentSession(self.state)

    async def __aexit__(self, *args: object) -> None:
        return None


@pytest.fixture
def queued_document_tasks(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    queued_tasks: list[str] = []
    monkeypatch.setattr(
        document_tasks.process_document_task,
        "delay",
        lambda document_id: queued_tasks.append(document_id),
    )
    return queued_tasks


@pytest.fixture(autouse=True)
def _disable_document_task_dispatch(queued_document_tasks: list[str]) -> None:
    _ = queued_document_tasks


@pytest.fixture
def state() -> DocumentState:
    return DocumentState()


@pytest.fixture
def users(state: DocumentState) -> tuple[User, User]:
    first_user = make_user("ada-docs@example.com")
    second_user = make_user("grace-docs@example.com")
    state.users[str(first_user.id)] = first_user
    state.users[str(second_user.id)] = second_user
    return first_user, second_user


@pytest.fixture
def client(
    monkeypatch: pytest.MonkeyPatch,
    state: DocumentState,
    tmp_path: Path,
) -> TestClient:
    monkeypatch.setattr(document_service, "STORAGE_ROOT", tmp_path / "storage")

    async def override_get_db() -> AsyncGenerator[FakeDocumentSession, None]:
        yield FakeDocumentSession(state)

    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client

    if original_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = original_override


def make_user(email: str) -> User:
    return User(
        id=uuid4(),
        email=email,
        full_name=email.split("@")[0].title(),
        password_hash="not-used",
        role="user",
        is_active=True,
    )


def make_workspace(state: DocumentState, owner: User) -> Workspace:
    workspace = Workspace(
        id=uuid4(),
        name="Docs Workspace",
        description=None,
        owner_id=owner.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    member = WorkspaceMember(
        id=uuid4(),
        workspace_id=workspace.id,
        user_id=owner.id,
        role="owner",
        created_at=datetime.now(UTC),
    )
    state.workspaces[str(workspace.id)] = workspace
    state.members[str(member.id)] = member
    workspace.members = [member]
    return workspace


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return {"Authorization": f"Bearer {token}"}


def upload_pdf(client: TestClient, workspace: Workspace, user: User) -> dict[str, object]:
    response = client.post(
        f"/api/v1/workspaces/{workspace.id}/documents",
        headers=auth_headers(user),
        files={"file": ("guide.pdf", b"%PDF-1.4 test", "application/pdf")},
    )
    assert response.status_code == 201
    return response.json()


def test_upload_valid_pdf(
    client: TestClient,
    state: DocumentState,
    users: tuple[User, User],
    tmp_path: Path,
    queued_document_tasks: list[str],
) -> None:
    owner, _ = users
    workspace = make_workspace(state, owner)

    response = client.post(
        f"/api/v1/workspaces/{workspace.id}/documents",
        headers=auth_headers(owner),
        files={"file": ("../../guide.pdf", b"%PDF-1.4 test", "application/pdf")},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["workspace_id"] == str(workspace.id)
    assert data["uploaded_by"] == str(owner.id)
    assert data["filename"] == "guide.pdf"
    assert data["file_type"] == "pdf"
    assert data["file_size"] == len(b"%PDF-1.4 test")
    assert data["status"] == "queued"
    assert ".." not in data["storage_path"]
    assert (tmp_path / data["storage_path"]).exists()
    assert queued_document_tasks == [data["id"]]


def test_upload_invalid_type(client: TestClient, state: DocumentState, users: tuple[User, User]) -> None:
    owner, _ = users
    workspace = make_workspace(state, owner)

    response = client.post(
        f"/api/v1/workspaces/{workspace.id}/documents",
        headers=auth_headers(owner),
        files={"file": ("malware.exe", b"nope", "application/octet-stream")},
    )

    assert response.status_code == 400
    assert response.json() == {"error": {"message": "Unsupported file type"}}


def test_list_documents(client: TestClient, state: DocumentState, users: tuple[User, User]) -> None:
    owner, _ = users
    workspace = make_workspace(state, owner)
    uploaded_document = upload_pdf(client, workspace, owner)

    response = client.get(
        f"/api/v1/workspaces/{workspace.id}/documents",
        headers=auth_headers(owner),
    )

    assert response.status_code == 200
    data = response.json()
    assert [document["id"] for document in data] == [uploaded_document["id"]]


def test_get_status(client: TestClient, state: DocumentState, users: tuple[User, User]) -> None:
    owner, _ = users
    workspace = make_workspace(state, owner)
    uploaded_document = upload_pdf(client, workspace, owner)

    response = client.get(
        f"/api/v1/documents/{uploaded_document['id']}/status",
        headers=auth_headers(owner),
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": uploaded_document["id"],
        "status": "queued",
    }


def test_user_cannot_access_another_workspace_document(
    client: TestClient,
    state: DocumentState,
    users: tuple[User, User],
) -> None:
    owner, other_user = users
    workspace = make_workspace(state, owner)
    uploaded_document = upload_pdf(client, workspace, owner)

    response = client.get(
        f"/api/v1/documents/{uploaded_document['id']}",
        headers=auth_headers(other_user),
    )

    assert response.status_code == 403
    assert response.json() == {
        "error": {"message": "Document not found or access denied"}
    }


@pytest.mark.asyncio
async def test_document_terminal_status_sets_processed_at() -> None:
    document = Document(
        id=uuid4(),
        workspace_id=uuid4(),
        uploaded_by=uuid4(),
        filename="guide.txt",
        file_type="txt",
        file_size=10,
        status="processing",
        storage_path="storage/workspace/document/guide.txt",
        created_at=datetime.now(UTC),
        processed_at=None,
    )

    before_update = datetime.now(UTC)
    await document_tasks._set_document_status(
        db=FakeDocumentSession(DocumentState()),
        document=document,
        status="indexed",
    )

    assert document.status == "indexed"
    assert document.processed_at is not None
    assert document.processed_at >= before_update


@pytest.mark.asyncio
async def test_processing_status_clears_processed_at() -> None:
    document = Document(
        id=uuid4(),
        workspace_id=uuid4(),
        uploaded_by=uuid4(),
        filename="guide.txt",
        file_type="txt",
        file_size=10,
        status="failed",
        storage_path="storage/workspace/document/guide.txt",
        created_at=datetime.now(UTC),
        processed_at=datetime.now(UTC),
    )

    await document_tasks._set_document_status(
        db=FakeDocumentSession(DocumentState()),
        document=document,
        status="processing",
    )

    assert document.status == "processing"
    assert document.processed_at is None


@pytest.mark.asyncio
async def test_chunks_are_saved_for_uploaded_document(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    state = DocumentState()
    workspace_id = uuid4()
    document_id = uuid4()
    storage_root = tmp_path / "storage"
    document_dir = storage_root / str(workspace_id) / str(document_id)
    document_dir.mkdir(parents=True)
    storage_path = document_dir / "guide.txt"
    storage_path.write_text(
        "# Guide\n\n" + " ".join(f"word{i}" for i in range(900)),
        encoding="utf-8",
    )

    document = Document(
        id=document_id,
        workspace_id=workspace_id,
        uploaded_by=uuid4(),
        filename="guide.txt",
        file_type="txt",
        file_size=storage_path.stat().st_size,
        status="queued",
        storage_path=str(storage_path.relative_to(storage_root.parent)),
        created_at=datetime.now(UTC),
        processed_at=None,
    )
    old_chunk = Chunk(
        id=uuid4(),
        document_id=document_id,
        workspace_id=workspace_id,
        content="old chunk",
        chunk_index=0,
        token_count=2,
        metadata_={"start_char": 0, "end_char": 9},
    )
    state.documents[str(document.id)] = document
    state.chunks[str(old_chunk.id)] = old_chunk

    monkeypatch.setattr(document_service, "STORAGE_ROOT", storage_root)
    monkeypatch.setattr(
        document_tasks,
        "AsyncSessionLocal",
        lambda: FakeDocumentSessionContext(state),
    )
    indexed_documents: list[str] = []

    async def fake_upsert_chunks(document_id: object, **_: object) -> int:
        indexed_documents.append(str(document_id))
        return len([chunk for chunk in state.chunks.values() if chunk.document_id == document_id])

    monkeypatch.setattr(document_tasks, "upsert_chunks", fake_upsert_chunks)

    result = await document_tasks._process_document(str(document.id))

    saved_chunks = sorted(state.chunks.values(), key=lambda chunk: chunk.chunk_index)
    assert result["status"] == "indexed"
    assert result["chunk_count"] == len(saved_chunks)
    assert result["vector_count"] == len(saved_chunks)
    assert document.status == "indexed"
    assert document.processed_at is not None
    assert len(saved_chunks) >= 2
    assert indexed_documents == [str(document.id)]
    assert all(chunk.content != "old chunk" for chunk in saved_chunks)
    assert [chunk.chunk_index for chunk in saved_chunks] == list(range(len(saved_chunks)))
    assert all(chunk.document_id == document_id for chunk in saved_chunks)
    assert all(chunk.workspace_id == workspace_id for chunk in saved_chunks)
    assert all(chunk.token_count > 0 for chunk in saved_chunks)
    assert all("start_char" in chunk.metadata_ for chunk in saved_chunks)
    assert all("end_char" in chunk.metadata_ for chunk in saved_chunks)
