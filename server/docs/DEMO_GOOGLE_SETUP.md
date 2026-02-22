# Google OAuth – one simple config (live)

Your API is at **https://emplearnings.com/api** (Apache proxies `/api` to the Node server on the main domain). Admin and client both call `/api`, which goes to that same backend. So use **emplearnings.com** for all Google OAuth URLs.

---

## 1. Google Cloud Console (Credentials → your OAuth client)

Add these **two** Authorized redirect URIs (no trailing slash):

| Redirect URI |
|--------------|
| `https://emplearnings.com/api/google-calendar/callback` |
| `https://emplearnings.com/api/demo/oauth-callback` |

Save. You do **not** need admin.emplearnings.com for OAuth.

---

## 2. Server `.env`

```env
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="https://emplearnings.com/api/google-calendar/callback"
GOOGLE_DEMO_REFRESH_TOKEN="paste-after-step-3"
```

---

## 3. Get a new demo refresh token (when you see `invalid_grant`)

1. In the browser open: **https://emplearnings.com/api/demo/oauth-start**  
   (Must be **emplearnings.com** – that’s where `/api` is proxied. Do not use admin.emplearnings.com for this.)

2. Sign in with the Google account that should own demo meetings.

3. On the next page, copy the **refresh token** and put it in `.env` as `GOOGLE_DEMO_REFRESH_TOKEN`.

4. Restart the server: `pm2 restart all` (or your usual restart).

---

## If you see “Cannot GET /api/demo/oauth-start”

- You’re probably opening **admin.emplearnings.com**/api/demo/oauth-start. In your Apache config, only **emplearnings.com** has `ProxyPass /api`. So use:
  - **https://emplearnings.com/api/demo/oauth-start**
- Ensure the latest server code is deployed and the Node process has been restarted after adding the demo OAuth routes.

---

## Summary

| What | URL / value |
|------|-------------|
| Google Console – redirect URI (tutor calendar) | `https://emplearnings.com/api/google-calendar/callback` |
| Google Console – redirect URI (demo token) | `https://emplearnings.com/api/demo/oauth-callback` |
| `.env` – `GOOGLE_REDIRECT_URI` | `https://emplearnings.com/api/google-calendar/callback` |
| Browser – get demo token | `https://emplearnings.com/api/demo/oauth-start` |

One domain for API and OAuth: **emplearnings.com**.
