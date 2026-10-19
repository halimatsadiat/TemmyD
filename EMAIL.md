# Email notifications

Email defaults to **preview mode**. No credentials are needed and no mail is sent. Sign in as the owner, open `/admin/emails`, and create a test preview or place a new customer order. Order events, verified payments, manual payment-record changes, and staff invitations generate notification records. Open **Read preview** locally to inspect the message. Previews are owner-only; the preview-content endpoint is disabled in production.

## Real delivery later

The backend supports Brevo and Resend over HTTPS. See BREVO.md for the Brevo setup. For Resend, verify a sender domain, then privately configure these server environment variables:

```
RESEND_API_KEY=<your private Resend API key>
EMAIL_PROVIDER=resend
EMAIL_FROM=Temmyd Cakes <orders@your-verified-domain.com>
EMAIL_ENABLED=true
APP_URL=https://your-bakery-site.example
```

Restart/deploy, then use **Send a test to my email**. Do not commit keys. A configured provider without `EMAIL_ENABLED=true` remains in preview mode. Previous preview messages never become sendable automatically.

The database outbox survives restarts. While the app is running it checks for queued messages every 30 seconds. Temporary failures retry with backoff, up to five attempts. Provider requests use a stable idempotency key; messages older than 23 hours stop retrying to avoid crossing the provider's deduplication window. Revoked, expired or accepted invitations are cancelled before sending. Sent invitation links are removed from the stored message body. Only the bakery owner can see notification metadata. Sent means the provider accepted the email, not that it reached the inbox; bounce/delivery webhooks are not implemented.

On a sleeping free host, queued mail resumes when the application wakes. Staff invitation creation still returns a copyable link as a fallback. Email previews may contain private invitation tokens: share these only with the intended recipient.

Order updates and payment emails describe order state; they are not tax invoices. Test Paystack verification is clearly labelled as a test with no real money collected.
