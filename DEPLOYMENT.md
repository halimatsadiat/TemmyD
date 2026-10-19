# Free deployment: Render + Supabase

Repository: https://github.com/halimatsadiat/TemmyD
Supabase origin: https://qnkyytblqklzafwdkbks.supabase.co

## Render service

Use a Node web service on the Free plan. Build with `npm ci --omit=dev && npm run check`, and start with `npm start`. Set NODE_VERSION=24, NODE_ENV=production and HOST=0.0.0.0. Render supplies PORT. No disk or paid database is needed.

## Private environment values

Add the following directly to Render's Environment page. Do not paste them into chat, commit them to Git, or put them in screenshots.

- DATABASE_URL: copy the Session pooler URI from Supabase project > Connect. Replace its password placeholder with your database password; URL-encode reserved characters in the password. Use the host and username that Supabase supplies, not a guessed pooler address.
- SUPABASE_URL: https://qnkyytblqklzafwdkbks.supabase.co
- SUPABASE_SERVICE_ROLE_KEY: the server-side service role API key from your Supabase project settings. Never use this key in browser code.
- SETUP_TOKEN: your own private random value of at least 32 characters, used once to create the hosted admin.
- PGSSLROOTCERT_BASE64: optional base64-encoded Supabase database CA certificate if the connection needs its private root. TLS certificate verification remains enabled.

The app creates its private database schema and private photo bucket at startup. Use your own project credentials so initialization cannot affect another project. Existing local records are not automatically copied to the new cloud database.

## First sign-in

After the service starts successfully, open its HTTPS URL and visit /setup. Enter your private setup token, email, name and chosen password. After the admin exists, remove SETUP_TOKEN from Render and redeploy. Customers can then register separately.

## Paystack

In hosted admin settings, enter a Paystack test secret key and enable checkout. The Render public HTTPS address is used by default, or set APP_URL for a custom domain. Configure the Paystack test webhook as https://YOUR-SITE/api/payments/webhook. Complete a test payment and confirm the resulting order is marked paid before sharing the tester URL.

## Verify before sharing

Check /api/health, registration and sign-in, category creation, a cake upload, customer ordering, order updates, and image/order persistence after a restart. Free tier inactivity and quota limits still apply. Take database and storage backups separately; persistence is not a backup.
