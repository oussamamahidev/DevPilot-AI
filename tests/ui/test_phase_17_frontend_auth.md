# Phase 17 Frontend Auth Manual Tests

1. Open `http://localhost:3001/register`.
2. Register `phase17-ui-<timestamp>@example.com` with password `devpilot-password-123`.
3. Open `http://localhost:3001/login`.
4. Log in with the same user.
5. Confirm redirect to dashboard.
6. In DevTools console, run:

```js
localStorage.getItem("devpilot_access_token")
```

Expected: non-null JWT. Do not paste or log the token value.

7. Visit `/dashboard`, `/documents`, `/chat`, and `/settings`.
8. Remove token:

```js
localStorage.removeItem("devpilot_access_token")
window.location.href = "/dashboard"
```

Expected: redirect to `/login`.

9. Set invalid token:

```js
localStorage.setItem("devpilot_access_token", "invalid_token")
window.location.href = "/dashboard"
```

Expected: `/auth/me` returns `401`, token is cleared, and page redirects to `/login`.
