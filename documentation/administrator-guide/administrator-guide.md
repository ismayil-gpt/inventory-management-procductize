# Mizan — Administrator guide

For the store manager and IT administrator. Administrators can do everything in the
[Store keeper guide](../store-keeper-guide/store-keeper-guide.md), plus everything below.
Installing Mizan on the server is covered separately in [production-deployment.md](production-deployment.md).

## Your daily routine

1. **Morning briefing** (the first screen). Mizan reviews stock every day at 07:00. The briefing
   shows how many things need you today:
   - **Approve orders** — each recommendation explains itself in plain words, for example
     "Stock is 12 units. Average use is 4 a day and delivery takes 5 days, so stock runs out in
     about 3 days. Recommend ordering 48." Change the quantity if needed, then **Approve**.
   - **Running out this week**, **Counts in progress**, **Scans waiting to sync**.
2. **Generate purchase orders** in **Replenishment** once the day's approvals are done.

Mizan never orders anything by itself. It recommends; an administrator decides.

## Replenishment and purchase orders

- **Replenishment** lists every recommendation with its reasoning and status.
  - **Approve** as suggested, or change **Order quantity** first (recorded as "amended").
  - **Reject** needs a reason. A rejected product is not suggested again the same day.
  - **Run review now** repeats the 07:00 check on demand.
- **Generate purchase orders** creates one purchase order per supplier from everything approved,
  and emails each supplier its PDF. Products without a supplier are skipped and reported.
- **Purchase orders** lists every order with its status and when it was emailed. **View PDF**
  opens the order.
- **Suppliers** holds names, email addresses, phone numbers and **lead times**. Lead times feed the
  reorder calculation directly, so keep them accurate.

## Products

- **New product**, **Edit**, deactivate. Each product has a category, a base unit, pack size,
  reorder point, minimum and maximum levels, a supplier and a unit cost.
- **Import**: download the Excel template, fill it in, and run a **dry run** first. Mizan checks
  every row and lists the errors; nothing is imported until the whole file is valid.
- **Print labels** prints barcode labels for the products currently listed: narrow the list with
  search or a category first. A single product's label prints from its own page. Products without
  a manufacturer barcode get one from Mizan.

## Storage structure

Your organisation's shape (for example Store room → Rack → Level) is configuration, not code.

- **New store room** (or the top level your organisation uses) and **Bulk create**: choose a
  parent, give each level a prefix and a range (for example racks R1–R6, levels L1–L5), check the
  **preview**, then create. Print the new shelf labels straight away.
- Select any rack or shelf for the **Rack view** and its stock.
- A location can be deleted only if it has never held stock. Otherwise Mizan refuses and you
  deactivate it instead, so the stock history stays intact.

## Users and access

**Users** (administrators only):

- **Add user**: name, email, role (**Administrator** or **Store keeper**) and a password of at least
  12 characters. Common passwords are refused.
- **Edit**: change role, reset the password, or deactivate. Deactivating someone or resetting their
  password **signs them out everywhere at once**.
- **Signed in on** shows how many devices each person is signed in on. **End sessions** signs them
  out of all of them now (for example, a lost tablet).
- **Two-step**: shows who has set up two-step sign-in. **Reset two-step** clears it for someone who
  lost or replaced their phone; they set it up again at their next sign-in. You cannot reset your
  own; ask another administrator.
- A locked account (5 wrong attempts) unlocks by itself after 15 minutes, or reset its password.

## Audit log

**Audit log** shows every change: who, what, when, and the values before and after. Filter by
record type or action. Nothing in it can be edited or deleted, by anyone. Sign-ins, failed
attempts, lockouts and two-step events are recorded with the device's network address.

## Security and data

**Security and data** shows Mizan's on-premise promise (data, AI and processing stay on your
server; supplier email is the only outbound connection) and the status of all 20 DESC security
controls, read directly from the compliance evidence. Open a row to see where it is implemented.
The **On-site** badge in the bottom bar links here.

## Settings

**Settings** holds the organisation's name in English and Arabic, the default language and the
time zone. Changes apply immediately and are audited.

## Turning on two-step sign-in

Two-step sign-in is built in and switched off until certification. To switch it on, the IT
administrator sets `MFA_ENABLED=true` on the server and restarts the backend (see the production
guide). Everyone then sets it up at their next sign-in. The AI service's own account is the only
exception, and only from inside the server.

## Reports and insights

- **Reports**: stock on hand, stock movements and replenishment, as PDF or Excel (English).
- **Insights**: forecasts from the last 150 days — products at risk of running out, usage trends,
  forecast against actual, and projected reorder spend by supplier and category.

## Backups

Backups run every night (02:00) on the server, encrypted, and a restore is tested weekly. If data
must be restored, follow `documentation/security-compliance/backup-and-recovery-procedure.md`.
Make sure the backup key is kept somewhere other than the server: without it, backups cannot be read.
