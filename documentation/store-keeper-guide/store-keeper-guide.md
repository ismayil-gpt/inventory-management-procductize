# Mizan — Store keeper guide

For the people who receive, issue, move and count stock. Everything you do is saved with your
name and the time, so the stock record can always be trusted.

## Signing in

1. Open Mizan in the browser on your tablet or PC.
2. Enter your email and password, then **Sign in**.
3. If your organisation uses two-step sign-in, enter the 6-digit code from your authenticator app.
   The first time, Mizan shows a QR code to scan with the app (Microsoft Authenticator or
   Google Authenticator), then asks for the code it shows.

Good to know:
- After **5 wrong attempts** the account locks for 15 minutes. Ask an administrator if you are stuck.
- After **30 minutes without activity** Mizan signs you out. A warning appears one minute before;
  tap **Stay signed in** to carry on.
- Switch between English and Arabic, and between light and dark, with the buttons at the top right.
  Mizan remembers your choice.

## Your morning briefing

Mizan opens on the **Morning briefing**: the number of things that need attention today, then the
list. As a store keeper you will see products running out within 7 days, counts in progress, and
any scans still waiting to sync. Ordering decisions are for administrators.

## Using the scanner

The wireless scanner works like a keyboard: point it at a barcode and it "types" the code.

1. On any barcode box, choose the **Scan** tab. The box turns yellow and says **Ready — scan a label**.
2. Scan. You do not need to tap anything first.
3. A large sign confirms every scan:
   - **yellow, Accepted** — the code was found;
   - **red, Not accepted** — the code is unknown (check the label, or type it);
   - **Already scanned** — you scanned the same label twice; the second scan is ignored.
   Each has its own sound, so you can work without looking.

If a label is damaged or the scanner battery is flat, use the **Manual entry** tab: type the code
and press **Find**.

Only one box listens to the scanner at a time. To move the scanner to another box, tap that box's
Scan area.

## Recording stock movements — Scan and move

Open **Scan and move** in the menu. Choose the type at the top:

| Type | Use it when | You scan |
|---|---|---|
| **Goods In** | stock arrives and goes onto a shelf | the shelf it goes **to**, then the product |
| **Goods Out** | stock is issued from a shelf | the shelf it comes **from**, then the product |
| **Transfer** | stock moves between shelves | **from** shelf, **to** shelf, then the product |
| **Adjustment** | the shelf quantity is wrong and must be corrected | the shelf, then the product |

Then:

1. Scan the shelf label. Its location (for example `SR1 · R1 · L1`) appears at the top. Stay on
   that shelf: scan as many products as you need without scanning the shelf again.
2. Scan the product. Mizan shows how many are on that shelf now.
3. Enter the quantity and press **Record movement**. A yellow sign confirms it.

Rules Mizan enforces:
- Stock can never go below zero. If you try to issue more than the shelf holds, Mizan stops you
  and says how many are there.
- An **Adjustment** needs a reason of at least 10 characters (for example "Two packs damaged by water").
  For an adjustment you enter the quantity that is **really** on the shelf; Mizan works out the difference.

## When the Wi-Fi drops

Keep working. Every movement is saved on the tablet first, then sent to the server.

- The bar at the bottom shows **Queue: N**, the number of movements waiting to send.
- When the connection returns, the queue empties by itself, in the order you recorded.
- A movement is never silently lost. If one cannot be saved (for example, the stock changed in
  the meantime), it stays in the list on the Scan and move page with the reason, for you or an
  administrator to fix.

## Looking things up

- **Movements**: every stock change, newest first. Filter by type, product or date.
- **Products**: search by name, SKU or barcode (also from the search box at the top), or scan a
  product label in the barcode box.
- **Storage locations**: the store rooms, racks and shelves. Select a rack or a shelf to see the
  **Rack view**: the rack drawn level by level, with each product coloured by stock state
  (green in stock, amber low, red critical, outline out of stock). Scanning a shelf label here
  highlights that shelf on its rack.

## Cycle counts

1. Open **Cycle counts** and press **Start cycle count** (add a note such as "Weekly spot-check").
2. Scan the shelf, then each product, and enter what you **counted**. Press **Record count**.
   Mizan shows the quantity on record and the difference.
3. Counting does not change stock by itself. When you finish, choose **Close (no changes)** or,
   if your administrator has asked you to, **Close & apply variances**, which records the
   differences as adjustments.

## Asking the assistant

Tap **Assistant** (bottom corner or menu) and ask in English or Arabic, for example "Which products
are low on stock?". Answers come only from Mizan's own data, and each answer lists the records it
used. Do not type personal information into questions; they are kept in the audit log.

## Signing out

Use **Sign out** at the bottom of the menu, especially on a shared tablet.
