import { bool, field, optional, ref, resource, section, status } from './catalog.mjs';
import { find, revise, rowsOf, saveRecord } from './store.mjs';

const page = section('events', 'Event management', '▥', 'Plan events, review organizer submissions, and manage agendas and capacity.');
const states = ['Draft', 'Pending approval', 'Published', 'Ongoing', 'Completed', 'Cancelled', 'Archived'];

resource(page, 'events', 'Events', [
  field('title', 'Title'), field('description', 'Description', 'textarea'),
  ref('category', 'Category', 'categories'), optional('tags', 'Tags, separated by commas'),
  optional('banner', 'Banner image', 'media'), optional('media', 'Additional media URL', 'url'),
  ref('organizer', 'Organizer', 'users'), ref('venue', 'Venue', 'venues', true),
  optional('virtual', 'Virtual event link', 'url'), field('start', 'Starts', 'datetime-local'),
  field('end', 'Ends', 'datetime-local'), field('capacity', 'Capacity', 'number', { min: 1, integer: true }),
  status(states), bool('featured', 'Featured'), bool('promoted', 'Promoted'),
], {
  columns: ['title', 'start', 'capacity', 'status', 'featured'],
  rows: [
    { id: 'sunset', title: 'Sunset Sessions', description: 'Live music at golden hour.', category: 'music', tags: 'Afrobeats, live music', banner: '', media: '', organizer: 'studio', venue: 'waterfront', virtual: '', start: '2026-11-14T17:00', end: '2026-11-14T22:00', capacity: 240, status: 'Published', featured: true, promoted: true },
    { id: 'makers', title: 'Makers Market', description: 'A weekend of independent makers and workshops.', category: 'community', tags: 'Crafts, market', banner: '', media: '', organizer: 'studio', venue: 'waterfront', virtual: '', start: '2026-11-21T10:00', end: '2026-11-22T18:00', capacity: 180, status: 'Pending approval', featured: false, promoted: false },
    { id: 'open', title: 'Open Canvas', description: 'A showcase of local artists.', category: 'arts', tags: 'Exhibition', banner: '', media: '', organizer: 'studio', venue: '', virtual: 'https://example.com/demo-gallery', start: '2026-10-24T16:00', end: '2026-10-24T20:00', capacity: 100, status: 'Completed', featured: false, promoted: false },
  ],
  validate(row, state, previous) {
    if (row.start >= row.end) throw Error('The event must end after it starts.');
    if (find(state, 'users', row.organizer)?.role !== 'Organizer') throw Error('Select a user with the Organizer role.');
    if (!row.venue && !row.virtual) throw Error('Provide a venue or virtual link.');
    const venue = find(state, 'venues', row.venue);
    if (venue && row.capacity > venue.capacity) throw Error('Event capacity exceeds the venue capacity.');
    const assigned = rowsOf(state, 'registrations').filter(item => item.event === row.id && item.status === 'Confirmed')
      .reduce((sum, item) => sum + item.quantity, 0);
    if (assigned > row.capacity) throw Error('Capacity cannot be lower than confirmed registrations.');
    if (previous && rowsOf(state, 'sessions').some(item => item.event === row.id && (item.start < row.start || item.end > row.end))) {
      throw Error('Event dates must contain all scheduled sessions.');
    }
  },
  actions: [
    { label: 'Approve and publish', when: row => row.status === 'Pending approval', run: (state, row) => revise(state, 'events', row.id, { status: 'Published' }) },
    { label: 'Return to draft', when: row => row.status === 'Pending approval', run: (state, row) => revise(state, 'events', row.id, { status: 'Draft' }) },
    { label: 'Archive', when: row => row.status !== 'Archived', run: (state, row) => revise(state, 'events', row.id, { status: 'Archived' }) },
    { label: 'Add session', create: 'sessions', prefill: row => ({ event: row.id, start: row.start, end: row.end }) },
    { label: 'Add registration question', create: 'questions', prefill: row => ({ event: row.id }) },
  ],
  bulkStatus: true,
  bulkFields: ['category', 'tags', 'featured', 'promoted'],
});

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

resource(page, 'sessions', 'Sessions & agenda', [
  field('title', 'Session title'), ref('event', 'Event', 'events'), ref('room', 'Room or hall', 'rooms', true),
  field('start', 'Starts', 'datetime-local'), field('end', 'Ends', 'datetime-local'),
  ref('speaker', 'Speaker', 'speakers', true), optional('notes', 'Agenda notes', 'textarea'),
  status(['None', 'Daily', 'Weekly', 'Monthly'], 'recurrence', 'Repeat'),
  field('occurrences', 'Number of occurrences', 'number', { min: 1, max: 30, integer: true }),
], {
  columns: ['title', 'event', 'room', 'start', 'end', 'speaker'],
  defaults: { recurrence: 'None', occurrences: 1 },
  rows: [
    { id: 'live', title: 'Live band showcase', event: 'sunset', room: 'hall', start: '2026-11-14T17:30', end: '2026-11-14T19:00', speaker: 'ada', notes: 'Doors open at 17:00.', recurrence: 'None', occurrences: 1 },
  ],
  validate(row, state) {
    const event = find(state, 'events', row.event);
    if (row.start >= row.end || row.start < event.start || row.end > event.end) throw Error('Session times must fall inside the event dates.');
    const room = find(state, 'rooms', row.room);
    if (room && room.venue !== event.venue) throw Error('The room must belong to the event venue.');
    if (row.room && rowsOf(state, 'sessions').some(item => item.id !== row.id && item.room === row.room && overlaps(row, item))) {
      throw Error('This room already has a session during that time.');
    }
    if (row.speaker && rowsOf(state, 'sessions').some(item => item.id !== row.id && item.speaker === row.speaker && overlaps(row, item))) {
      throw Error('This speaker already has a session during that time.');
    }
  },
  onCreate(state, row) {
    if (row.recurrence === 'None' || row.occurrences === 1) return;
    for (let step = 1; step < row.occurrences; step++) {
      const next = value => {
        const date = new Date(value + 'Z');
        if (row.recurrence === 'Monthly') {
          const day = date.getUTCDate();
          date.setUTCDate(1);
          date.setUTCMonth(date.getUTCMonth() + step);
          const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
          date.setUTCDate(Math.min(day, last));
        } else {
          date.setUTCDate(date.getUTCDate() + step * (row.recurrence === 'Weekly' ? 7 : 1));
        }
        return date.toISOString().slice(0, 16);
      };
      saveRecord(state, 'sessions', { ...row, start: next(row.start), end: next(row.end), recurrence: 'None', occurrences: 1 });
    }
  },
});

resource(page, 'waitlist', 'Waitlist', [
  ref('event', 'Event', 'events'), ref('user', 'Attendee', 'users'),
  field('quantity', 'Requested tickets', 'number', { min: 1, max: 100, integer: true }),
  status(['Waiting', 'Invited', 'Registered', 'Withdrawn']),
], {
  columns: ['event', 'user', 'quantity', 'status'],
  rows: [{ id: 'wait-1', event: 'sunset', user: 'ken', quantity: 1, status: 'Waiting' }],
  actions: [
    { label: 'Invite from waitlist', when: row => row.status === 'Waiting', run(state, row) {
      const event = find(state, 'events', row.event);
      const sold = rowsOf(state, 'registrations').filter(item => item.event === row.event && item.status === 'Confirmed')
        .reduce((sum, item) => sum + item.quantity, 0);
      if (sold + row.quantity > event.capacity) throw Error('This event does not have enough available places.');
      revise(state, 'waitlist', row.id, { status: 'Invited' });
    } },
  ],
});

resource(page, 'questions', 'Registration questions', [
  ref('event', 'Event', 'events'), field('title', 'Question'),
  status(['Short text', 'Long text', 'Multiple choice', 'Yes / no'], 'format', 'Answer type'),
  optional('options', 'Choices, separated by commas'), bool('required', 'Required answer'),
], {
  rows: [{ id: 'q-access', event: 'sunset', title: 'Do you have accessibility requirements?', format: 'Yes / no', options: '', required: true }],
  validate(row) {
    if (row.format === 'Multiple choice' && row.options.split(',').filter(value => value.trim()).length < 2) throw Error('Enter at least two choices.');
  },
});

resource(page, 'eventSeries', 'Recurring events', [
  field('title', 'Series name'), ref('event', 'Template event', 'events'),
  status(['Daily', 'Weekly', 'Monthly'], 'cadence', 'Frequency'),
  field('count', 'Additional events', 'number', { min: 1, max: 24, integer: true }),
], {
  columns: ['title', 'event', 'cadence', 'count'],
  onCreate(state, row) {
    const event = find(state, 'events', row.event);
    const shift = (value, step) => {
      const date = new Date(value + 'Z');
      if (row.cadence === 'Monthly') {
        const day = date.getUTCDate();
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() + step);
        date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
      } else {
        date.setUTCDate(date.getUTCDate() + step * (row.cadence === 'Weekly' ? 7 : 1));
      }
      return date.toISOString().slice(0, 16);
    };
    const sessions = rowsOf(state, 'sessions').filter(item => item.event === event.id);
    for (let step = 1; step <= row.count; step++) {
      const occurrence = saveRecord(state, 'events', {
        ...event, title: row.title + ' · ' + (step + 1),
        start: shift(event.start, step), end: shift(event.end, step),
        status: 'Draft', featured: false, promoted: false,
      });
      for (const session of sessions) {
        saveRecord(state, 'sessions', {
          ...session, event: occurrence.id, start: shift(session.start, step), end: shift(session.end, step),
          recurrence: 'None', occurrences: 1,
        });
      }
    }
  },
});
