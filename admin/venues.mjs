import { amount, field, optional, ref, resource, section, status } from './catalog.mjs';
import { find, rowsOf } from './store.mjs';

const page = section('venues', 'Venues & resources', '⌂', 'Manage spaces, seating layouts, and equipment availability.');

resource(page, 'venues', 'Venue directory', [
  field('title', 'Venue name'), field('address', 'Street address'), field('city', 'City'),
  field('capacity', 'Capacity', 'number', { min: 1, integer: true }),
  optional('amenities', 'Amenities', 'textarea'), optional('photo', 'Venue photo', 'media'),
], {
  rows: [{ id: 'waterfront', title: 'Waterfront Arts Centre', address: '18 Marina Walk', city: 'Lagos', capacity: 350, amenities: 'Accessible entry, green room, Wi-Fi', photo: '' }],
  validate(row, state) {
    if (rowsOf(state, 'events').some(event => event.venue === row.id && event.capacity > row.capacity)) throw Error('Venue capacity must cover the events assigned to it.');
    if (rowsOf(state, 'rooms').some(room => room.venue === row.id && room.capacity > row.capacity)) throw Error('Venue capacity must cover each room.');
  },
});

resource(page, 'rooms', 'Rooms & halls', [
  field('title', 'Room name'), ref('venue', 'Venue', 'venues'),
  field('capacity', 'Capacity', 'number', { min: 1, integer: true }), optional('setup', 'Room layout'),
], {
  rows: [{ id: 'hall', title: 'Harbour Hall', venue: 'waterfront', capacity: 240, setup: 'Theatre' }],
  validate(row, state) {
    if (row.capacity > find(state, 'venues', row.venue).capacity) throw Error('Room capacity exceeds the venue limit.');
    if (rowsOf(state, 'sessions').some(session => session.room === row.id && find(state, 'events', session.event)?.venue !== row.venue)) throw Error('Move the assigned sessions first.');
  },
  actions: [{ label: 'Allocate to a session', create: 'sessions', prefill: row => ({ room: row.id }) }],
});

resource(page, 'equipment', 'Equipment inventory', [
  field('title', 'Equipment name'), ref('venue', 'Venue', 'venues'), amount('quantity', 'Units available', 1),
  optional('notes', 'Setup notes', 'textarea'),
], { rows: [{ id: 'mic', title: 'Wireless microphones', venue: 'waterfront', quantity: 6, notes: 'Collect at the production desk.' }] });

resource(page, 'resourceBookings', 'Resource bookings', [
  ref('resource', 'Equipment', 'equipment'), ref('event', 'Event', 'events'),
  field('quantity', 'Units', 'number', { min: 1, integer: true }),
  field('start', 'From', 'datetime-local'), field('end', 'Until', 'datetime-local'),
  status(['Reserved', 'Returned', 'Cancelled']),
], {
  defaults: { status: 'Reserved', quantity: 1 },
  validate(row, state) {
    const equipment = find(state, 'equipment', row.resource);
    const event = find(state, 'events', row.event);
    if (row.start >= row.end) throw Error('Booking must end after it starts.');
    if (event.venue !== equipment.venue) throw Error('Choose equipment at the event venue.');
    if (row.status !== 'Reserved') return;
    const overlaps = rowsOf(state, 'resourceBookings').filter(item => item.id !== row.id && item.resource === row.resource &&
      item.status === 'Reserved' && item.start < row.end && item.end > row.start);
    const times = [row.start, ...overlaps.map(item => item.start).filter(time => time >= row.start && time < row.end)];
    if (times.some(time => row.quantity + overlaps.filter(item => item.start <= time && item.end > time)
      .reduce((sum, item) => sum + item.quantity, 0) > equipment.quantity)) throw Error('Equipment inventory is already reserved during this window.');
  },
});

resource(page, 'floorPlans', 'Floor plans & seating', [
  field('title', 'Plan name'), ref('room', 'Room', 'rooms'), optional('image', 'Floor plan image', 'media'),
  field('seating', 'Seating sections, one label:capacity per line', 'textarea'),
], {
  rows: [{ id: 'plan-1', title: 'Harbour Hall · Theatre', room: 'hall', image: '', seating: 'Front:40\nMain:200' }],
  validate(row, state) {
    const lines = row.seating.split('\n').filter(line => line.trim());
    if (lines.some(line => !/^[^:]+:\s*\d+$/.test(line.trim()))) throw Error('Use one section and whole-number capacity per line, such as Front:40.');
    const total = lines.reduce((sum, line) => sum + Number(line.split(':')[1]), 0);
    if (!total || total > find(state, 'rooms', row.room).capacity) throw Error('Seat totals must fit the room capacity.');
  },
  actions: [{ label: 'View seating chart', command: 'seating' }],
});
