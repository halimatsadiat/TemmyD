# Connect Brevo

1. In Brevo, add and verify your sender email under Settings → Senders, Domains & IPs → Senders. Use Temmyd Cakes as the sender name.
2. Under SMTP & API → API Keys, create an API key (not an SMTP key). Keep it private.
3. In Render's service Environment page, set:

```
EMAIL_PROVIDER=brevo
BREVO_API_KEY=<private API key>
EMAIL_FROM=Temmyd Cakes <your-verified-email@example.com>
EMAIL_ENABLED=true
APP_URL=https://temmyd-cakes.onrender.com
```

Save and deploy. As owner, visit `/admin/emails` and select Send a test to my email. Check the message in your inbox and Brevo's transactional logs. Sent means Brevo accepted the message, not guaranteed inbox delivery. Account approval and sender verification may be required by Brevo. Free-domain senders may be rewritten by Brevo; reply-to uses your verified email address.

Leave local EMAIL_ENABLED=false to keep local testing separate. Existing preview messages are never automatically sent when real delivery is enabled.

Brevo requests use HTTPS, an api-key header and the transactional endpoint. Retries retain the same idempotencyKey. A separate timestamp limits Brevo retries to ten minutes after the first attempt, conservatively inside the provider's deduplication window. Review Brevo logs before manually replacing a failed notification: a timeout may occur after the provider accepts a message. The original Resend integration remains available with EMAIL_PROVIDER=resend.
