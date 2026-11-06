import { amount, currencies, field, optional, ref, resource, section, status } from './catalog.mjs';
import { DEMO_DAY, find, revise, rowsOf, saveRecord, timestamp } from './store.mjs';

const page = section('ticketing', 'Ticketing & registration', '▱', 'Configure tickets, register attendees, and manage entry.', {
  actions: [{ label: 'Scan or enter ticket', command: 'checkin' }],
});

resource(page, 'tickets', 'Ticket types', [
  field('title', 'Ticket name'), ref('event', 'Event', 'events'),
  status(['Free', 'Paid', 'Early bird', 'VIP', 'Group', 'Donation'], 'kind', 'Ticket type'),
  amount('price', 'Price or suggested donation'), status(currencies, 'currency', 'Currency'),
  field('limit', 'Ticket allocation', 'number', { min: 1, max: 100000, integer: true }),
  field('orderLimit', 'Maximum per order', 'number', { min: 1, max: 100, integer: true }),
  field('opens', 'Sales open', 'datetime-local'), field('closes', 'Sales close', 'datetime-local'),
], {
  columns: ['title', 'event', 'kind', 'price', 'currency', 'limit'],
  defaults: { kind: 'Paid', price: 0, currency: 'NGN', orderLimit: 6 },
  rows: [
    { id: 'general', title: 'Sunset General', event: 'sunset', kind: 'Paid', price: 15000, currency: 'NGN', limit: 200, orderLimit: 6, opens: '2026-10-01T09:00', closes: '2026-11-14T17:00' },
    { id: 'vip', title: 'Sunset VIP', event: 'sunset', kind: 'VIP', price: 30000, currency: 'NGN', limit: 40, orderLimit: 4, opens: '2026-10-01T09:00', closes: '2026-11-14T17:00' },
    { id: 'gallery', title: 'Gallery admission', event: 'open', kind: 'Free', price: 0, currency: 'NGN', limit: 100, orderLimit: 4, opens: '2026-09-01T09:00', closes: '2026-10-24T16:00' },
  ],
  validate(row, state, previous) {
    if (row.opens >= row.closes) throw Error('Sales must close after they open.');
    if (row.kind === 'Free' && row.price !== 0) throw Error('Free tickets must have a price of zero.');
    if (row.orderLimit > row.limit) throw Error('The order limit cannot exceed the allocation.');
    if (previous && row.event !== previous.event && rowsOf(state, 'registrations').some(item => item.ticket === row.id)) {
      throw Error('This ticket type is already linked to registrations.');
    }
    const sold = rowsOf(state, 'registrations').filter(item => item.ticket === row.id && item.status === 'Confirmed')
      .reduce((total, item) => total + item.quantity, 0);
    if (sold > row.limit) throw Error('Allocation cannot be below confirmed tickets.');
  },
});

resource(page, 'promos', 'Promotions & vouchers', [
  field('title', 'Code'), ref('event', 'Event', 'events', true),
  status(['Percentage', 'Fixed amount', 'Voucher'], 'kind', 'Discount type'),
  amount('value', 'Value'), status(currencies, 'currency', 'Currency'),
  field('limit', 'Maximum uses', 'number', { min: 1, integer: true }),
  field('expires', 'Expires', 'date'), status(['Active', 'Paused']),
], {
  rows: [{ id: 'promo-1', title: 'GROOVE10', event: 'sunset', kind: 'Percentage', value: 10, currency: 'NGN', limit: 50, expires: '2026-11-14', status: 'Active' }],
  validate(row, state) {
    if (row.kind === 'Percentage' && row.value > 100) throw Error('Percentage discounts cannot exceed 100%.');
    if (rowsOf(state, 'promos').some(item => item.id !== row.id && item.title.toLowerCase() === row.title.toLowerCase())) throw Error('A promotion already uses this code.');
  },
});

resource(page, 'registrations', 'Attendees & registrations', [
  field('reference', 'Ticket reference'), ref('event', 'Event', 'events'), ref('ticket', 'Ticket type', 'tickets'),
  ref('user', 'Attendee', 'users'), field('quantity', 'Quantity', 'number', { min: 1, max: 100, integer: true }),
  field('bookedAt', 'Booked at', 'datetime-local'), ref('promo', 'Promo code', 'promos', true),
  ref('referral', 'Referral or affiliate', 'referrals', true),
  optional('donation', 'Donation per ticket', 'number'),
  optional('answers', 'Registration answers (one Question: Answer per line)', 'textarea'),
  status(['Confirmed', 'Cancelled']),
], {
  columns: ['reference', 'user', 'event', 'ticket', 'quantity', 'status'],
  defaults: () => ({ reference: 'CF-' + crypto.randomUUID().slice(0, 8).toUpperCase(), quantity: 1, bookedAt: DEMO_DAY + 'T10:00', status: 'Confirmed' }),
  rows: [
    { id: 'reg-1', reference: 'CF-SUNSET-01', event: 'sunset', ticket: 'general', user: 'ife', quantity: 2, bookedAt: '2026-11-02T18:30', promo: 'promo-1', referral: '', donation: '', answers: 'Do you have accessibility requirements?: No', status: 'Confirmed' },
    { id: 'reg-2', reference: 'CF-SUNSET-02', event: 'sunset', ticket: 'vip', user: 'ken', quantity: 1, bookedAt: '2026-11-05T19:30', promo: '', referral: '', donation: '', answers: 'Do you have accessibility requirements?: Yes', status: 'Confirmed' },
    { id: 'reg-3', reference: 'CF-GALLERY-01', event: 'open', ticket: 'gallery', user: 'ife', quantity: 1, bookedAt: '2026-10-22T10:00', promo: '', referral: '', donation: '', answers: '', status: 'Confirmed' },
  ],
  validate(row, state, previous) {
    if (previous && rowsOf(state, 'transactions').some(item => item.registration === row.id) &&
      ['event', 'ticket', 'quantity', 'promo', 'referral', 'donation', 'bookedAt'].some(key => row[key] !== previous[key])) {
      throw Error('Booked pricing and quantity are locked once a transaction exists. Cancel and rebook if these details need to change.');
    }
    const ticket = find(state, 'tickets', row.ticket);
    const event = find(state, 'events', row.event);
    if (ticket.event !== row.event) throw Error('The ticket type belongs to a different event.');
    if (row.quantity > ticket.orderLimit) throw Error('This exceeds the ticket’s per-order limit.');
    if (rowsOf(state, 'registrations').some(item => item.id !== row.id && item.reference.toLowerCase() === row.reference.toLowerCase())) throw Error('That ticket reference already exists.');
    const entryCount = rowsOf(state, 'checkins').filter(item => item.registration === row.id).length;
    if (entryCount && (row.status !== 'Confirmed' || row.quantity < entryCount || row.event !== previous?.event || row.user !== previous?.user)) {
      throw Error('This change conflicts with existing check-ins.');
    }
    if (row.status !== 'Confirmed') return;
    if (['Cancelled', 'Archived'].includes(event.status) &&
      (!previous || previous.status !== 'Confirmed' || previous.event !== row.event)) {
      throw Error('This event cannot accept confirmed registrations.');
    }
    if (!previous && (row.bookedAt < ticket.opens || row.bookedAt > ticket.closes)) throw Error('The booking time is outside the ticket sales window.');
    const other = rowsOf(state, 'registrations').filter(item => item.id !== row.id && item.status === 'Confirmed');
    const quantity = list => list.reduce((sum, item) => sum + item.quantity, row.quantity);
    if (quantity(other.filter(item => item.event === row.event)) > event.capacity) throw Error('This event is at capacity.');
    if (quantity(other.filter(item => item.ticket === row.ticket)) > ticket.limit) throw Error('This ticket allocation is full.');
    const referral = find(state, 'referrals', row.referral);
    if (referral && (!previous || previous.referral !== row.referral) &&
      (referral.status !== 'Active' || referral.event && referral.event !== row.event || referral.promo && referral.promo !== row.promo)) {
      throw Error('Choose an active referral for this event and its linked promo code.');
    }
    const promo = find(state, 'promos', row.promo);
    if (promo && (promo.event && promo.event !== row.event || promo.kind !== 'Percentage' && promo.currency !== ticket.currency ||
      (!previous || previous.promo !== row.promo) && (promo.status !== 'Active' || promo.expires < row.bookedAt.slice(0, 10)) ||
      other.filter(item => item.promo === promo.id).length >= promo.limit)) throw Error('This promotion is unavailable for the booking.');
    if (!previous) {
      const answers = new Map(row.answers.split('\n').filter(line => line.includes(':')).map(line => {
        const split = line.indexOf(':');
        return [line.slice(0, split).trim(), line.slice(split + 1).trim()];
      }));
      for (const question of rowsOf(state, 'questions').filter(item => item.event === row.event)) {
        const answer = answers.get(question.title);
        if (question.required && !answer) throw Error('Answer the required question: ' + question.title);
        if (answer && question.format === 'Yes / no' && !/^(yes|no)$/i.test(answer)) throw Error('Use Yes or No for ' + question.title);
        if (answer && question.format === 'Multiple choice' && !question.options.split(',').map(value => value.trim()).includes(answer)) {
          throw Error('Choose a valid answer for ' + question.title);
        }
      }
    }
  },
  onCreate(state, row) {
    if (row.status !== 'Confirmed') return;
    const ticket = find(state, 'tickets', row.ticket);
    const promo = find(state, 'promos', row.promo);
    const unit = ticket.kind === 'Donation' && row.donation !== '' ? row.donation : ticket.price;
    const subtotal = unit * row.quantity;
    const discount = promo ? promo.kind === 'Percentage' ? subtotal * promo.value / 100 : promo.value : 0;
    const price = Math.max(0, subtotal - discount);
    const rates = rowsOf(state, 'financeSettings').find(item => item.currency === ticket.currency);
    const tax = Math.round(price * (rates?.tax || 0)) / 100;
    const fee = Math.round(price * (rates?.commission || 0)) / 100;
    saveRecord(state, 'transactions', {
      reference: 'TX-' + row.reference, registration: row.id, amount: price + tax + fee,
      currency: ticket.currency, status: 'Paid', refunded: 0, tax, fee,
      method: 'Manual / demo', date: row.bookedAt.slice(0, 10),
    });
    const waiting = rowsOf(state, 'waitlist').find(item => item.event === row.event && item.user === row.user && item.status === 'Invited');
    if (waiting) revise(state, 'waitlist', waiting.id, { status: 'Registered' });
    const referral = find(state, 'referrals', row.referral);
    if (referral) revise(state, 'referrals', referral.id, { conversions: referral.conversions + 1 });
  },
  actions: [
    { label: 'Preview ticket and QR', command: 'registration-ticket' },
    { label: 'Check in one attendee', when: row => row.status === 'Confirmed', run: (state, row) => recordCheckin(state, row, 'Manual') },
    { label: 'Transfer ticket order', create: 'transfers', prefill: row => ({ registration: row.id }), when: row => row.status === 'Confirmed' },
    { label: 'Resend demo ticket', run(state, row) {
      saveRecord(state, 'delivery', { title: 'Ticket resend · ' + row.reference, channel: 'Email', audience: 'Attendee', event: row.event, date: timestamp().slice(0, 16), status: 'Simulated sent', count: 1 });
    } },
    { label: 'Cancel registration', when: row => row.status === 'Confirmed', run: (state, row) => revise(state, 'registrations', row.id, { status: 'Cancelled' }) },
  ],
  bulkStatus: true,
});

resource(page, 'transfers', 'Ticket transfers', [
  ref('registration', 'Registration', 'registrations'), ref('recipient', 'New attendee', 'users'),
  field('reason', 'Transfer reason', 'textarea'),
], {
  onCreate(state, row) {
    const registration = find(state, 'registrations', row.registration);
    if (registration.status !== 'Confirmed' || registration.user === row.recipient) throw Error('Choose a confirmed booking and a different recipient.');
    revise(state, 'registrations', registration.id, { user: row.recipient });
  },
});

resource(page, 'checkins', 'Check-in logs', [
  ref('registration', 'Registration', 'registrations'), field('at', 'Checked in at', 'datetime-local'),
  status(['Manual', 'QR'], 'method', 'Method'),
], {
  readOnly: true,
  validate(row, state) {
    const registration = find(state, 'registrations', row.registration);
    if (registration.status !== 'Confirmed') throw Error('Only confirmed tickets can check in.');
    if (rowsOf(state, 'checkins').filter(item => item.registration === row.registration && item.id !== row.id).length >= registration.quantity) {
      throw Error('All tickets in this registration are already checked in.');
    }
  },
  rows: [{ id: 'check-1', registration: 'reg-3', at: '2026-10-24T15:53', method: 'QR' }],
});

export function recordCheckin(state, registration, method) {
  if (['Cancelled', 'Archived'].includes(find(state, 'events', registration.event)?.status)) {
    throw Error('Check-in is unavailable for cancelled or archived events.');
  }
  const at = new Date(Date.now() + 3_600_000).toISOString().slice(0, 16);
  return saveRecord(state, 'checkins', { registration: registration.id, at, method });
}

resource(page, 'ticketTemplates', 'Badge & ticket templates', [
  field('title', 'Template name'), status(['Badge', 'Ticket'], 'kind', 'Format'),
  field('headline', 'Headline'), optional('message', 'Body text', 'textarea'),
  field('color', 'Accent color', 'color'), optional('logo', 'Logo image', 'media'),
], {
  defaults: { color: '#df83e8', kind: 'Ticket' },
  rows: [{ id: 'design-1', title: 'Confety standard', kind: 'Ticket', headline: 'Your next good time', message: 'Show your ticket at the door.', color: '#df83e8', logo: '' }],
  actions: [{ label: 'Preview and print', command: 'template' }],
});
