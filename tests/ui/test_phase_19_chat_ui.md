# Phase 19 Chat UI Manual Tests

Current note: `/chat` is a placeholder. Use `/workspaces/{workspaceId}/chat`.
Current note: backend chat strategy is selected by the agent router; explicit
`retrieval_strategy` is not exposed on `ChatQueryRequest` yet.

1. Log in.
2. Ensure the selected workspace has at least one indexed document.
3. Open `http://localhost:3001/workspaces/{workspaceId}/chat`.
4. Ask `What technologies does DevPilot AI use?`.
5. Ask `How does the platform process documents in the background?`.
6. Ask `Celery Redis Qdrant`.
7. Ask `How does DevPilot use Qdrant and Celery?`.
8. Ask `What is the CEO favorite food?`.

Expected:
- Assistant answer appears.
- Citations are visible.
- Evaluation metrics are visible.
- Unrelated question does not hallucinate.
- Send button is disabled while loading.
- Fast repeated clicks do not create duplicate requests.
- Missing/invalid token redirects to `/login`.

Database checks:

```bash
docker compose exec postgres psql -U devpilot -d devpilot -c "
select id, left(content,120) as preview, created_at
from messages
where role='assistant'
order by created_at desc
limit 1;"
```

Set `MESSAGE_ID` to the latest assistant message, then:

```bash
curl -sS "$API/messages/$MESSAGE_ID/evaluation" -H "Authorization: Bearer $TOKEN" | jq
docker compose exec postgres psql -U devpilot -d devpilot -c "
select retrieval_strategy, score, rank
from retrieved_chunks
where message_id = '$MESSAGE_ID'
order by rank;"
docker compose exec postgres psql -U devpilot -d devpilot -c "
select agent_type, status, latency_ms
from agent_runs
where message_id = '$MESSAGE_ID'
order by created_at;"
```
