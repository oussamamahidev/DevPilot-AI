from __future__ import annotations

import json

import httpx
import pytest

from conftest import (
    auth_headers,
    psql_json,
    register_user,
    require_status,
)


pytestmark = pytest.mark.live


def _parse_sse_events(text: str) -> list[tuple[str, dict[str, object]]]:
    events: list[tuple[str, dict[str, object]]] = []
    for block in text.split("\n\n"):
        if not block.strip():
            continue
        event_name = "message"
        data_lines: list[str] = []
        for line in block.splitlines():
            if line.startswith("event:"):
                event_name = line.removeprefix("event:").strip()
            elif line.startswith("data:"):
                data_lines.append(line.removeprefix("data:").strip())
        if data_lines:
            events.append((event_name, json.loads("\n".join(data_lines))))
    return events


def _stream_chat(
    client: httpx.Client,
    api_base: str,
    token: str,
    workspace_id: str,
    question: str,
) -> tuple[httpx.Response, list[tuple[str, dict[str, object]]]]:
    with client.stream(
        "POST",
        f"{api_base}/workspaces/{workspace_id}/chat/stream",
        headers={**auth_headers(token), "Accept": "text/event-stream"},
        json={"question": question, "retrieval_strategy": "hybrid"},
    ) as response:
        require_status(response, 200)
        assert response.headers.get("content-type", "").startswith("text/event-stream")
        body = "".join(response.iter_text())
    return response, _parse_sse_events(body)


def test_phase_23_stream_requires_auth(
    http_client: httpx.Client,
    api_base_url: str,
) -> None:
    response = http_client.post(
        f"{api_base_url}/workspaces/00000000-0000-0000-0000-000000000000/chat/stream",
        json={"question": "What is DevPilot AI?"},
    )

    require_status(response, 401)


def test_phase_23_stream_requires_workspace_access(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user,
    workspace,
) -> None:
    other_user = register_user(http_client, api_base_url, email_prefix="phase23-other")
    response = http_client.post(
        f"{api_base_url}/workspaces/{workspace.id}/chat/stream",
        headers=auth_headers(other_user.token),
        json={"question": "What is DevPilot AI?"},
    )

    require_status(response, 403)


@pytest.mark.ingestion
@pytest.mark.rag
@pytest.mark.slow
def test_phase_23_stream_emits_events_and_persists_trace(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user,
    workspace,
    indexed_document,
) -> None:
    _ = indexed_document
    _, events = _stream_chat(
        http_client,
        api_base_url,
        registered_user.token,
        workspace.id,
        "What technologies does DevPilot AI use?",
    )

    event_names = [event_name for event_name, _ in events]
    for expected_event in (
        "start",
        "trace",
        "token",
        "citations",
        "evaluation",
        "message",
        "done",
    ):
        assert expected_event in event_names

    message_payload = next(payload for event_name, payload in events if event_name == "message")
    message_id = str(message_payload["message_id"])
    db_trace = psql_json(
        f"""
        select row_to_json(rows)
        from (
          select
            (select count(*)::int from messages where id = '{message_id}'::uuid and role = 'assistant') as assistant_messages,
            (select count(*)::int from retrieved_chunks where message_id = '{message_id}'::uuid) as retrieved_chunks,
            (select count(*)::int from evaluations where message_id = '{message_id}'::uuid) as evaluations,
            (select count(*)::int from agent_runs where message_id = '{message_id}'::uuid) as agent_runs
        ) rows;
        """
    )
    assert db_trace["assistant_messages"] == 1
    assert db_trace["retrieved_chunks"] > 0
    assert db_trace["evaluations"] == 1
    assert db_trace["agent_runs"] >= 6


@pytest.mark.ingestion
@pytest.mark.rag
@pytest.mark.slow
def test_phase_23_chat_query_still_works(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user,
    workspace,
    indexed_document,
) -> None:
    _ = indexed_document
    response = http_client.post(
        f"{api_base_url}/workspaces/{workspace.id}/chat/query",
        headers=auth_headers(registered_user.token),
        json={"question": "What technologies does DevPilot AI use?"},
    )

    require_status(response, 200)
    payload = response.json()
    assert payload.get("answer")
    assert payload.get("message_id")
    assert isinstance(payload.get("citations"), list)
    assert isinstance(payload.get("evaluation"), dict)
