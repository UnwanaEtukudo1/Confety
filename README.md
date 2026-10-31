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
