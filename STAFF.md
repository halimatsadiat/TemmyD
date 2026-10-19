# Bakery staff

Sign in as the owner and open `/admin/staff`.

- **Owner:** full access, including staff, business settings and payment settings/records.
- **Manager:** cakes, photo uploads, categories, orders and delivery assignments. Cannot change payment records, settings or staff access.
- **Delivery staff:** assigned delivery orders only, with customer name, phone, address, date and cake quantities. Financial details and customer email are withheld. Progress moves from Ready to Out for delivery to Delivered.

Enter the staff member's email and role, create an invitation, and copy the link. In default preview mode, send it privately yourself. When email delivery is configured, invitations are queued automatically; check Emails for status. The recipient signs in or registers with that exact email and accepts the invitation. Links expire after seven days and can only be used once. Creating another invitation for the same email revokes the previous one. See EMAIL.md for configuration.

Change a team member's role or choose Remove staff access and save. This signs them out, clears their delivery assignments and revokes pending invitations. The owner account cannot be demoted. Pending invitations can also be revoked individually.

To assign deliveries, open an order from Orders or Deliveries, select an active delivery staff member, and save. Mark it Ready when it can be dispatched. Customer order timelines show delivery updates.

Staff tables are added automatically on startup in the application's existing private database schema. Invitation tokens are stored as hashes. Permissions are enforced by the server, independently of the navigation links.
