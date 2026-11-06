import { field, optional, ref, resource, section, status } from './catalog.mjs';
import { chargebackLoss } from './finance.mjs';
import { find, revise, rowsOf, saveRecord, titleOf } from './store.mjs';

const page = section('analytics', 'Analytics & reporting', '▥', 'Compare sales, attendance, audiences, and organizers. Build and export a filtered report.', {
  actions: [{ label: 'Historical insights', command: 'historical' }, { label: 'Run due report emails', command: 'run-due-reports' }],
  view({ state, panel, table, escape, bars }) {
    const report = buildReport(state, { dimension: 'Event' });
    const sources = groupCount(rowsOf(state, 'traffic'), 'source');
    const visits = rowsOf(state, 'traffic').reduce((total, row) => total + row.views, 0);
    const started = rowsOf(state, 'traffic').reduce((total, row) => total + row.checkouts, 0);
    const converted = rowsOf(state, 'traffic').reduce((total, row) => total + row.orders, 0);
    const demographics = rowsOf(state, 'demographics');
    return panel('Sales & attendance by event', table(report.headers, report.rows.map(row => row.map(escape)))) +
      `<div class="admin-grid">
        ${panel('Traffic sources', bars(sources))}
        ${panel('Conversion funnel', bars([['Event page views', visits], ['Checkout starts', started], ['Completed orders', converted]]) +
          `<p class="muted">${started ? (converted / started * 100).toFixed(1) + '% of checkouts complete' : 'No recorded checkouts'}</p>`)}
        ${panel('Audience demographics', table(['Group', 'Attendees'], demographics.map(row =>
          [escape(row.title), row.count < 5 ? 'Suppressed' : escape(row.count)])) + '<p class="muted">Synthetic aggregate counts. Groups below five are suppressed.</p>')}
        ${panel('Organizer comparison', table(['Organizer', 'Events', 'Bookings', 'Tickets', 'Check-ins', 'Attendance', 'Net collected'],
          buildReport(state, { dimension: 'Organizer' }).rows.map(row => row.map(escape))))}
      </div>`;
  },
});

function groupCount(rows, key) {
  const totals = new Map();
  for (const row of rows) totals.set(row[key], (totals.get(row[key]) || 0) + row.views);
  return [...totals].sort((a, b) => b[1] - a[1]);
}

resource(page, 'traffic', 'Traffic sources', [
  ref('event', 'Event', 'events'), field('source', 'Channel'),
  field('views', 'Page views', 'number', { integer: true }),
  field('checkouts', 'Checkout starts', 'number', { integer: true }),
  field('orders', 'Completed orders', 'number', { integer: true }),
], {
  rows: [
    { id: 'traffic-1', event: 'sunset', source: 'Social', views: 1350, checkouts: 182, orders: 110 },
    { id: 'traffic-2', event: 'sunset', source: 'Search', views: 830, checkouts: 103, orders: 68 },
    { id: 'traffic-3', event: 'open', source: 'Direct', views: 480, checkouts: 68, orders: 47 },
  ],
  validate(row) {
    if (row.checkouts > row.views || row.orders > row.checkouts) throw Error('Funnel counts must decrease from views to checkouts to orders.');
  },
});

resource(page, 'demographics', 'Aggregate demographics', [
  field('title', 'Group'), field('count', 'Synthetic attendee count', 'number', { integer: true }),
], {
  readOnly: true, hidden: true,
  rows: [
    { id: 'd-1', title: 'Woman', count: 92 },
    { id: 'd-2', title: 'Man', count: 78 },
    { id: 'd-3', title: 'Nonbinary', count: 11 },
    { id: 'd-4', title: 'Self-described', count: 4 },
  ],
});

resource(page, 'savedReports', 'Report builder', [
  field('title', 'Report name'), status(['Event', 'Organizer', 'Category', 'Month'], 'dimension', 'Group by'),
  ref('event', 'Filter by event', 'events', true), optional('from', 'Event start from', 'date'), optional('to', 'Event start through', 'date'),
  status(['On demand', 'Weekly', 'Monthly'], 'cadence', 'Email schedule'),
  optional('recipient', 'Demo report email', 'email'), optional('nextRun', 'Next scheduled date', 'date'),
], {
  defaults: { dimension: 'Event', cadence: 'On demand' },
  rows: [{ id: 'report-1', title: 'Monthly event performance', dimension: 'Month', event: '', from: '', to: '', cadence: 'Monthly', recipient: 'reports@example.test', nextRun: '2026-11-06' }],
  validate(row) {
    if (row.from && row.to && row.from > row.to) throw Error('The end date must follow the start date.');
    if (row.cadence !== 'On demand' && (!row.recipient || !row.nextRun)) throw Error('Enter a demo recipient and next run date for scheduled reports.');
  },
  actions: [
    { label: 'Run and export report', command: 'report' },
    { label: 'Simulate scheduled email', command: 'report-send', when: row => row.cadence !== 'On demand' },
  ],
});

export function buildReport(state, options) {
  const events = rowsOf(state, 'events').filter(event => (!options.event || event.id === options.event) &&
    (!options.from || event.start.slice(0, 10) >= options.from) && (!options.to || event.start.slice(0, 10) <= options.to));
  const groups = new Map();
  for (const event of events) {
    const group = options.dimension === 'Organizer' ? titleOf(find(state, 'users', event.organizer))
      : options.dimension === 'Category' ? titleOf(find(state, 'categories', event.category))
      : options.dimension === 'Month' ? event.start.slice(0, 7) : event.title + ' · ' + event.start.slice(0, 10);
    const entry = groups.get(group) || { events: 0, bookings: 0, tickets: 0, checkins: 0, revenue: new Map() };
    entry.events++;
    const registrations = rowsOf(state, 'registrations').filter(item => item.event === event.id && item.status === 'Confirmed');
    entry.bookings += registrations.length;
    entry.tickets += registrations.reduce((sum, row) => sum + row.quantity, 0);
    const ids = new Set(registrations.map(row => row.id));
    entry.checkins += rowsOf(state, 'checkins').filter(row => ids.has(row.registration)).length;
    const allIds = new Set(rowsOf(state, 'registrations').filter(item => item.event === event.id).map(row => row.id));
    for (const tx of rowsOf(state, 'transactions').filter(row => allIds.has(row.registration) && ['Paid', 'Partially refunded', 'Refunded'].includes(row.status))) {
      entry.revenue.set(tx.currency, (entry.revenue.get(tx.currency) || 0) + tx.amount - tx.refunded - chargebackLoss(state, tx.id));
    }
    groups.set(group, entry);
  }
  return {
    headers: [options.dimension || 'Group', 'Events', 'Registrations', 'Tickets sold', 'Check-ins', 'Check-in rate', 'Net collected by currency'],
    rows: [...groups].map(([label, entry]) => [
      label, entry.events, entry.bookings, entry.tickets, entry.checkins,
      entry.tickets ? (entry.checkins / entry.tickets * 100).toFixed(1) + '%' : '—',
      [...entry.revenue].map(([currency, amount]) => currency + ' ' + amount.toFixed(2)).join(' / ') || '—',
    ]),
  };
}

export function deliverReport(state, row, sentAt) {
  const report = buildReport(state, row);
  saveRecord(state, 'delivery', { title: row.title + ' · ' + report.rows.length + ' report rows',
    audience: 'Demo report · ' + row.recipient, event: '', channel: 'Email', date: sentAt, status: 'Simulated sent', count: 1 });
  const next = new Date(row.nextRun + 'T00:00:00Z');
  if (row.cadence === 'Weekly') next.setUTCDate(next.getUTCDate() + 7);
  else {
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const end = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, end));
  }
  revise(state, 'savedReports', row.id, { nextRun: next.toISOString().slice(0, 10) });
}
