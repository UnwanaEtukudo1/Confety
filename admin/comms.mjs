import { amount, field, optional, ref, resource, section, status } from './catalog.mjs';
import { revise, rowsOf, saveRecord, timestamp } from './store.mjs';

const page = section('comms', 'Communication & notifications', '✉', 'Draft campaigns, schedule messages, and track simulated delivery.', {
  actions: [{ label: 'Run due demo messages', command: 'run-due-campaigns' }],
});
const channels = ['Email', 'SMS', 'Push', 'In-app'];
const audiences = ['Attendee', 'Organizer', 'Speaker', 'Staff', 'All active users'];

resource(page, 'templates', 'Message templates', [
  field('title', 'Template name'), status(['Confirmation', 'Reminder', 'Cancellation', 'Campaign'], 'kind', 'Template use'),
  status(channels, 'channel', 'Channel'), field('subject', 'Subject or heading'), field('body', 'Message', 'textarea'),
], {
  rows: [
    { id: 'confirmation', title: 'Ticket confirmation', kind: 'Confirmation', channel: 'Email', subject: 'Your Confety booking', body: 'Your demo ticket has been booked.' },
    { id: 'reminder', title: 'Event reminder', kind: 'Reminder', channel: 'SMS', subject: 'See you soon', body: 'Your event starts soon. Check your ticket for the location.' },
    { id: 'cancel', title: 'Event cancellation', kind: 'Cancellation', channel: 'Email', subject: 'An update about your event', body: 'Please check the event page for cancellation details.' },
  ],
});

resource(page, 'campaigns', 'Campaigns & broadcasts', [
  field('title', 'Campaign name'), status(channels, 'channel', 'Channel'), status(audiences, 'audience', 'Audience segment'),
  ref('event', 'Event filter', 'events', true), ref('template', 'Message template', 'templates', true),
  optional('body', 'Message override', 'textarea'), optional('scheduled', 'Scheduled for (WAT)', 'datetime-local'),
  status(['Draft', 'Scheduled', 'Simulated sent', 'Cancelled']),
], {
  defaults: { channel: 'Email', audience: 'Attendee', status: 'Draft' },
  rows: [{ id: 'campaign-1', title: 'Sunset attendee reminder', channel: 'Email', audience: 'Attendee', event: 'sunset', template: '', body: 'Doors open at 17:00.', scheduled: '2026-11-13T17:00', status: 'Scheduled' }],
  validate(row, state, previous) {
    if (!row.body && !row.template) throw Error('Choose a template or enter a message.');
    if (row.template && state.records.templates.find(item => item.id === row.template).channel !== row.channel) throw Error('Choose a template for the selected channel.');
    if (row.status === 'Scheduled' && !row.scheduled) throw Error('Enter a delivery date and time.');
    if (row.status === 'Simulated sent' && previous?.status !== 'Simulated sent') throw Error('Use the Simulate delivery action to create a log.');
  },
  actions: [
    { label: 'Preview audience and message', command: 'campaign-preview' },
    { label: 'Simulate delivery', when: row => ['Draft', 'Scheduled'].includes(row.status), run: deliverCampaign },
  ],
});

export function deliverCampaign(state, row, sentAt = timestamp().slice(0, 16)) {
  const recipients = campaignAudience(state, row);
  if (!recipients.length) throw Error('There are no active recipients in this segment.');
  saveRecord(state, 'delivery', { title: row.title, channel: row.channel, audience: row.audience,
    event: row.event, date: sentAt, status: 'Simulated sent', count: recipients.length });
  row.status = 'Simulated sent';
}

export function campaignAudience(state, row) {
  const eventUsers = new Set(rowsOf(state, 'registrations').filter(item => item.event === row.event && item.status === 'Confirmed').map(item => item.user));
  const event = state.records.events.find(item => item.id === row.event);
  if (event?.organizer) eventUsers.add(event.organizer);
  for (const item of rowsOf(state, 'sessions').filter(item => item.event === row.event)) {
    const speaker = rowsOf(state, 'speakers').find(speaker => speaker.id === item.speaker);
    const user = rowsOf(state, 'users').find(user => user.role === 'Speaker' && user.name === speaker?.name);
    if (user) eventUsers.add(user.id);
  }
  return rowsOf(state, 'users').filter(user => user.status === 'Active' &&
    (row.audience === 'All active users' || user.role === row.audience) && (!row.event || eventUsers.has(user.id)));
}

resource(page, 'delivery', 'Delivery log', [
  field('title', 'Message'), status(channels, 'channel', 'Channel'), field('audience', 'Audience'),
  ref('event', 'Event', 'events', true), field('date', 'Sent at (UTC)', 'datetime-local'),
  status(['Simulated sent', 'Simulated failed']), amount('count', 'Recipient count'),
], { readOnly: true });

resource(page, 'support', 'Support inbox', [
  field('title', 'Subject'), ref('user', 'Requester', 'users'), ref('event', 'Event', 'events', true),
  field('message', 'Query', 'textarea'), status(['Normal', 'High', 'Urgent'], 'priority', 'Priority'),
  status(['Open', 'In progress', 'Resolved']), optional('reply', 'Internal reply draft', 'textarea'),
], {
  rows: [{ id: 'case-1', title: 'Ticket access question', user: 'ife', event: 'sunset', message: 'Where do I find the demo ticket?', priority: 'Normal', status: 'Open', reply: '' }],
  actions: [{ label: 'Resolve case', when: row => row.status !== 'Resolved', run: (state, row) => revise(state, 'support', row.id, { status: 'Resolved' }) }],
});
