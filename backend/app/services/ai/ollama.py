import httpx


async def list_ollama_models(base_url: str) -> list[dict[str, object]]:
    async with httpx.AsyncClient(base_url=base_url, timeout=3.0) as client:
        response = await client.get("/api/tags")
        response.raise_for_status()

    payload = response.json()
    models = payload.get("models", [])
    return models if isinstance(models, list) else []
