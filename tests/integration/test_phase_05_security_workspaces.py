from __future__ import annotations

import httpx
import pytest

from conftest import auth_headers, create_workspace, psql_json, register_user, require_status


pytestmark = pytest.mark.live


def test_phase_05_workspace_crud_and_owner_membership(
    http_client: httpx.Client,
    api_base_url: str,
) -> None:
    user = register_user(http_client, api_base_url, email_prefix="phase5-owner")
    workspace = create_workspace(http_client, api_base_url, user.token, name="Phase 5 Workspace")

    get_response = http_client.get(
        f"{api_base_url}/workspaces/{workspace.id}",
        headers=auth_headers(user.token),
    )
    require_status(get_response, 200)
    payload = get_response.json()
    assert payload["id"] == workspace.id
    assert payload["name"] == "Phase 5 Workspace"
    assert payload["owner_id"] == user.user_id
    assert any(member["user_id"] == user.user_id for member in payload["members"])

    list_response = http_client.get(
        f"{api_base_url}/workspaces",
        headers=auth_headers(user.token),
    )
    require_status(list_response, 200)
    assert workspace.id in {item["id"] for item in list_response.json()}

    membership = psql_json(
        f"""
        select json_agg(row_to_json(rows))
        from (
          select w.id::text as workspace_id, w.name, wm.user_id::text as user_id, wm.role
          from workspaces w
          join workspace_members wm on wm.workspace_id = w.id
          where w.id = '{workspace.id}'::uuid
        ) rows;
        """
    )
    assert membership
    assert membership[0]["user_id"] == user.user_id
    assert membership[0]["role"] == "owner"


def test_phase_05_user_b_cannot_access_user_a_workspace(
    http_client: httpx.Client,
    api_base_url: str,
) -> None:
    user_a = register_user(http_client, api_base_url, email_prefix="phase5-a")
    user_b = register_user(http_client, api_base_url, email_prefix="phase5-b")
    workspace_a = create_workspace(http_client, api_base_url, user_a.token)

    response = http_client.get(
        f"{api_base_url}/workspaces/{workspace_a.id}",
        headers=auth_headers(user_b.token),
    )
    assert response.status_code in {403, 404}
    assert workspace_a.name not in response.text

    list_response = http_client.get(
        f"{api_base_url}/workspaces",
        headers=auth_headers(user_b.token),
    )
    require_status(list_response, 200)
    assert workspace_a.id not in {item["id"] for item in list_response.json()}
