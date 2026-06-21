from __future__ import annotations

import httpx
import pytest

from conftest import auth_headers, register_user, require_status


pytestmark = pytest.mark.live


def test_phase_04_register_login_and_auth_me(
    http_client: httpx.Client,
    api_base_url: str,
) -> None:
    user = register_user(http_client, api_base_url, email_prefix="phase4")

    response = http_client.get(
        f"{api_base_url}/auth/me",
        headers=auth_headers(user.token),
    )
    require_status(response, 200)
    payload = response.json()

    assert payload["id"] == user.user_id
    assert payload["email"] == user.email
    assert payload["role"] in {"user", "admin"}
    assert payload["is_active"] is True
    assert "password" not in payload
    assert "password_hash" not in payload


def test_phase_04_duplicate_register_is_rejected(
    http_client: httpx.Client,
    api_base_url: str,
) -> None:
    user = register_user(http_client, api_base_url, email_prefix="phase4-duplicate")
    response = http_client.post(
        f"{api_base_url}/auth/register",
        json={
            "email": user.email,
            "full_name": "Duplicate User",
            "password": user.password,
        },
    )
    assert response.status_code in {400, 409}
    assert "password" not in response.text.lower()


def test_phase_04_invalid_and_missing_tokens_are_rejected(
    http_client: httpx.Client,
    api_base_url: str,
) -> None:
    invalid_response = http_client.get(
        f"{api_base_url}/auth/me",
        headers=auth_headers("invalid_token"),
    )
    assert invalid_response.status_code == 401

    missing_response = http_client.get(f"{api_base_url}/auth/me")
    assert missing_response.status_code in {401, 403}


def test_phase_04_wrong_password_is_rejected(
    http_client: httpx.Client,
    api_base_url: str,
) -> None:
    user = register_user(http_client, api_base_url, email_prefix="phase4-wrong")
    response = http_client.post(
        f"{api_base_url}/auth/login",
        json={"email": user.email, "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert "Invalid email or password" in response.text
