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

## Dedicated event pages (`codex/event-detail-pages`)

This branch starts from `main` and retains the purple/pink design. Discovery cards open dedicated, reloadable `/events/:id` pages. Browser Back/Forward and copy-link navigation are supported. Locally created events can only be opened in the browser holding their data.

- `/events/sunset`: tour example with About, three dates/cities, gallery lightbox, expandable FAQ, clearly labeled fictional reviews, venue information, and ticket booking.
- `/events/neon`: recurring-event example with multiple editions.
- `/events/groove`: simpler concert example with an interactive illustrative seating-section map, Floor/Lower Bowl/VIP prices and availability, and venue information. Sections are unreserved; there are no numbered seats or real seating plans.
- Other curated events use the rich template, showing empty states when photos/reviews are unavailable.
- Event creation includes a page-style selector. New concert examples divide capacity among Floor (60%), Lower Bowl (30%), and VIP (the remainder), with demo prices at the entered base, 1.4×, and 2×. These tiers are illustrative and are not a production ticketing configuration interface.

Checkout verifies the chosen occurrence and section, computes the section price × quantity, and saves date, venue, city, section, and unit price with the local order. Order history and CSV export include these details. Inventory is tracked separately per occurrence and section; older prototype orders count against the first occurrence and section. Existing browser data is retained. No real payment, reservation hold, email, or valid admission ticket is created. No multi-user inventory synchronization is provided.

Run `npm test` for section capacities, independent tour dates, legacy orders, invalid selections, and custom concert capacity allocation. The development server supports direct event URLs; another host must also route `/events/:id` to `index.html`.
