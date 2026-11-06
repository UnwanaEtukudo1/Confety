import { section } from './catalog.mjs';
import { DEMO_DAY, rowsOf, titleOf } from './store.mjs';

section('dashboard', 'Dashboard', '◈', 'Monitor event operations and take action from one place.', {
  view({ state, panel, kpis, table, money, escape, readAccess }) {
    const events = rowsOf(state, 'events');
    const bookings = rowsOf(state, 'registrations').filter(row => row.status === 'Confirmed');
    const transactions = rowsOf(state, 'transactions');
    const active = events.filter(row => ['Published', 'Ongoing'].includes(row.status));
    const totals = new Map();
    for (const row of transactions.filter(row => ['Paid', 'Partially refunded'].includes(row.status))) {
      const lost = rowsOf(state, 'chargebacks').filter(dispute => dispute.transaction === row.id && dispute.status === 'Lost')
        .reduce((total, dispute) => total + dispute.amount, 0);
      totals.set(row.currency, (totals.get(row.currency) || 0) + row.amount - (row.refunded || 0) - lost);
    }
    const upcoming = events.filter(row => row.start >= DEMO_DAY && ['Published', 'Ongoing'].includes(row.status))
      .sort((a, b) => a.start.localeCompare(b.start)).slice(0, 5);
    const pending = [
      ['Event approvals', events.filter(row => row.status === 'Pending approval').length, 'events', 'events', 'Pending approval'],
      ['Refund requests', rowsOf(state, 'refunds').filter(row => row.status === 'Pending').length, 'finance', 'refunds', 'Pending'],
      ['Flagged content', rowsOf(state, 'reports').filter(row => row.status === 'Open').length, 'content', 'reports', 'Open'],
    ];
    return kpis([
      ['Total events', events.length, 'Across all event statuses'],
      ['Active events', active.length, 'Published or ongoing'],
      ['Tickets sold', bookings.reduce((sum, row) => sum + row.quantity, 0), 'Confirmed registrations'],
      ['Net revenue', [...totals].map(([currency, total]) => money(total, currency)).join(' · ') || '—', 'Paid less refunds and chargebacks'],
      ['New registrations', bookings.filter(row => row.bookedAt.slice(0, 10) >= '2026-11-01').length, 'Since 1 November 2026 in the demo'],
    ]) + `<div class="admin-grid">
      ${panel('Upcoming events', table(['Event', 'Start', 'Status'], upcoming.map(row => [
        `<button class="inline-link" data-record="events:${escape(row.id)}">${escape(titleOf(row))}</button>`,
        escape(row.start.replace('T', ' ')), escape(row.status),
      ])))}
      ${panel('Needs attention', `<div class="action-list">${pending.filter(([, , page]) => readAccess(page)).map(([label, value, page, resource, status]) =>
        `<button data-nav="${page}" data-resource="${resource}" data-filter-status="${status}"><span>${label}</span><b>${value} ↗</b></button>`).join('')}</div>`)}
      ${panel('Recent activity', `<div class="activity-list">${(readAccess('roles') ? state.audit.slice(0, 6) : []).map(row =>
        `<div><strong>${escape(row.action)}</strong><p>${escape(row.target)} · ${escape(row.actor)}</p><small>${escape(row.at.slice(0, 16).replace('T', ' '))} UTC</small></div>`).join('') || '<p class="muted">Audit activity requires audit log access.</p>'}</div>`)}
      ${panel('Quick actions', '<div class="action-list"><button data-create="events">Create an event <b>↗</b></button><button data-create="users">Add a user <b>↗</b></button><button data-nav="analytics">View reports <b>↗</b></button></div>')}
    </div>`;
  },
});
