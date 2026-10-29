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

Events, prices, orders, and metrics are illustrative. Prices use demo USD. There are no accounts, server database, real payments, valid admission tickets, emails, or public event publishing. Data is saved only in the current browser using localStorage; avoid entering sensitive or actual customer information. Clearing browser storage resets the prototype. Created events appear only in that browser. The organizer workspace is a demonstration and has no authentication.

Fonts load from Google Fonts, and sample images load from Unsplash and Pravatar. Network access is required for these visual assets; core functionality has no external dependency.

Hosting is intentionally local for review. The public GitHub repository contains the source code only. Payment provider, production currency, authentication, event moderation, and hosting should be agreed before production implementation.
