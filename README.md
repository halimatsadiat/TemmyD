# Temmyd Cakes

A responsive bakery app with customer accounts, a cake catalogue, categories, custom cake messages, checkout, order tracking, admin management and Paystack hosted payments.

## Local development

Use Node 24+ and run `npm ci`, then `npm start`. Open http://127.0.0.1:4174. Local development uses SQLite and uploads in the ignored `data/` folder. Your existing local records remain separate from cloud records.

## Free cloud hosting

The app now supports Supabase PostgreSQL and Supabase Storage. On Render it refuses to use temporary SQLite storage, protecting orders against accidental data loss. The private `bakery` database schema is created at startup and is not exposed through the default Supabase public Data API. Cake photos are stored in a private `cake-photos` bucket and served through the application.

See DEPLOYMENT.md for the required server-only environment values. Use a Render Free service, without an attached paid disk. The free service can sleep when idle, and the Supabase Free project can pause after inactivity.

## Security and payments

Customer records require sign-in and ownership checks. Admin writes require an admin role. Hosted first-admin setup requires a private SETUP_TOKEN, and only one admin account can be created. Passwords are hashed; session tokens are hashed and sent in HTTP-only cookies, with Secure enabled in production.

Paystack payment references, amounts, currency and test/live mode are verified server-side. Signed webhooks and browser-return verification are idempotent. Payment credentials and settings are stored server-side in the private database. Keep Paystack in test mode until a real provider test transaction has been checked. The site does not issue refunds or provide GPS courier tracking.

## Validation

`npm run check` validates syntax. `npm test` runs isolated account, order, upload, category, payment and hosting tests, plus PostgreSQL schema checks using an embedded PostgreSQL engine. This does not replace checking the actual hosted Supabase connection and a provider test payment.
