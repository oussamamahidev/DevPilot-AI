# Phase 9 Ollama Connectivity

Backend and Celery run inside Docker, while Ollama runs on the host. The containers call Ollama through:

```bash
http://host.docker.internal:11434
```

Both `backend` and `celery_worker` must have this compose configuration:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
environment:
  OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
```

Host check:

```bash
curl http://localhost:11434/api/tags
```

Container check from Celery:

```bash
docker compose exec celery_worker python -c "import httpx; print(httpx.get('http://host.docker.internal:11434/api/tags', timeout=5).text)"
```

If host curl works but the Celery command fails, Ollama is probably bound only to `127.0.0.1`. Configure the systemd service with:

```bash
sudo systemctl edit ollama
```

Add:

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

Then restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
docker compose restart backend celery_worker
```
