import { createDemoData, months, cities, categories } from './admin-data.mjs';
import {
  number, money, ratio, percent, average, sum, distinct, wat, elapsedHours,
  countBy, selectCohort, summarize, monthly, yoy, genderGroups,
} from './admin-metrics.mjs';

const data = createDemoData();
const eventIndex = new Map(data.events.map(event => [event.id, event]));
const orderIndex = new Map(data.orders.map(order => [order.id, order]));
const purchaseHistory = [...data.orders].sort((a, b) => a.boughtAt.localeCompare(b.boughtAt) || a.id - b.id);
const firstPurchase = new Map();
const previousHost = new Map();
for (const order of purchaseHistory) {
  if (!firstPurchase.has(order.buyerId)) firstPurchase.set(order.buyerId, order.id);
}
for (const event of [...data.events].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id - b.id)) {
  if (!previousHost.has(event.organizerId)) previousHost.set(event.organizerId, event.id);
}

const $ = selector => document.querySelector(selector);
const filterYear = $('#filter-year');
const filterMonths = $('#filter-months');
const filterCity = $('#filter-city');
const filterCategory = $('#filter-category');
for (const city of cities) filterCity.add(new Option(city, city));
for (const category of categories) filterCategory.add(new Option(category.name, category.name));

const titles = {
  overview: ['Overview', 'See how events are performing and where customers need a better experience.'],
  events: ['Event demand', 'Compare what organizers host with what customers buy and attend.'],
  timing: ['Purchase timing', 'Find the hours, days, and months when customers book.'],
  customers: ['Customers', 'Understand spending, repeat purchases, refunds, resale, and feedback.'],
  organizers: ['Organizers', 'See where organizers are based, what they publish, and where they need support.'],
  event: ['Event detail', 'Review one event from ticket purchase through check-in and feedback.'],
};
let report = Object.hasOwn(titles, location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
let selectedEvent = null;
let dimension = 'category';
let trendMetric = 'tickets';

function filters() {
  const year = Number(filterYear.value);
  return {
    year, monthCount: Math.min(Number(filterMonths.value), year === 2026 ? 10 : 12),
    city: filterCity.value, category: filterCategory.value,
  };
}

function panel(title, description, body, extra = '') {
  return `<section class="admin-panel ${extra}"><h2>${title}</h2><p class="panel-description">${description}</p>${body}</section>`;
}

function kpis(items) {
  return `<div class="admin-kpis">${items.map(([label, value, note]) => `
    <article class="admin-kpi"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>
  `).join('')}</div>`;
}

function table(label, headings, rows) {
  if (!rows.length) return '<p class="admin-empty">No records for these filters.</p>';
  return `<div class="admin-table-wrap" role="region" aria-label="${label}" tabindex="0">
    <table aria-label="${label}"><thead><tr>${headings.map(heading => `<th scope="col">${heading}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr><th scope="row">${row[0]}</th>${row.slice(1).map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>
    </div>`;
}

function bars(entries, format = number) {
  if (!entries.some(([, value]) => value > 0)) return '<p class="admin-empty">No records for these filters.</p>';
  const max = Math.max(...entries.map(([, value]) => value), 1);
  return `<ul class="admin-bars">${entries.map(([label, value]) => `<li>
    <span>${label}</span><i aria-hidden="true"><b style="--bar:${value / max * 100}%"></b></i>
    <strong>${format(value)}</strong></li>`).join('')}</ul>`;
}

function orderedCounts(rows, key) {
  return [...countBy(rows, key)].sort((a, b) => b[1] - a[1]);
}

function survey(cohort, role) {
  const responses = role === 'customer' ? cohort.customerSurveys : cohort.organizerSurveys;
  const invitations = role === 'customer'
    ? distinct(cohort.orders, order => order.eventId + ':' + order.buyerId)
    : cohort.events.length;
  const score = average(responses.map(row => row.score));
  return { responses, invitations, score, rate: ratio(responses.length, invitations) };
}

function scoreLabel(result) {
  return result.score == null ? '—' : result.score.toFixed(2) + ' / 5';
}

function periodChart(current, prior, settings, metric) {
  const currentMonths = monthly(current).slice(0, settings.monthCount);
  const priorMonths = monthly(prior).slice(0, settings.monthCount);
  const max = Math.max(...currentMonths.map(row => row[metric]), ...priorMonths.map(row => row[metric]), 1);
  const priorAvailable = settings.year > 2024;
  return `<div class="chart-legend"><span><i></i>${settings.year}</span>${priorAvailable ? `<span><i></i>${settings.year - 1}</span>` : ''}</div>
    <div class="month-chart-wrap"><div class="month-chart">${currentMonths.map((row, index) => {
      const prev = priorMonths[index][metric];
      return `<div class="month-column" title="${row.month} · ${settings.year} ${number(row[metric])}${priorAvailable ? ` · ${settings.year - 1} ${number(prev)}` : ''}">
        <div class="month-pair"><span style="--bar:${row[metric] / max * 100}%"></span>${priorAvailable ? `<span style="--bar:${prev / max * 100}%"></span>` : ''}</div><small>${row.month}</small>
      </div>`;
    }).join('')}</div></div>
    <details class="chart-values"><summary>View monthly values</summary>${table('Monthly comparison', ['Event month', settings.year, ...(priorAvailable ? [settings.year - 1] : [])], currentMonths.map((row, i) =>
      [row.month, number(row[metric]), ...(priorAvailable ? [number(priorMonths[i][metric])] : [])]))}</details>`;
}

function funnel(cohort, stats) {
  return panel('From discovery to purchase', 'Recorded views and checkout attempts for the selected events.', `
    ${bars([['Event page views', stats.views], ['Checkout starts', stats.starts], ['Completed orders', cohort.orders.length]])}
    <div class="admin-inline-stats"><span><strong>${percent(ratio(cohort.orders.length, stats.starts))}</strong> checkout completion</span>
    <span><strong>${number(stats.failures)}</strong> payment failures · ${percent(ratio(stats.failures, stats.starts))} of starts</span></div>
    <details class="chart-values"><summary>View acquisition channels</summary>
      ${table('Discovery by channel', ['Channel', 'Event views', 'Orders'], ['Social media', 'Direct', 'Search', 'Organizer referral', 'Email'].map(channel => [
        channel, number(sum(cohort.events, event => event.channelViews[channel])),
        number(cohort.orders.filter(order => order.channel === channel).length),
      ]))}</details>`);
}

function overview(current, previous, settings) {
  const now = summarize(current);
  const prior = summarize(previous);
  const topCity = orderedCounts(current.events, event => event.city)[0];
  const customer = survey(current, 'customer');
  const organizer = survey(current, 'organizer');
  return kpis([
    ['Events hosted', number(current.events.length), `${yoy(current.events.length, previous.events.length)} year over year`],
    ['Primary tickets sold', number(current.tickets.length), `${number(now.buyers)} unique buyers`],
    ['Checked-in attendees', number(now.attendees), `${number(now.checkIns)} check-ins · ${percent(now.attendanceRate)} of eligible tickets`],
    ['Net ticket sales', money(now.netSales), `${yoy(now.netSales, prior.netSales)} year over year · excludes fees`],
  ]) + `<div class="admin-grid admin-overview-grid">
    ${panel('Ticket demand over time', 'Primary tickets sold, grouped by event month.', periodChart(current, previous, settings, 'tickets'), 'panel-wide')}
    ${panel('Service pulse', 'Survey scores for the selected events.', `
      <dl class="admin-pulse">
        <div><dt>Customer satisfaction</dt><dd>${scoreLabel(customer)}<small>${number(customer.responses.length)} responses · ${percent(customer.rate)} response rate</small></dd></div>
        <div><dt>Organizer satisfaction</dt><dd>${scoreLabel(organizer)}<small>${number(organizer.responses.length)} responses · ${percent(organizer.rate)} response rate</small></dd></div>
        <div><dt>Most active host city</dt><dd>${topCity ? topCity[0] : '—'}<small>${topCity ? number(topCity[1]) + ' hosted events' : 'No events for these filters'}</small></dd></div>
      </dl>`)}
  </div><div class="admin-grid">
    ${funnel(current, now)}
    ${panel('Event activity by city', 'Event location, regardless of the organizer’s home city.', bars(orderedCounts(current.events, event => event.city)))}
  </div>`;
}

function demand(current, previous, settings) {
  const dimensions = { category: 'Category', genre: 'Genre', kind: 'Kind' };
  const groups = [...new Set([...current.events, ...previous.events].map(event => event[dimension]))].sort();
  const rows = groups.map(group => {
    const events = current.events.filter(event => event[dimension] === group);
    const lastEvents = previous.events.filter(event => event[dimension] === group);
    const tickets = current.tickets.filter(ticket => eventIndex.get(ticket.eventId)[dimension] === group);
    const lastTickets = previous.tickets.filter(ticket => eventIndex.get(ticket.eventId)[dimension] === group);
    const visits = tickets.filter(ticket => ticket.checkIn);
    return [group, number(events.length), yoy(events.length, lastEvents.length), number(tickets.length),
      yoy(tickets.length, lastTickets.length), number(visits.length), number(distinct(visits, ticket => ticket.attendeeId))];
  });
  const seasonA = monthly(selectCohort(data, settings, 2024, 12));
  const seasonB = monthly(selectCohort(data, settings, 2025, 12));
  const seasonalRows = months.map((month, i) => ({
    month, events: (seasonA[i].events + seasonB[i].events) / 2,
    visits: (seasonA[i].checkIns + seasonB[i].checkIns) / 2,
  }));
  const peak = seasonalRows.reduce((best, row) => row.events > best.events ? row : best);
  const peakLabel = peak.events ? `Highest monthly average: ${peak.month} (${number(peak.events)} events).` : '';
  return panel('What people host and attend', 'Compare event supply, ticket demand, and check-ins by category, genre, or kind.', `
    <label class="admin-control">Group by<select id="event-dimension">
      ${Object.entries(dimensions).map(([id, label]) => `<option value="${id}" ${id === dimension ? 'selected' : ''}>${label}</option>`).join('')}
    </select></label>
    ${table('Event demand by ' + dimension, [dimensions[dimension], 'Events hosted', 'Event YoY', 'Tickets sold', 'Ticket YoY', 'Check-ins', 'Unique attendees'], rows)}
  `) + `<div class="admin-grid">
    ${panel('Year-over-year activity', 'Same event months, city, and category in each year.', `
      <label class="admin-control">Measure<select id="trend-metric">${[['tickets','Tickets sold'],['events','Events hosted'],['checkIns','Check-ins']].map(([id,label]) =>
        `<option value="${id}" ${id === trendMetric ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      ${periodChart(current, previous, settings, trendMetric)}`)}
    ${panel('Seasonality across complete years', 'Monthly averages across 2024 and 2025. City and category filters apply.', `
      ${bars(seasonalRows.map(row => [row.month, row.events]))}
      <p class="admin-scope">${peakLabel}</p>
      <details class="chart-values"><summary>Compare hosted events and check-ins</summary>
        ${table('Historical monthly averages', ['Month', 'Avg. events hosted', 'Avg. check-ins'], seasonalRows.map(row =>
          [row.month, number(row.events), number(row.visits)]))}</details>`)}
  </div>`;
}

function bookingPatterns(cohort) {
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const byHour = countBy(cohort.orders, order => wat(order.boughtAt).getUTCHours());
  const byDay = countBy(cohort.orders, order => (wat(order.boughtAt).getUTCDay() + 6) % 7);
  const byWeek = countBy(cohort.orders, order => Math.floor((wat(order.boughtAt).getUTCDate() - 1) / 7));
  const byMonth = countBy(cohort.orders, order => wat(order.boughtAt).getUTCMonth());
  const lead = cohort.orders.map(order => elapsedHours(order.boughtAt, eventIndex.get(order.eventId).start) / 24);
  const topHour = [...byHour].sort((a, b) => b[1] - a[1])[0];
  const hourLabel = hour => String(hour).padStart(2, '0') + ':00';
  const leadAverage = average(lead);
  return kpis([
    ['Completed orders', number(cohort.orders.length), 'Primary purchases only'],
    ['Average booking lead time', leadAverage == null ? '—' : leadAverage.toFixed(1) + ' days', 'From purchase to event start'],
    ['Busiest booking hour', topHour ? hourLabel(topHour[0]) : '—', topHour ? `${number(topHour[1])} orders in that hour · WAT` : 'No orders for these filters'],
  ]) + `<div class="admin-grid">
    ${panel('Hour of day', 'Purchase timestamps in West Africa Time.', `<div class="hour-bars">${bars(Array.from({ length: 24 }, (_, hour) => [hourLabel(hour), byHour.get(hour) || 0]))}</div>`)}
    <div class="admin-stack">
      ${panel('Day of week', 'Completed orders by local weekday.', bars(weekdays.map((day, i) => [day, byDay.get(i) || 0])))}
      ${panel('Week of month', 'Groups by calendar dates within the month.', bars(['1–7', '8–14', '15–21', '22–28', '29–31'].map((week, i) => [week, byWeek.get(i) || 0])))}
    </div>
    ${panel('Month of purchase', 'Bookings grouped by purchase month, across the selected event cohort.', bars(months.map((month, i) => [month, byMonth.get(i) || 0])))}
    ${panel('How early customers buy', 'Days between purchase and event start.', bars([
      ['Under 3 days', lead.filter(days => days < 3).length],
      ['3–7 days', lead.filter(days => days >= 3 && days < 8).length],
      ['8–14 days', lead.filter(days => days >= 8 && days < 15).length],
      ['15 days or more', lead.filter(days => days >= 15).length],
    ]))}
  </div>`;
}

function feedback(cohort, role) {
  const result = survey(cohort, role);
  const name = role === 'customer' ? 'Customer' : 'Organizer';
  return panel(name + ' satisfaction', 'Average rating from completed surveys, with the share of invitees who responded.', `
    <div class="admin-rating"><strong>${scoreLabel(result)}</strong><span>${number(result.responses.length)} of ${number(result.invitations)} invitations · ${percent(result.rate)} responded</span></div>
    <h3>Feedback themes</h3>
    ${bars(orderedCounts(result.responses, row => row.theme))}
  `);
}

function refundResale(stats) {
  const people = tickets => distinct(tickets, ticket => orderIndex.get(ticket.orderId).buyerId);
  return `<div class="admin-grid">
    ${panel('Refunds', 'Refunded tickets and distinct primary purchasers who received a refund.', `
      <div class="admin-inline-stats"><span><strong>${number(stats.refunds.length)}</strong> refunded tickets</span>
      <span><strong>${number(people(stats.refunds))}</strong> buyers refunded</span><span><strong>${money(stats.refundValue)}</strong> refunded including fees</span></div>
      <h3>Refund reasons</h3>${bars(orderedCounts(stats.refunds, ticket => ticket.refund.reason))}`)}
    ${panel('Resale', 'Listing reasons include completed and unsold listings. Resale value is reported separately.', `
      <div class="admin-inline-stats"><span><strong>${number(stats.listed.length)}</strong> listed</span>
      <span><strong>${number(stats.resold.length)}</strong> resold</span><span><strong>${number(people(stats.resold))}</strong> unique sellers</span>
      <span><strong>${money(sum(stats.resold, ticket => ticket.resale.price))}</strong> resale value</span></div>
      <h3>Reasons for listing</h3>${bars(orderedCounts(stats.listed, ticket => ticket.resale.reason))}`)}
  </div>`;
}

function paymentSummary(cohort, stats) {
  const paymentTotals = new Map();
  const tierTotals = new Map();
  const spendByBuyer = new Map();
  const discountedOrders = cohort.orders.filter(order => order.discounted).length;
  const firstTime = cohort.orders.filter(order => firstPurchase.get(order.buyerId) === order.id).length;
  let sameOrganizer = 0;
  let newCategory = 0;
  const previousOrder = new Map();
  const matchingOrders = new Set(cohort.orders.map(order => order.id));

  for (const order of purchaseHistory) {
    const previous = previousOrder.get(order.buyerId);
    if (previous && matchingOrders.has(order.id)) {
      if (eventIndex.get(previous.eventId).organizerId === eventIndex.get(order.eventId).organizerId) sameOrganizer++;
      if (eventIndex.get(previous.eventId).category !== eventIndex.get(order.eventId).category) newCategory++;
    }
    previousOrder.set(order.buyerId, order);
  }

  for (const ticket of cohort.tickets) {
    const order = orderIndex.get(ticket.orderId);
    const paid = ticket.gross + ticket.fee - (ticket.refund?.amount || 0);
    spendByBuyer.set(order.buyerId, (spendByBuyer.get(order.buyerId) || 0) + paid);
    paymentTotals.set(order.paymentMethod, (paymentTotals.get(order.paymentMethod) || 0) + paid);
    const tier = tierTotals.get(ticket.tier) || { count: 0, paid: 0 };
    tier.count++;
    tier.paid += paid;
    tierTotals.set(ticket.tier, tier);
  }

  const averageOrder = ratio(stats.netPaid, cohort.orders.length);
  const averageBuyer = ratio(stats.netPaid, stats.buyers);
  const repeats = cohort.orders.length - firstTime;
  return kpis([
    ['Net customer spend', money(stats.netPaid), 'After refunds · includes retained fees'],
    ['Average net order value', averageOrder == null ? '—' : money(averageOrder), 'Per completed primary order'],
    ['Average spend per buyer', averageBuyer == null ? '—' : money(averageBuyer), `${number(stats.buyers)} distinct primary buyers`],
    ['Repeat purchase share', percent(ratio(repeats, cohort.orders.length)), `${number(firstTime)} first-time orders · ${number(repeats)} repeat orders`],
  ]) + `<div class="admin-grid">
    ${panel('Sales and fees', 'Primary transactions only, in demo naira.', table('Primary sales reconciliation', ['Measure', 'Amount'], [
      ['Gross ticket sales after discounts', money(stats.gross)], ['Fees collected', money(stats.fees)],
      ['Refunds including fees', money(stats.refundValue)], ['Net ticket sales', money(stats.netSales)],
      ['Retained fees', money(stats.netFees)], ['Net customer spend', money(stats.netPaid)],
    ]))}
    ${panel('How customers pay', 'Net customer spend by payment method.', bars([...paymentTotals].sort((a, b) => b[1] - a[1]), money))}
    ${panel('Spend per buyer', 'Distinct primary buyers grouped by their total net spend across selected events.', bars([
      ['Under ₦15,000', [...spendByBuyer.values()].filter(value => value < 15000).length],
      ['₦15,000–₦29,999', [...spendByBuyer.values()].filter(value => value >= 15000 && value < 30000).length],
      ['₦30,000–₦59,999', [...spendByBuyer.values()].filter(value => value >= 30000 && value < 60000).length],
      ['₦60,000 and over', [...spendByBuyer.values()].filter(value => value >= 60000).length],
    ]))}
    ${panel('Ticket tiers', 'Issued tickets by tier, with spend after refunds and including retained fees.', table('Primary tickets by tier', ['Tier', 'Tickets sold', 'Net spend'],
      [...tierTotals].map(([tier, values]) => [tier, number(values.count), money(values.paid)])))}
    ${panel('What brings buyers back', 'Repeat orders compared with each buyer’s preceding order across the demo dataset.', `
      <dl class="admin-pulse">
        <div><dt>Same organizer</dt><dd>${percent(ratio(sameOrganizer, repeats))}<small>${number(sameOrganizer)} repeat orders</small></dd></div>
        <div><dt>Different event category</dt><dd>${percent(ratio(newCategory, repeats))}<small>${number(newCategory)} repeat orders</small></dd></div>
        <div><dt>Discount use</dt><dd>${percent(ratio(discountedOrders, cohort.orders.length))}<small>${number(discountedOrders)} orders used a discount</small></dd></div>
      </dl>`)}
  </div>`;
}

function genderReport(stats) {
  const groups = genderGroups(stats.attended, data.customers);
  return panel('Attendee gender', 'Required field in the synthetic profiles. Counts are grouped across distinct attendees in this report.', groups.suppressed
    ? '<p class="admin-empty">This breakdown is hidden because a represented group has fewer than five attendees.</p>'
    : bars([...groups.counts].map(([label, count]) => [label, count]), count => `${number(count)} · ${percent(ratio(count, groups.total))}`));
}

function supportReport(cohort, role) {
  const rows = cohort.supportCases.filter(row => row.role === role);
  const issues = [...countBy(rows, row => row.theme)].map(([issue, count]) => {
    const resolved = rows.filter(row => row.theme === issue && row.resolutionHours != null);
    const hours = average(resolved.map(row => row.resolutionHours));
    return { issue, count, open: count - resolved.length, hours };
  }).sort((a, b) => (b.hours ?? -1) - (a.hours ?? -1));
  return panel(role + ' support issues', 'Sorted by average resolution time for closed cases. Open cases are counted separately.', table(
    role + ' support issues', ['Issue', 'Cases', 'Open', 'Avg. resolution'],
    issues.map(row => [row.issue, number(row.count), number(row.open), row.hours == null ? '—' : row.hours.toFixed(1) + ' h'])
  ));
}

function customers(cohort) {
  const stats = summarize(cohort);
  return paymentSummary(cohort, stats) + refundResale(stats) + `<div class="admin-grid">
    ${feedback(cohort, 'customer')}${genderReport(stats)}${supportReport(cohort, 'Customer')}
  </div>`;
}

function organizers(cohort) {
  const active = data.organizers.filter(organizer => cohort.events.some(event => event.organizerId === organizer.id));
  const publishHours = average(cohort.events.map(event => elapsedHours(event.createdAt, event.publishedAt)));
  const returning = cohort.events.filter(event => previousHost.get(event.organizerId) !== event.id);
  const returningOrganizers = distinct(returning, event => event.organizerId);
  const costs = cohort.events.flatMap(event => event.costs);
  const totalCosts = sum(costs, cost => cost.amount);
  const costBy = key => [...new Set(costs.map(cost => cost[key]))].map(label =>
    [label, sum(costs.filter(cost => cost[key] === label), cost => cost.amount)]
  ).sort((a, b) => b[1] - a[1]);
  return kpis([
    ['Active organizers', number(active.length), 'Hosted at least one selected event'],
    ['Average time to publish', publishHours == null ? '—' : publishHours.toFixed(1) + ' h', 'From event draft creation to publishing'],
    ['Returning organizers', number(returningOrganizers), `${number(returning.length)} events after their first publication`],
    ['Organizer spending', money(totalCosts), cohort.events.length ? money(totalCosts / cohort.events.length) + ' per event on average' : 'No events for these filters'],
  ]) + `<div class="admin-grid">
    ${panel('Where organizers are based', 'Home cities of organizers active in the selected cohort.', bars(orderedCounts(active, organizer => organizer.base)))}
    ${panel('Where they host', 'Host cities of events in the selected cohort.', bars(orderedCounts(cohort.events, event => event.city)))}
    ${panel('Organizer spending by expense', 'Demo event costs in naira, grouped by expense category.', bars(costBy('category'), money))}
    ${panel('How organizers pay', 'Demo event costs by payment method.', bars(costBy('method'), money))}
  </div>` + panel('Organizer activity', 'Fictional organizer records with the most common event classifications.', table('Organizer activity', [
    'Organizer', 'Base city', 'Events hosted', 'Top category', 'Top kind', 'Top genre',
  ], active.map(organizer => {
    const events = cohort.events.filter(event => event.organizerId === organizer.id);
    const top = key => orderedCounts(events, event => event[key])[0][0];
    return [organizer.name, organizer.base, number(events.length), top('category'), top('kind'), top('genre')];
  }))) + `<div class="admin-grid">${feedback(cohort, 'organizer')}${supportReport(cohort, 'Organizer')}</div>`;
}

function eventDetail(cohort, settings) {
  const options = [...cohort.events].sort((a, b) => b.start.localeCompare(a.start));
  if (!options.length) return panel('Choose an event', 'Change the filters to find events.', '<p class="admin-empty">No events match the current filters.</p>');
  const event = options.find(event => event.id === selectedEvent) ?? options[0];
  selectedEvent = event.id;
  const selected = selectCohort(data, { ...settings, event: event.id });
  const stats = summarize(selected);
  const arrivals = stats.attended.map(ticket => elapsedHours(event.start, ticket.checkIn) * 60);
  const arrivalHours = countBy(stats.attended, ticket => wat(ticket.checkIn).getUTCHours());
  const eventDate = value => wat(value).toISOString().slice(0, 10);
  const eventTime = wat(event.start).toISOString().slice(11, 16);
  return `<label class="admin-control event-picker">Choose an event<select id="detail-event">
    ${options.map(item => `<option value="${item.id}" ${item.id === event.id ? 'selected' : ''}>${item.title} · ${item.city} · ${eventDate(item.start)}</option>`).join('')}
    </select></label>`
    + panel(event.title, `${eventDate(event.start)} at ${eventTime} WAT · ${event.city} · ${event.category} / ${event.kind} / ${event.genre}`,
      `<p>Hosted by ${data.organizers.find(organizer => organizer.id === event.organizerId).name} · ${number(event.capacity)} capacity</p>`)
    + kpis([
      ['Primary buyers', number(stats.buyers), `${number(selected.orders.length)} completed orders`],
      ['Primary tickets sold', number(selected.tickets.length), `${number(stats.refunds.length)} refunded`],
      ['Unique attendees', number(stats.attendees), `${number(stats.checkIns)} check-ins · ${percent(stats.attendanceRate)} of eligible tickets`],
      ['Net customer spend', money(stats.netPaid), 'Includes retained fees'],
    ]) + `<div class="admin-grid">
    ${panel('Arrival relative to event start', 'Check-in counts by the difference between arrival and scheduled start.', bars([
      ['Over 60 min early', arrivals.filter(minutes => minutes < -60).length],
      ['31–60 min early', arrivals.filter(minutes => minutes >= -60 && minutes < -30).length],
      ['1–30 min early', arrivals.filter(minutes => minutes >= -30 && minutes < 0).length],
      ['On time or later', arrivals.filter(minutes => minutes >= 0).length],
    ]))}
    ${panel('Arrival hour', 'Check-in timestamps in West Africa Time.', bars([...arrivalHours].sort((a, b) => a[0] - b[0]).map(([hour, count]) => [String(hour).padStart(2, '0') + ':00', count])))}
    ${panel('Tickets by tier', 'Primary sales, refunds, and check-ins for this event.', table('Event ticket tiers', ['Tier', 'Sold', 'Refunded', 'Checked in'],
      [...countBy(selected.tickets, ticket => ticket.tier)].map(([tier, count]) => [
        tier, number(count), number(stats.refunds.filter(ticket => ticket.tier === tier).length),
        number(stats.attended.filter(ticket => ticket.tier === tier).length),
      ])))}
    ${genderReport(stats)}
  </div>` + refundResale(stats) + `<div class="admin-grid">${feedback(selected, 'customer')}${feedback(selected, 'organizer')}</div>`;
}

const reports = { overview, events: demand, timing: bookingPatterns, customers, organizers };

function render() {
  const settings = filters();
  filterMonths.options[1].disabled = settings.year === 2026;
  if (settings.year === 2026) filterMonths.value = '10';
  const cohort = selectCohort(data, settings);
  const prior = selectCohort(data, settings, settings.year - 1);
  const [title, description] = titles[report];
  $('#report-title').textContent = title;
  $('#report-description').textContent = description;
  $('#admin-scope').textContent = `${settings.monthCount === 12 ? 'January–December' : 'January–October'} ${settings.year} · ${number(cohort.events.length)} events · West Africa Time · Demo NGN`;
  document.querySelectorAll('[data-report]').forEach(button => {
    if (button.dataset.report === report) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('#admin-report').innerHTML = report === 'event'
    ? eventDetail(cohort, settings)
    : reports[report](cohort, prior, settings);
}

document.querySelectorAll('[data-report]').forEach(button => button.addEventListener('click', () => {
  report = button.dataset.report;
  history.replaceState(null, '', '#' + report);
  render();
}));

$('#admin-filters').addEventListener('change', render);
$('#admin-filters').addEventListener('reset', event => {
  event.preventDefault();
  filterYear.value = '2026';
  filterMonths.value = '10';
  filterCity.value = '';
  filterCategory.value = '';
  selectedEvent = null;
  render();
});

$('#admin-report').addEventListener('change', event => {
  if (event.target.id === 'detail-event') selectedEvent = Number(event.target.value);
  if (event.target.id === 'event-dimension') dimension = event.target.value;
  if (event.target.id === 'trend-metric') trendMetric = event.target.value;
  render();
  document.getElementById(event.target.id)?.focus({ preventScroll: true });
});

render();
