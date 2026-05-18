from __future__ import annotations

import logging
import os
import re
from time import perf_counter
from uuid import uuid4

from fastapi import Request, Response
from jose import JWTError, jwt
from prometheus_client import CONTENT_TYPE_LATEST, REGISTRY, CollectorRegistry, generate_latest
from prometheus_client import multiprocess
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response as StarletteResponse

from app.core.config import settings
from app.core.metrics import HTTP_REQUEST_DURATION_SECONDS, HTTP_REQUESTS_TOTAL
from app.core.security import ALGORITHM


logger = logging.getLogger(__name__)
WORKSPACE_PATH_PATTERN = re.compile(r"/workspaces/([^/]+)")


class RequestObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.request_id = request_id
        user_id = _extract_user_id(request)
        started_at = perf_counter()
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception:
            status_code = 500
            raise
        finally:
            latency_seconds = perf_counter() - started_at
            path = _route_path(request)
            workspace_id = _extract_workspace_id(request)

            HTTP_REQUESTS_TOTAL.labels(
                method=request.method,
                path=path,
                status_code=str(status_code),
            ).inc()
            HTTP_REQUEST_DURATION_SECONDS.labels(
                method=request.method,
                path=path,
                status_code=str(status_code),
            ).observe(latency_seconds)

            logger.info(
                "HTTP request completed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": path,
                    "status_code": status_code,
                    "latency_ms": int(latency_seconds * 1000),
                    "user_id": user_id,
                    "workspace_id": workspace_id,
                },
            )

            response = locals().get("response")
            if response is not None:
                response.headers["X-Request-ID"] = request_id


def metrics_response() -> StarletteResponse:
    return StarletteResponse(
        content=generate_latest(_metrics_registry()),
        media_type=CONTENT_TYPE_LATEST,
    )


def _metrics_registry() -> CollectorRegistry:
    if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        return registry
    return REGISTRY


def _route_path(request: Request) -> str:
    route = request.scope.get("route")
    path = getattr(route, "path", None)
    if isinstance(path, str) and path:
        return path
    return request.url.path


def _extract_user_id(request: Request) -> str | None:
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None

    user_id = payload.get("sub")
    return user_id if isinstance(user_id, str) else None


def _extract_workspace_id(request: Request) -> str | None:
    workspace_id = request.path_params.get("workspace_id")
    if workspace_id is not None:
        return str(workspace_id)

    match = WORKSPACE_PATH_PATTERN.search(request.url.path)
    if match:
        return match.group(1)
    return None
