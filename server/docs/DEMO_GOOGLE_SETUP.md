# Demo booking: Google Meet setup (fix `invalid_grant`)

When demo Meet creation fails with **`invalid_grant`**, Google is rejecting your **refresh token**. The token must be valid and **obtained with the same OAuth client** (same `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`) that the server uses.

## Why you get `invalid_grant`

- The refresh token was created with a **different** Client ID/Secret (e.g. from another project or env).
- The token **expired** (e.g. app in Testing mode → tokens can expire after 7 days).
- The token was **revoked** (user revoked access or re-authorized with different scopes).
- **Copy/paste** issues (extra spaces, line breaks, or encoding in `.env`).

## Fix: get a new refresh token (same OAuth client)

Use the **same** Google Cloud OAuth client as your app (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).

### Option A: One-time script (recommended)

1. From `server/`, run: `node scripts/get-demo-refresh-token.js`  
   (Uses your existing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `GOOGLE_REDIRECT_URI` from `.env`.)
2. In Google Cloud Console, ensure the OAuth client has **Authorized redirect URI** `http://localhost:3000/oauth2callback` (or set `GOOGLE_REDIRECT_URI` in `.env` to a URI that is authorized).
3. Open the printed URL in a browser and sign in with the **Google account that should own demo calendar events** (e.g. your team/admin account).
4. After redirect, the page will show the **refresh_token**. Copy it into `.env` as `GOOGLE_DEMO_REFRESH_TOKEN` (no quotes, no spaces).
5. Restart the server.

### Option B: Use your existing app’s OAuth flow

If your app already has a “Connect Google Calendar” flow that uses the **same** Client ID/Secret and redirect URI:

1. Log in as the user that should own demo meetings (e.g. admin/team account).
2. Complete “Connect Google Calendar” so the app receives tokens.
3. From your database or logs, copy the **refresh_token** for that user and set it as `GOOGLE_DEMO_REFRESH_TOKEN` in `.env`.

Again: the token **must** come from the same OAuth client (same Client ID/Secret) the server uses for demo Meet creation.

## Checklist

- [ ] `GOOGLE_DEMO_REFRESH_TOKEN` was obtained with the **same** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` that are in the server `.env`.
- [ ] No extra spaces or line breaks in the token in `.env`.
- [ ] If the OAuth app is in **Testing** mode, the refresh token can expire; re-run the flow to get a new one, or publish the app so tokens last longer.
- [ ] Server clock is in sync (e.g. NTP); large time skew can also cause `invalid_grant`.

After updating `.env`, restart the server and try booking a demo again.
