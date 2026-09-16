# Google OAuth – one simple config (live)

The platform Google account (**emplearnings@gmail.com**) owns **every** Google Meet link the site hands out: demo calls **and** mentoring sessions. Session meetings are created through the Google Meet REST API with **Open** access, so mentors and students join straight away — nobody has to knock and no host has to be present.


Your API is at **https://emplearnings.com/api** (Apache proxies `/api` to the Node server on the main domain). Admin and client both call `/api`, which goes to that same backend. So use **emplearnings.com** for all Google OAuth URLs.

---

## 1. Google Cloud Console

### Enable the APIs (APIs & Services → Library)

| API | Used for |
|-----|----------|
| **Google Calendar API** | calendar events for demos and sessions |
| **Google Meet REST API** | Open-access session meeting links (join without knocking) |

Both must show as *Enabled* on the same project as the OAuth client below.

### Redirect URIs (Credentials → your OAuth client)

Add these **two** Authorized redirect URIs (no trailing slash):

| Redirect URI |
|--------------|
| `https://emplearnings.com/api/google-calendar/callback` |
| `https://emplearnings.com/api/demo/oauth-callback` |

Save. You do **not** need admin.emplearnings.com for OAuth.

---

## 2. Server `.env`

Add this so the redirect URI sent to Google **exactly** matches Google Console (fixes “redirect_uri_mismatch”):

```env
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="https://emplearnings.com/api/google-calendar/callback"
GOOGLE_DEMO_REDIRECT_URI="https://emplearnings.com/api/demo/oauth-callback"
GOOGLE_DEMO_REFRESH_TOKEN="paste-after-step-3"
```

`GOOGLE_DEMO_REDIRECT_URI` must be **exactly** the same as the demo callback URL you added in Google Console (same scheme, host, path, no trailing slash).

---

## 3. Get a new platform refresh token (first setup, after adding the Meet API, or when you see `invalid_grant`)

1. In the browser open: **https://emplearnings.com/api/demo/oauth-start**  
   (Must be **emplearnings.com** – that’s where `/api` is proxied. Do not use admin.emplearnings.com for this.)

2. Sign in with **emplearnings@gmail.com** and tick **every** permission on the consent screen (Calendar **and** Google Meet).

3. On the next page, copy the **refresh token** and put it in `.env` as `GOOGLE_DEMO_REFRESH_TOKEN`.  
   The page tells you whether the Google Meet permission was granted. If it says it was **not** granted, session links still get created but participants may have to knock — enable the Meet REST API (step 1) and repeat.

4. Restart the server: `pm2 restart all` (or your usual restart).

5. Check the server log right after start. You should see:

   ```
   [GoogleMeet] Platform Google token OK (emplearnings@gmail.com); session Meet links will use OPEN access (no knocking).
   ```

   A warning line instead tells you exactly what is missing (token invalid, Meet scopes missing, or API not enabled).

### Why the consent screen must be in "Production"

While the OAuth consent screen is in *Testing* mode, Google expires refresh tokens after 7 days, so demo calls and session links break weekly. Publish the consent screen (Google Auth Platform → Audience → *Publish app*) so the token stays valid.

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
| `.env` – `GOOGLE_DEMO_REDIRECT_URI` | `https://emplearnings.com/api/demo/oauth-callback` (must match Google Console exactly) |
| Browser – get demo token | `https://emplearnings.com/api/demo/oauth-start` |

One domain for API and OAuth: **emplearnings.com**. If you get **redirect_uri_mismatch**, set `GOOGLE_DEMO_REDIRECT_URI` in `.env` to the exact URL you added in Google Console and restart the server.
