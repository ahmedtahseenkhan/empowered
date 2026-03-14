# Mentor subscription flow (2‑month free trial, then annual billing)

## Is the flow correct?

**Yes.** Showing the Stripe Checkout page is correct even though we do **not** charge at signup:

1. We need the **card on file** so Stripe can charge when the trial ends.
2. Checkout is configured with **2‑month free trial** (`trial_period_days: 60`). No charge today.
3. After 60 days, Stripe automatically charges the saved card (annual amount) and then each year.

So: **Stripe page → collect card, no charge → 2 months free → then we charge.** No change needed to this flow.

---

## Intended flow (step by step)

1. **Mentor clicks “Start Free Trial”** (Subscription Settings or Tutor Register step 4).
   - Client: `POST /api/payments/mentor/subscription` with `priceId`, `tier`, `successUrl`, `cancelUrl`.
   - Backend: create Stripe Customer (if needed), create Checkout Session with `trial_period_days: 60`, return `url`.
   - Client: redirect to `url` (Stripe Checkout).

2. **Mentor completes Checkout** (enters card, clicks “Start trial”).
   - Stripe creates a **subscription** in status `trialing`, **no charge**.
   - Stripe redirects to `successUrl` with `?session_id=cs_xxx` (or `&session_id=...` if URL already had query params).

3. **Mentor lands back on your app** (e.g. `/subscription-settings?session_id=cs_xxx`).
   - Page reads `session_id`, calls `POST /api/payments/mentor/subscription/confirm` with `{ session_id }`.
   - Backend: load Checkout Session, get subscription id, load Subscription from Stripe, update `TutorProfile`:
     - `stripe_subscription_id`, `subscription_status` (`trialing`), `subscription_end_date`, `tier`.
   - Page refetches profile; “Subscription Required” goes away and mentor can use the app.

4. **Webhook (backup).**
   - Stripe sends `checkout.session.completed` to your webhook URL.
   - Same update to `TutorProfile` is applied. So even if the confirm-on-return request fails or is slow, the webhook can fix it.

5. **When the trial ends (60 days later).**
   - Stripe creates an invoice and charges the saved card (annual amount).
   - Stripe sends `invoice.paid`; we can update `subscription_end_date` if needed.
   - Subscription status becomes `active`.

---

## Why “Subscription Required” might still show after Checkout

- **Confirm request never runs or fails**  
  After redirect, the app must call `POST /api/payments/mentor/subscription/confirm` with the `session_id` from the URL. If that request is not sent (e.g. wrong API URL, or JS error), or it fails (e.g. 401, 500), the tutor is never updated.

- **Return URL has no `session_id`**  
  Stripe should append `session_id` to the success URL. If your host or proxy strips query params, or the success URL is wrong, the client won’t have `session_id` and won’t call confirm.

- **Webhook not reachable**  
  If the webhook endpoint is not set in Stripe or not reachable (e.g. wrong URL, firewall), `checkout.session.completed` never runs and the only way to update the tutor is the confirm-on-return call.

**What to check in production**

1. **After completing Checkout**, open DevTools → Network. Confirm that a request goes to `POST .../api/payments/mentor/subscription/confirm` with body `{ session_id: "cs_..." }`. Check the response (200 vs 4xx/5xx).
2. **In the browser console**, you should see `[Subscription] Found session_id in URL, calling confirm...` and then either `[Subscription] Confirm success` or an error.
3. **Stripe Dashboard** → Developers → Webhooks: endpoint should be `https://<your-domain>/api/stripe/webhook`, and `checkout.session.completed` should be selected. Check “Recent deliveries” for errors.
4. **Backend logs**: you should see `[Payments] POST /mentor/subscription/confirm received` when the confirm endpoint is hit.

If the user just completed Checkout but the page didn’t update, they can click **“I completed checkout — sync my subscription”** (shown when we have `session_id` in URL or in sessionStorage). That retries the confirm call.

---

## Database (TutorProfile)

- `stripe_subscription_id` – Stripe subscription ID (set by confirm or webhook).
- `subscription_status` – `trialing` | `active` | `past_due` | `canceled`.
- `subscription_end_date` – end of current period or trial (used for “days left” and access control).

The app treats `active` and `trialing` as “has access”; no charge is made until the trial ends.
