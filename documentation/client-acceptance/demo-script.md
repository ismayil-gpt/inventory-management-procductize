# Mizan — Client demonstration script

About 25 minutes. Two people: one at the PC or projector (administrator), one at the store-room
tablet with the scanner (store keeper). Everything shown runs on the demonstration server; no
internet is used.

## The day before

- [ ] Rebuild the demo data: `scripts/reset-demo-database.sh --yes` (about 10 seconds; takes an
      encrypted backup first). This gives a clean 150-day history, 75 products, 3 store rooms,
      8 recommendations waiting and one cycle count in progress.
- [ ] Start everything; open `https://<server>/` on the PC and the tablet; sign in once on each.
- [ ] Tablet: pair the scanner, open **Scan and move**, check a shelf label beeps **Accepted**.
- [ ] Print three shelf labels and three product labels for the store-room part (Storage locations
      → select a rack → Print label; Products → Print labels).
- [ ] Check the bottom bar says **Synced** and **On-site** on both devices.
- [ ] Assistant: English only (see "What not to show").

## 1. The pitch in one screen — Morning briefing (3 min)

Sign in as **admin@example.com**. Mizan opens on the **Morning briefing**.

- "Every morning at 07:00 Mizan reviews every product. Today, 7 things need you." (The big number.)
- Read one recommendation aloud. It explains itself in numbers: stock, daily use, delivery time,
  when it runs out, how many to order.
- "Mizan recommends; a person decides. Nothing is ever ordered on its own."
- Change one quantity and press **Approve**. The count drops.

## 2. Scanning in the store room (6 min) — tablet

Sign in as **storekeeper@example.com** on the tablet. **Scan and move** → **Goods In**.

1. Choose the **Scan** tab. "No need to tap a field; just scan."
2. Scan a shelf label: full-screen yellow **Accepted**, with a beep.
3. Scan a product, enter a quantity, **Record movement**: **Goods In recorded**.
4. Scan the same label twice quickly: **Already scanned**, different sound.
5. Scan an unknown or damaged label: red **Not accepted**, low buzz. "Unmistakable in a noisy room."
6. **Offline**: switch the tablet's Wi-Fi off, record a movement. The bar shows **Queue: 1**.
   Switch Wi-Fi on; it syncs by itself and the queue returns to 0. "A scan is never lost."

## 3. Where things are — Rack view (2 min) — PC

**Storage locations** → open **SR1** → select a rack. The rack is drawn as it stands, floor up,
with each product coloured by stock state. Scan (or type) a shelf label: that shelf lights up.
"The same screens work for any building: a hospital's floors and cabinets or a warehouse's aisles
and bins are configuration, not new software."

## 4. Purchase orders (3 min) — PC

**Replenishment** → **Generate purchase orders**. One order per supplier, emailed as PDF.
**Purchase orders** → **View PDF**. "Approved this morning, ordered by noon, every step recorded."

## 5. Arabic and night mode (2 min)

Press **العربية**: the whole interface turns right to left, the location signs keep their codes
left to right, the purchasing reasoning appears in Arabic. Press the theme button for night mode.

## 6. Trust: security and audit (4 min)

- **Security and data**: "Your data never leaves this building", then all 20 DESC controls with
  their current status, read from the evidence file. Open one row to show where it is implemented.
- **Audit log**: the movements just recorded, the approval, the sign-ins, each with who and when.
  "Nothing here can be edited or deleted, not even by an administrator."
- **Users**: two-step sign-in ready to switch on at certification; **End sessions** for a lost tablet.

## 7. Questions to Mizan (2 min) — English only

Open **Assistant** and press **Which products are low on stock?**. Open **Based on N records**:
"Every figure comes from the stock records shown; it never guesses."

## 8. Reports (1 min)

**Reports** → Stock on hand → Excel. **Insights** for the forecasts.

## What not to show

- **The assistant in Arabic.** The model that fits the current server does not yet meet the Arabic
  quality bar (`documentation/security-compliance/language-model-validation.md`, CLAUDE.md §2.2).
  English answers are correct; Arabic is not ready. Say so if asked.
- **API documentation pages or developer tools.**
- **The demo logins box** in the menu on development builds; it does not exist in production.

## Likely questions

| Question | Answer |
|---|---|
| Does it need the internet? | No. Only outgoing email to suppliers. The AI runs on this server. |
| What if the Wi-Fi drops in the store room? | Scans queue on the tablet and sync on reconnect; the bottom bar shows how many are waiting. |
| Can it order on its own? | Never. Only an administrator approves. |
| Can records be changed afterwards? | No. Movements and the audit log are append-only in the database itself. |
| Different building layouts? | Yes, by configuration: Settings and Storage locations, no code. |
| Is it DESC compliant? | The Security and data page shows each control's status and evidence. Two-step sign-in switches on at certification. |
