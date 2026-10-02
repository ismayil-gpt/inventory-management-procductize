# Mizan — User acceptance checklist (MVP)

For the client's testers. Each line is one thing the MVP must do (CLAUDE.md §1, §12, §13, §15).
Work through it on the demonstration server with the demo data, then sign at the end.
Mark each line **Pass**, **Fail** (with a note) or **N/A**.

Accounts: an administrator and a store keeper (provided separately).

## Signing in and access

| # | Do this | Expect | Result |
|---|---|---|---|
| 1 | Sign in as the store keeper | Morning briefing opens; no Audit log, Users or Settings in the menu | |
| 2 | Enter a wrong password 5 times | Account locked for 15 minutes; message says so | |
| 3 | Leave Mizan untouched for 30 minutes | Warning at 29 minutes; then signed out with an explanation | |
| 4 | Sign in on two devices; administrator presses **End sessions** for that user | Both devices are signed out at their next action | |

## Stock and scanning

| # | Do this | Expect | Result |
|---|---|---|---|
| 5 | Scan a shelf label, then a product; Goods In 5 | **Accepted**, **Goods In recorded**; product stock up by 5 | |
| 6 | Goods Out more than the shelf holds | Refused; message says how many are there | |
| 7 | Transfer 2 between two shelves | One shelf down 2, the other up 2 | |
| 8 | Adjustment with a reason under 10 characters | Refused; asks for a reason | |
| 9 | Scan the same label twice within a second | **Already scanned**; recorded once | |
| 10 | Wi-Fi off, record a movement, Wi-Fi on | **Queue: 1**, then 0; movement appears in Movements | |
| 11 | Cycle count: count a shelf, **Close & apply variances** | Differences recorded as adjustments, stock updated | |
| 12 | Storage locations → select a rack | Rack view shows each level and its products by stock state | |

## Replenishment and purchasing

| # | Do this | Expect | Result |
|---|---|---|---|
| 13 | Open Morning briefing as administrator | Recommendations with plain-language reasoning in numbers | |
| 14 | Approve one as suggested, amend another, reject a third with a reason | Statuses Approved / Amended / Rejected; rejected one not suggested again today | |
| 15 | **Generate purchase orders** | One order per supplier; PDF opens; supplier emailed (with SMTP configured) | |
| 16 | As store keeper, try to approve | Not possible (no Approve buttons; the server refuses) | |

## Administration

| # | Do this | Expect | Result |
|---|---|---|---|
| 17 | Bulk create a rack with 5 levels; preview, then create | Preview lists them; created; labels printable | |
| 18 | Import products from Excel with one bad row (dry run) | Row-by-row errors; nothing imported until all rows are valid | |
| 19 | Add a user with a weak password | Refused (12+ characters, not a common password) | |
| 20 | Audit log | Every action above appears with who, when, before and after | |

## Language, display and reports

| # | Do this | Expect | Result |
|---|---|---|---|
| 21 | Switch to Arabic, reload | Stays Arabic, right to left; codes stay left to right | |
| 22 | Switch to dark, reload | Stays dark | |
| 23 | Use a tablet in portrait and landscape | No sideways scrolling; controls easy to tap | |
| 24 | Reports: stock on hand, movements, replenishment as PDF and Excel | Files open with correct figures | |
| 25 | Ask the assistant (English) "How much coffee do we have?" | Answer lists the records it used; figures match Products | |

## Security and data

| # | Do this | Expect | Result |
|---|---|---|---|
| 26 | Open Security and data | 20 DESC controls with status; on-premise statement | |
| 27 | Ask IT to confirm the server makes no outbound connections except SMTP | Confirmed | |

## Known limitations at this stage

- Assistant in Arabic: not yet at the required quality on the current server (§2.2).
- Two-step sign-in: built, switched off until certification.
- Production installation on the client's server: first run pending (see the production guide).

## Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Client representative | | | |
| Grow Plus Technologies | | | |
