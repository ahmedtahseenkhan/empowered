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

---

## Sessions still ask for host approval ("waiting for the host to let you in")

Open the admin panel → **Demo Availability** → **Google Meet connection**. The card checks the live Google account and tells you which of these is the cause:

| Card says | Cause | Fix |
|-----------|-------|-----|
| Google account is NOT connected | Token missing, expired or revoked | **Reconnect Google account**, save the new token as `GOOGLE_DEMO_REFRESH_TOKEN`, restart |
| Google Meet permission is missing | A permission box was left unticked on the consent screen | Reconnect and tick every permission |
| Google Meet API is not working | "Google Meet REST API" is not enabled on the Cloud project | Enable it (step 1), then **Check again** |
| Link(s) still ask for host approval | The meeting's access in Google differs from Open (older booking, or the setting was changed) | Click **Check & fix upcoming sessions** |

The card lists every upcoming session with what **Google itself** reports for its link right now, so the table is the source of truth.

Links are also fixed automatically: the access type is confirmed with Google every time someone presses **Join Session**, and the scheduler re-checks sessions starting within the next 3 hours. If an old link belongs to a different Google account it cannot be switched, so it is replaced with a new link and both the mentor and the student are emailed the new one.

### How session access works now

Sessions use the **Trusted** access type: the mentor is registered as **co-host** and the student as **member** of the meeting, so both go straight in when signed in to Google with their registered email. Anyone else must ask to join and the mentor admits them. Meet no longer shows "This call is open to anyone". If the mentor cannot be registered (their email is not a Google account), that one session falls back to **Open** so nobody is locked out. Demo calls stay **Open**. Change the policy with `SESSION_MEET_ACCESS` in the server .env.

The admin card tests co-host registration on a test meeting using `ADMIN_EMAIL` (or `MEET_COHOST_PROBE_EMAIL`), and the table shows each session's registered members.

This covers **demo calls as well as mentoring sessions**. A link that was created while a different Google account was connected (for example before the switch to emplearnings@gmail.com) only lets that old account in directly and cannot be changed from here. **Check & fix upcoming sessions** replaces such links and emails the new link to both sides.

Always join through the **Join Session** button or the newest email. A link copied from an old email may be the pre-fix link.

Participants must be signed in to a Google account in their browser. Meetings hosted by a free Gmail account do not admit people who are not signed in.

---

## Mentors host sessions on their own Google account

To remove Meet's "This call is open to anyone" message, mentors can connect their own Google account from their dashboard (**Connect Google** card). Once connected:

- Every new session is created on the **mentor's** Google Calendar with a Google Meet link. The mentor is the organizer and host.
- The student is added as a guest, and **Google** emails them the invitation (EmpowerEd emails still go out as before).
- Invited people signed in with the invited email join directly. Anyone else asks to join and the mentor admits them.
- The mentor's upcoming sessions (starting more than 1 hour later) are moved onto their account automatically; both sides get the new link by email.
- Reschedules move the event on the mentor's calendar; cancelled sessions are removed from it (Google notifies the student).
- Mentors who have not connected keep getting platform links. If Google stops accepting a mentor's connection, their dashboard shows **Reconnect Google** and new sessions fall back to platform links.
- Demo calls are not affected; they always use the platform account.

The admin **Google Meet connection** card shows how many mentors are connected, how many must reconnect, and marks mentor-hosted sessions in the table.

### Google Cloud Console setup (one time)

1. **Redirect URI** — already listed in step 1: `https://emplearnings.com/api/google-calendar/callback` (`GOOGLE_REDIRECT_URI` in `.env`).
2. **Google Auth Platform → Data access → Add scopes:**
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/calendar.events` (sensitive)
   - `.../auth/calendar.readonly` (sensitive)
3. **Audience:**
   - While the app is in *Testing*, add every mentor who will test as a **test user** (max 100). Their tokens expire after 7 days in Testing mode, so they must reconnect weekly.
   - For all mentors, publish the app and complete **verification** (Verification Center). Google asks for: a public homepage, a privacy policy page on the same domain, why each sensitive scope is needed, and a short screen recording showing a mentor connecting Google and a session appearing on their calendar. Review usually takes 2 to 6 weeks.
4. Until verification completes, mentors see Google's "unverified app" warning and must click **Advanced → Go to EmpowerEd (unsafe)** to continue.

### Test checklist

1. Add your test mentor's Google address as a test user (step 3).
2. Log in as that mentor → Dashboard → **Connect Google** → allow every permission. You return to the dashboard with a green "hosted on your Google account" card.
3. Book a session with that mentor as a student. The event appears on the mentor's Google Calendar and the student gets a Google invitation.
4. Open the session link: as the mentor (signed in to the connected Google account) you join directly with host controls; Meet does **not** say "open to anyone".
5. Open it as the invited student: direct join. From any other Google account: **Ask to join**, and the mentor gets the admit prompt.
