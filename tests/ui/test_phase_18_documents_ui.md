# Phase 18 Documents UI Manual Tests

Current note: `/documents` is a placeholder. Use `/workspaces/{workspaceId}/documents`.

1. Log in at `http://localhost:3001/login`.
2. Open dashboard.
3. Open or create a workspace.
4. Open `http://localhost:3001/workspaces/{workspaceId}/documents`.
5. Upload a valid `.txt` document.
6. Confirm the document appears with queued/processing/indexed status.
7. Wait for indexed status.
8. Upload a valid PDF if available.
9. Upload `bad.exe`.

Expected:
- Valid files upload and eventually index.
- Invalid file is rejected with a clear error.
- Old error messages clear after a successful upload.

Backend checks:

```bash
docker compose logs backend --tail=300 | grep -E "documents|POST|GET"
docker compose logs celery_worker --tail=300 | grep -E "Document|chunk|embedding|indexed|failed|ERROR|Traceback"
```
