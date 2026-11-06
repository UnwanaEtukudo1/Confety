import { field, resource, section, status } from './catalog.mjs';
import { rowsOf } from './store.mjs';

const page = section('system', 'Support & system tools', '⌘', 'Search the workspace, review health, and migrate demo records.', {
  actions: [
    { label: 'Global search', command: 'search' },
    { label: 'Import records', command: 'migration' },
    { label: 'Open support inbox', nav: 'comms', resource: 'support' },
    { label: 'Help & documentation', command: 'help' },
  ],
  view({ state, kpis, panel, table, escape }) {
    return kpis([
      ['Workspace storage', 'Local', 'Browser demo ledger'],
      ['Pending support cases', rowsOf(state, 'support').filter(row => row.status !== 'Resolved').length, 'Open or in progress'],
      ['Error records', rowsOf(state, 'systemLogs').filter(row => row.level === 'Error').length, 'Recorded demo errors'],
    ]) + panel('Workspace health', table(['Component', 'State'], [
      ['Local data store', 'Readable'], ['Payment gateway', 'Simulation'], ['Message queue', 'Manual simulation'], ['Administration', 'Local demo session'],
    ]));
  },
});

resource(page, 'systemLogs', 'System & error logs', [
  field('title', 'Log summary'), field('at', 'Time (UTC)', 'datetime-local'),
  status(['Info', 'Warning', 'Error'], 'level', 'Severity'), field('detail', 'Details', 'textarea'),
], {
  readOnly: true,
  rows: [
    { id: 'sys-1', title: 'Demo workspace initialized', at: '2026-11-06T08:00', level: 'Info', detail: 'Demo records loaded.' },
    { id: 'sys-2', title: 'Simulated delivery rejected', at: '2026-11-06T09:10', level: 'Warning', detail: 'An example sandbox delivery failure for review.' },
  ],
});
