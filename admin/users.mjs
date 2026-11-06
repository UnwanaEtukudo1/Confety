import { field, optional, ref, resource, section, status } from './catalog.mjs';
import { find, revise } from './store.mjs';

const page = section('users', 'User management', '◉', 'Manage the demo directory, organizer verification, and support access.');

resource(page, 'users', 'User directory', [
  field('name', 'Name'), field('email', 'Demo email', 'email'),
  status(['Attendee', 'Organizer', 'Speaker', 'Staff'], 'role', 'User type'),
  field('city', 'City'), status(['Active', 'Pending', 'Suspended', 'Banned']),
  optional('notes', 'Internal notes', 'textarea'),
], {
  columns: ['name', 'email', 'role', 'city', 'status'],
  defaults: { role: 'Attendee', status: 'Active' },
  importable: true,
  rows: [
    { id: 'ife', name: 'Ife Bello', email: 'ife@example.test', role: 'Attendee', city: 'Lagos', status: 'Active', notes: '' },
    { id: 'ken', name: 'Ken Okoro', email: 'ken@example.test', role: 'Attendee', city: 'Abuja', status: 'Active', notes: '' },
    { id: 'studio', name: 'Open Canvas Studio', email: 'studio@example.test', role: 'Organizer', city: 'Lagos', status: 'Active', notes: 'Demo organizer.' },
    { id: 'ada-user', name: 'Ada James', email: 'ada@example.test', role: 'Speaker', city: 'Lagos', status: 'Active', notes: '' },
    { id: 'maya', name: 'Maya Okafor', email: 'maya@example.test', role: 'Staff', city: 'Lagos', status: 'Active', notes: 'Demo workspace owner.' },
  ],
  actions: [
    { label: 'Suspend', when: row => row.status === 'Active' && row.id !== 'maya', run: (state, row) => revise(state, 'users', row.id, { status: 'Suspended' }) },
    { label: 'Ban', when: row => row.status !== 'Banned' && row.id !== 'maya', run: (state, row) => revise(state, 'users', row.id, { status: 'Banned' }) },
    { label: 'Restore active status', when: row => ['Banned', 'Suspended'].includes(row.status), run: (state, row) => revise(state, 'users', row.id, { status: 'Active' }) },
    { label: 'Create demo reset request', command: 'reset-password' },
    { label: 'View as user (demo)', command: 'impersonate' },
  ],
  noDelete: row => row.id === 'maya',
  bulkStatus: true,
  bulkFields: ['city', 'notes'],
  validate(row, state, previous) {
    if (state.records.users.some(item => item.id !== row.id && item.email.toLowerCase() === row.email.toLowerCase())) throw Error('This email is already in the demo directory.');
    if (previous?.id === 'maya' && (row.status !== 'Active' || row.role !== 'Staff')) throw Error('The demo workspace owner must remain active staff.');
    if (previous && row.role !== 'Organizer' && state.records.events.some(event => event.organizer === row.id)) throw Error('Reassign this organizer’s events before changing their user type.');
  },
});

resource(page, 'verification', 'Organizer verification', [
  ref('user', 'Organizer account', 'users'), field('title', 'Organization name'),
  optional('notes', 'Verification notes', 'textarea'), status(['Submitted', 'In review', 'Verified', 'Rejected']),
], {
  rows: [{ id: 'verify-1', user: 'studio', title: 'Open Canvas Studio', notes: 'Demo documents reviewed.', status: 'In review' }],
  validate(row, state) {
    if (find(state, 'users', row.user)?.role !== 'Organizer') throw Error('Choose an organizer account.');
  },
  actions: [{ label: 'Verify organizer', when: row => row.status !== 'Verified', run(state, row) {
    revise(state, 'verification', row.id, { status: 'Verified' });
    revise(state, 'users', row.user, { status: 'Active' });
  } }],
});
