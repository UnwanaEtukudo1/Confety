import { months } from './admin-data.mjs';

export const number = value => new Intl.NumberFormat('en-NG').format(value);
export const money = value => '₦' + number(Math.round(value));
export const ratio = (value, base) => base ? value / base : null;
export const percent = value => value == null ? '—' : (value * 100).toFixed(1) + '%';
export const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
export const sum = (rows, value) => rows.reduce((total, row) => total + value(row), 0);
export const distinct = (rows, value) => new Set(rows.map(value).filter(item => item != null)).size;
export const wat = value => new Date(Date.parse(value) + 3_600_000);
export const elapsedHours = (from, to) => (Date.parse(to) - Date.parse(from)) / 3_600_000;
export const eventYear = event => wat(event.start).getUTCFullYear();
export const eventMonth = event => wat(event.start).getUTCMonth();

export function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const label = key(row);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return counts;
}

export function selectCohort(data, filters, year = filters.year, monthCount = filters.monthCount) {
  const events = data.events.filter(event =>
    eventYear(event) === year && eventMonth(event) < monthCount &&
    (!filters.city || event.city === filters.city) &&
    (!filters.category || event.category === filters.category) &&
    (!filters.event || event.id === filters.event)
  );
  const ids = new Set(events.map(event => event.id));
  return Object.fromEntries([
    ['events', events],
    ...['orders', 'tickets', 'customerSurveys', 'organizerSurveys', 'supportCases']
      .map(key => [key, data[key].filter(row => ids.has(row.eventId))]),
  ]);
}

export function summarize(cohort) {
  const { orders, tickets, events } = cohort;
  const refunds = tickets.filter(ticket => ticket.refund);
  const listed = tickets.filter(ticket => ticket.resale);
  const resold = listed.filter(ticket => ticket.resale.buyerId);
  const attended = tickets.filter(ticket => ticket.checkIn);
  const gross = sum(tickets, ticket => ticket.gross);
  const fees = sum(tickets, ticket => ticket.fee);
  const refundValue = sum(refunds, ticket => ticket.refund.amount);
  const netFees = fees - sum(refunds, ticket => ticket.fee);
  const netSales = gross - sum(refunds, ticket => ticket.gross);
  return {
    gross, fees, refundValue, netFees, netSales,
    netPaid: netSales + netFees,
    refunds, listed, resold, attended,
    buyers: distinct(orders, order => order.buyerId),
    attendees: distinct(attended, ticket => ticket.attendeeId),
    checkIns: attended.length,
    attendanceRate: ratio(attended.length, tickets.length - refunds.length),
    views: sum(events, event => sum(Object.values(event.channelViews), value => value)),
    starts: orders.length + sum(events, event => event.abandonedCheckouts + event.failedPayments),
    failures: sum(events, event => event.failedPayments),
  };
}

export function monthly(cohort) {
  const eventLookup = new Map(cohort.events.map(event => [event.id, eventMonth(event)]));
  const totals = months.map(month => ({ month, events: 0, tickets: 0, checkIns: 0 }));
  for (const event of cohort.events) totals[eventMonth(event)].events++;
  for (const ticket of cohort.tickets) {
    const row = totals[eventLookup.get(ticket.eventId)];
    row.tickets++;
    if (ticket.checkIn) row.checkIns++;
  }
  return totals;
}

export function yoy(current, previous) {
  if (!previous) return '—';
  const value = (current - previous) / previous * 100;
  return (value > 0 ? '+' : '') + value.toFixed(1) + '%';
}

export function genderGroups(attended, customers) {
  const ids = new Set(attended.map(ticket => ticket.attendeeId));
  const counts = countBy(customers.filter(customer => ids.has(customer.id)), customer => customer.gender);
  const small = [...counts.values()].some(count => count < 5);
  return { total: ids.size, counts: small ? new Map() : counts, suppressed: small };
}
