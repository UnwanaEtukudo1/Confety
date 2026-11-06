import { revise, saveRecord, timestamp } from './store.mjs';
import { field, ref, resource, section, status, sections } from './catalog.mjs';

const page = section('roles', 'Roles & permissions', '◇', 'Configure demo permissions, invite teammates, and inspect the audit trail.', {
  actions: [{ label: 'Preview a role', command: 'role-preview' }],
  view({ state, table, panel, escape }) {
    return panel('Audit log', table(['Time (UTC)', 'Actor', 'Action', 'Target'], state.audit.slice(0, 50).map(row => [
      escape(row.at.slice(0, 16).replace('T', ' ')), escape(row.actor), escape(row.action), escape(row.target),
    ])));
  },
});

resource(page, 'roles', 'Roles', [
  field('title', 'Role name'), field('description', 'Description', 'textarea'),
  field('permissions', 'Section permissions', 'permissions'),
], {
  columns: ['title', 'description'],
  rows: [
    { id: 'admin', title: 'Admin', description: 'Operations and oversight.', permissions: 'dashboard:read,events:write,ticketing:write,users:write,venues:write,partners:write,marketing:write,analytics:read,content:write,feedback:write,system:read' },
    { id: 'moderator', title: 'Moderator', description: 'Review events, content, and engagement.', permissions: 'dashboard:read,events:write,content:write,feedback:write' },
    { id: 'finance', title: 'Finance', description: 'Reconcile payments and manage payouts.', permissions: 'dashboard:read,finance:write,ticketing:read,analytics:read' },
    { id: 'support', title: 'Support', description: 'Manage support cases and look up bookings.', permissions: 'dashboard:read,system:write,comms:write,users:read,ticketing:read' },
  ],
  validate(row) {
    const valid = new Set(sections.flatMap(item => [item.id + ':read', item.id + ':write']));
    if (row.permissions.split(',').some(item => !valid.has(item.trim()))) throw Error('Choose valid section permissions.');
  },
});

resource(page, 'team', 'Team invitations', [
  field('email', 'Teammate demo email', 'email'), ref('role', 'Role', 'roles'),
  field('date', 'Invitation date', 'date'), status(['Queued', 'Simulated invited', 'Accepted', 'Revoked']),
], {
  defaults: { status: 'Queued', date: '2026-11-06' },
  actions: [{ label: 'Simulate team invitation', when: row => row.status === 'Queued', run(state, row) {
    saveRecord(state, 'delivery', { title: 'Demo team invitation', audience: 'Staff', event: '', channel: 'Email', date: timestamp().slice(0, 16), status: 'Simulated sent', count: 1 });
    revise(state, 'team', row.id, { status: 'Simulated invited' });
  } }],
});
