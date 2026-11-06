import { amount, bool, field, optional, ref, resource, section, status } from './catalog.mjs';
import { saveRecord, timestamp } from './store.mjs';

const page = section('marketing', 'Marketing & promotion', '↗', 'Prepare event pages, tracked links, referrals, and recovery campaigns.', {
  actions: [{ label: 'Manage promo codes', nav: 'ticketing', resource: 'promos' }],
});

resource(page, 'landingPages', 'Landing & event pages', [
  field('title', 'Page title'), ref('event', 'Event', 'events', true),
  field('slug', 'Page slug'), field('headline', 'Hero headline'), field('body', 'Page copy', 'textarea'),
  optional('banner', 'Banner image', 'media'), field('metaTitle', 'SEO title'), field('metaDescription', 'SEO description', 'textarea'),
  bool('featured', 'Featured homepage slot'), status(['Draft', 'Preview published']),
], {
  rows: [{ id: 'landing-1', title: 'Sunset Sessions event page', event: 'sunset', slug: 'sunset-sessions', headline: 'The good times start at sunset', body: 'A demo page for a night of live music.', banner: '', metaTitle: 'Sunset Sessions · Confety', metaDescription: 'Live music at golden hour in Lagos.', featured: true, status: 'Preview published' }],
  validate(row, state) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)) throw Error('Use a lowercase URL slug with hyphens.');
    if (state.records.landingPages.some(item => item.id !== row.id && item.slug === row.slug)) throw Error('That slug is already in use.');
  },
  actions: [{ label: 'Preview page', command: 'page-preview' }],
});

resource(page, 'banners', 'Homepage banners', [
  field('title', 'Banner headline'), optional('image', 'Artwork', 'media'),
  ref('event', 'Featured event', 'events', true), amount('position', 'Slot order', 1, 50),
  field('start', 'Start date', 'date'), field('end', 'End date', 'date'), bool('active', 'Active slot'),
], {
  validate(row, state) {
    if (row.start > row.end) throw Error('Banner end must follow its start.');
    if (row.active && state.records.banners.some(item => item.id !== row.id && item.active && item.position === row.position && item.start <= row.end && item.end >= row.start)) throw Error('An active banner already uses this slot and date range.');
  },
  actions: [{ label: 'Preview banner', command: 'page-preview' }],
});

resource(page, 'tracking', 'Tracking & social links', [
  field('title', 'Link name'), field('url', 'Destination URL', 'url'), field('source', 'UTM source'),
  field('medium', 'UTM medium'), field('campaign', 'UTM campaign'), optional('content', 'UTM content'),
], {
  rows: [{ id: 'utm-1', title: 'Sunset launch', url: 'https://example.com/sunset', source: 'instagram', medium: 'social', campaign: 'sunset_launch', content: 'story' }],
  actions: [{ label: 'Build share link', command: 'tracking' }],
});

resource(page, 'referrals', 'Referral & affiliate programs', [
  field('title', 'Referral code'), ref('event', 'Event', 'events', true), ref('promo', 'Linked discount', 'promos', true),
  field('partner', 'Affiliate or partner'), amount('commission', 'Commission (%)', 0, 100),
  amount('conversions', 'Demo conversions'), status(['Active', 'Paused']),
], { rows: [{ id: 'ref-1', title: 'SUNSET-FRIENDS', event: 'sunset', promo: 'promo-1', partner: 'Marina Collective', commission: 8, conversions: 3, status: 'Active' }] });

resource(page, 'recovery', 'Waitlist & cart recovery', [
  field('title', 'Recovery campaign'), ref('event', 'Event', 'events'),
  status(['Waitlist', 'Abandoned cart'], 'kind', 'Trigger'), amount('cartCount', 'Demo abandoned carts'),
  field('message', 'Message', 'textarea'), status(['Draft', 'Queued', 'Simulated sent']),
], {
  actions: [{ label: 'Simulate recovery', when: row => row.status !== 'Simulated sent', run(state, row) {
    const count = row.kind === 'Waitlist' ? state.records.waitlist.filter(item => item.event === row.event && ['Waiting', 'Invited'].includes(item.status)).length : row.cartCount;
    if (!count) throw Error('There are no recipients for this campaign.');
    saveRecord(state, 'delivery', { title: row.title, event: row.event, channel: 'Email', audience: row.kind, date: timestamp().slice(0, 16), status: 'Simulated sent', count });
    row.status = 'Simulated sent';
  } }],
});
