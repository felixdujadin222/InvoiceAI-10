# Security Specification: InvoiceFlow AI

## Data Invariants
1. A **User** profile must always have a `userId` field matching their Auth UID.
2. **Clients**, **Invoices**, **Expenses**, **Quotes**, and **Templates** must all reside under the owner's `users/{userId}/...` path.
3. Users can only read/write their own data.
4. **Public Invoice Access**: Unauthenticated users can `get` a specific invoice if they have the direct ID, but cannot `list` all invoices.
5. **Simulated Payment**: Unauthenticated users can only update the `status` of an invoice to 'paid' (simulated payment).

## The "Dirty Dozen" Payloads (Deny Cases)
1. **Identity Spoofing**: Attempting to create a user profile with a `userId` that doesn't match the Auth UID.
2. **Resource Poisoning**: Using a 1MB string for a client name or invoice number.
3. **Cross-Tenant Write**: User A attempting to create an invoice under User B's path.
4. **Cross-Tenant Read**: User A attempting to list User B's clients.
5. **Orphaned Client**: Creating a client with a malformed ID that doesn't match standard patterns.
6. **State Shortcut**: Updating an invoice status from 'draft' to 'paid' without being the owner (unless via the specific payment gate).
7. **IIlegal Field Injection**: Adding a `isAdmin: true` field to a user profile.
8. **Malicious ID**: Using `../../system/config` as a document ID.
9. **Blanket Read Request**: Trying to perform a collection group query on all invoices.
10. **Array Explosion**: Sending an invoice with 10,000 items.
11. **PII Leak**: An unauthenticated user attempting to list the `/users` collection to find emails.
12. **Immutable Field Change**: Owner trying to change the `createdAt` timestamp of a paid invoice.

## Firestore Security Tests
This is implemented in `firestore.rules.test.ts`.
