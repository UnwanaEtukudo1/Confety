# Confety

A vibrant, responsive event platform prototype built with HTML, CSS, and JavaScript. No installation or build step is required.

## Run locally

Use Node.js 18 or newer:

```sh
npm run dev
```

Open http://127.0.0.1:4173. Run `npm run check` for JavaScript syntax checks.

## Included

- Responsive event discovery, category filters, search, sorting, and saved favorites.
- Event details with dates in venue local time and capacity tracking.
- Event creation for music, nightlife, weddings, conferences, workshops, sports, and other occasions.
- Organizer workspace with sales pause/resume, booking counts, and demo revenue.
- Simulated ticket checkout, booking references, order history, and CSV export.
- Local browser persistence, native dialog keyboard support, reduced-motion support, and form validation.

## Prototype boundaries

Events, prices, orders, and metrics are illustrative. Prices use demo USD. There are no production accounts, server database, real payments, valid admission tickets, emails, or public event publishing. Data is saved only in the current browser using localStorage; avoid entering sensitive or actual customer information. Clearing browser storage resets the prototype. Created events appear only in that browser. The organizer workspace is a demonstration and has no authentication.

Fonts load from Google Fonts, and sample images load from Unsplash and Pravatar. Network access is required for these visual assets; core functionality has no external dependency.

Hosting is intentionally local for review. The public GitHub repository contains the source code only. Payment provider, production currency, authentication, event moderation, and hosting should be agreed before production implementation.

## Customer demo accounts (`codex/customer-auth`)

Open `/#login` or `/#signup`, or choose **Log in** in the header. Create a demo profile with a made-up email and a password not used elsewhere, log out, and sign in again with those credentials. `/#account` displays the signed-in profile. Signed-in name and email prefill demo checkout.

Demo profiles remain in localStorage in this browser. Passwords are stored as salted PBKDF2-SHA-256 hashes, never as plaintext. The signed-in profile ID is held in sessionStorage and restored on reload. Logging out clears that tab's session. These client-side records are editable by the browser user and provide **no production authentication or access control**. The organizer workspace and event data remain shared browser-local prototype data. There is no email delivery, verification, password recovery, cross-device account, or backend session.

Run `npm test` to check profile creation, credential verification, session restoration, duplicate and invalid input rejection, and storage failures.

## Customer resale marketplace (`codex/ticket-resale`)

This branch starts from `codex/customer-auth`. Open `/#marketplace` to browse resale tickets, or `/#sell` to manage your tickets, listings, and resale purchases.

### Try the full demo

1. Create or log in to a demo seller profile. Buy an event ticket through the existing simulated checkout while signed in.
2. Open **My account → My tickets & listings**. Select tickets, enter quantity and price, and publish a demo listing. Active listings reserve that quantity.
3. Log out, then create or log in to a different demo buyer profile in the same browser. Open **Ticket resale**, view a listing, and confirm a simulated purchase.
4. Purchased tickets appear under **My tickets** and **Resale purchases** for the buyer. Sellers can see remaining inventory and demo proceeds under **My listings**, and withdraw unsold tickets. Purchased resale tickets can be relisted.

Guest orders from older versions remain visible in the shared organizer prototype but cannot be claimed for resale by matching an email. New primary orders are associated with the signed-in profile ID. The resale ledger has a separate localStorage key, `confety-resale-v1`. It records active reservations and transfers; resale does not increase primary event ticket sales or capacity. Partial sales reduce listing quantities, sold listings cannot be bought again, and withdrawing a partially sold listing returns only unsold tickets. Expired events cannot be listed or purchased. Prices use demo USD with no demo fees. No production markup, refund, or transfer policy is implied.

Resale writes re-read persisted orders and listings and use browser Web Locks to serialize updates across tabs. If locking or storage is unavailable, transactions fail with a visible message instead of reporting success. The original browser-only demo account model still provides no real security boundary. Data is editable in browser tools, is not shared across devices, and does not represent verified tickets. No real payments, payouts, transfers, or admission tickets are created. A production marketplace would require backend ownership checks, event resale policies, payments, fraud handling, and durable inventory.

`npm test` covers demo account behavior, ownership restrictions, reservation quantities, partial purchases, withdrawal, relisting, invalid prices/quantities, self-purchases, expired events, and stale purchase attempts.
