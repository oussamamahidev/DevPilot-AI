from app.db.base import Base
import app.models  # noqa: F401


def test_metadata_contains_initial_schema_tables() -> None:
    assert set(Base.metadata.tables) == {
        "agent_runs",
        "chunks",
        "conversations",
        "documents",
        "evaluations",
        "llm_usage",
        "messages",
        "retrieved_chunks",
        "users",
        "workspace_members",
        "workspaces",
    }
