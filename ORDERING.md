# Custom cakes, deposits and account recovery

## Cake customisation

Customers select size, flavour, filling and decoration on a cake page. The displayed price changes immediately. Extras apply per cake after the size multiplier. The server recalculates prices and validates current option names at checkout. Orders store a snapshot of selections and prices.

The starter options and extra prices are examples. Owner and manager accounts can edit them at **Admin → Cake options**. Use one `Name | price` entry per line. The first choice is the default. Each group requires 1–20 unique choices.

Signed-in customers may attach JPG, PNG or WebP reference images up to 4 MB. References are private to the uploader, owner and managers. They are served through authenticated endpoints; the public catalogue photo route refuses reference filenames. Uploads are limited to 20 per customer per day. Bakery catalogue photos remain public.

## Quote requests

Customers open **Custom cake**, describe the cake and budget, add a celebration date, contact/fulfilment details and optional reference photo. They review requests through **My account → Your custom cake requests**. There is a limit of ten requests per account per day.

Owners and managers use **Admin → Custom requests** to offer a total including delivery, design/size/flavour details and terms, with a validity of 1–30 days, or decline the request. Revising a quote invalidates acceptance of an older version. Expired quotes and dates inside the preparation window cannot be accepted.

Accepting creates one unpaid order with the agreed price and quote details. Repeating acceptance returns the same order instead of creating another. The order then uses the existing order management, payment and delivery flows.

## Deposits and balances

The initial default deposit is 50%. The owner can change it to 10–100% under **Admin → Cake options → Deposit policy**. New orders snapshot the policy; later changes leave them unchanged. Customers can pay in full or pay the deposit and later settle the balance. A second payment charges only the remaining balance. No card details are stored by the bakery.

Only verified Paystack transactions add to the amount paid. Deposit payments produce Part-paid status; full settlement produces Paid. References, amount, currency and mode are checked, duplicate verification is idempotent, and payments in different test/live modes cannot be combined. Existing manual Paid records retain their meaning. Verified payments cannot be edited using the manual payment selector; refunds remain a Paystack dashboard operation.

Owners can generate payment reminders from the order dialog, at most once per order per 24 hours. Automatic reminders are checked at startup and hourly for Part-paid orders due in the next three days that are still active. The email queue uses the configured provider; local mode creates previews. A sleeping free host resumes checks when it wakes, so reminders are not guaranteed to run at a particular hour.

## Password recovery

The sign-in page links to **Forgot password?**. Requests return the same response for known and unknown accounts and are limited by email and connection address. Reset tokens are random, stored hashed and valid for 30 minutes. A new request invalidates the previous link. Tokens work once. Resetting keeps the account's existing role, signs out all sessions, clears the stored reset email body, sends a password-change notice and requires a fresh sign-in. Password changes from an authenticated profile also invalidate outstanding reset tokens.

Locally, the owner can read the reset email under **Admin → Emails**. Production preview-content access is disabled; real recovery therefore requires a working Brevo or Resend configuration. API keys, reset tokens and real account credentials must never be placed in source control.

## Validation

`npm run check` validates all JavaScript. `npm test` covers server pricing, reference ownership, quote revisions/acceptance, policy snapshots, reminders, reset/session behaviour, verified partial payments and PostgreSQL-compatible schemas, together with the existing bakery tests. UI checks use disposable accounts and orders, without charging money or sending real emails.
