from __future__ import annotations

import pytest

from conftest import psql_json


pytestmark = pytest.mark.live


def test_phase_03_schema_tables_exist() -> None:
    tables = set(
        psql_json(
            """
            select json_agg(tablename order by tablename)
            from pg_tables
            where schemaname = 'public';
            """
        )
    )
    expected_tables = {
        "users",
        "workspaces",
        "workspace_members",
        "documents",
        "chunks",
        "conversations",
        "messages",
        "retrieved_chunks",
        "evaluations",
        "agent_runs",
    }
    assert expected_tables <= tables


def test_phase_03_database_counts_query_runs() -> None:
    counts = psql_json(
        """
        select row_to_json(counts)
        from (
          select
            (select count(*) from users) as users,
            (select count(*) from workspaces) as workspaces,
            (select count(*) from documents) as documents,
            (select count(*) from chunks) as chunks,
            (select count(*) from messages) as messages,
            (select count(*) from retrieved_chunks) as retrieved_chunks,
            (select count(*) from evaluations) as evaluations,
            (select count(*) from agent_runs) as agent_runs
        ) counts;
        """
    )
    for key, value in counts.items():
        assert key
        assert isinstance(value, int)
        assert value >= 0
