import { amount, currencies, field, optional, ref, resource, section, status } from './catalog.mjs';
import { rowsOf } from './store.mjs';

const page = section('partners', 'Speakers, sponsors & vendors', '✳', 'Manage contributors, partner packages, booth assignments, and the agenda.', {
  actions: [{ label: 'Open agenda builder', nav: 'events', resource: 'sessions' }],
});

resource(page, 'speakers', 'Speakers', [
  field('name', 'Speaker name'), field('bio', 'Biography', 'textarea'), optional('photo', 'Headshot', 'media'),
  optional('organization', 'Organization'), optional('website', 'Website', 'url'),
], {
  rows: [{ id: 'ada', name: 'Ada James', bio: 'Demo artist and host of the live showcase.', photo: '', organization: 'Daybreak Studio', website: '' }],
  actions: [{ label: 'Assign to a session', create: 'sessions', prefill: row => ({ speaker: row.id }) }],
});

resource(page, 'sponsorPackages', 'Sponsor packages', [
  field('title', 'Package name'), status(['Headline', 'Gold', 'Silver', 'Community'], 'tier', 'Tier'),
  amount('price', 'Package price'), status(currencies, 'currency', 'Currency'), field('benefits', 'Package benefits', 'textarea'),
], { rows: [{ id: 'gold', title: 'Gold partner', tier: 'Gold', price: 150000, currency: 'NGN', benefits: 'Stage signage and event page placement.' }] });

resource(page, 'sponsors', 'Sponsors', [
  field('title', 'Sponsor name'), ref('event', 'Event', 'events'), ref('package', 'Package', 'sponsorPackages'),
  optional('logo', 'Sponsor logo', 'media'), field('placement', 'Placement'), status(['Proposed', 'Confirmed', 'Fulfilled']),
], { rows: [{ id: 'sponsor-1', title: 'Palm House', event: 'sunset', package: 'gold', logo: '', placement: 'Stage signage', status: 'Confirmed' }] });

resource(page, 'vendors', 'Vendors & exhibitors', [
  field('title', 'Business name'), ref('event', 'Event', 'events'),
  status(['Exhibitor', 'Food vendor', 'Service vendor'], 'kind', 'Vendor type'),
  optional('booth', 'Booth assignment'), optional('notes', 'Requirements', 'textarea'),
  status(['Applied', 'Approved', 'Checked in']),
], {
  rows: [{ id: 'vendor-1', title: 'Marina Kitchen', event: 'sunset', kind: 'Food vendor', booth: 'A-03', notes: 'Power outlet requested.', status: 'Approved' }],
  validate(row, state) {
    if (row.booth && rowsOf(state, 'vendors').some(item => item.id !== row.id && item.event === row.event && item.booth.toLowerCase() === row.booth.toLowerCase())) throw Error('This booth is already assigned for the event.');
  },
});
