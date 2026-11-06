import { bool, field, optional, ref, resource, section, status } from './catalog.mjs';
import { find, revise, rowsOf, saveRecord } from './store.mjs';

const page = section('security', 'Security & compliance', '⬡', 'Review sign-ins, privacy requests, fraud signals, and local recovery tools.', {
  actions: [
    { label: 'Export demo backup', command: 'backup' },
    { label: 'Restore demo backup', command: 'restore' },
    { label: 'Scan demo fraud signals', command: 'fraud-scan' },
  ],
});

resource(page, 'securitySettings', 'Admin security settings', [
  field('title', 'Configuration name'), bool('twoFactor', 'Require demo two-factor challenge'),
  field('sourceIp', 'Demo source IP for login checks'), bool('allowOnly', 'Require a matching allow rule'),
], {
  singleton: true,
  rows: [{ id: 'security', title: 'Admin access preview', twoFactor: false, sourceIp: '192.0.2.10', allowOnly: false }],
  validate(row) {
    if (!validIpv4(row.sourceIp)) throw Error('Enter a demo IPv4 address.');
  },
  actions: [{ label: 'Test demo sign-in', command: 'test-signin' }],
});

export function validIpv4(value) {
  const parts = value.split('.');
  return parts.length === 4 && parts.every(part => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
}

function ipNumber(ip) {
  return ip.split('.').reduce((value, octet) => ((value << 8) | Number(octet)) >>> 0, 0);
}

export function ipMatches(address, rule) {
  const [network, prefixText = '32'] = rule.split('/');
  const prefix = Number(prefixText);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipNumber(address) & mask) === (ipNumber(network) & mask);
}

resource(page, 'ipRules', 'IP allow & block rules', [
  field('title', 'Rule name'), field('network', 'IPv4 address or CIDR range'),
  status(['Allow', 'Block'], 'action', 'Rule action'), bool('enabled', 'Enabled'),
], {
  validate(row) {
    const parts = row.network.split('/');
    const prefix = parts[1] ?? '32';
    if (parts.length > 2 || !validIpv4(parts[0]) || !/^\d{1,2}$/.test(prefix) || Number(prefix) > 32) throw Error('Enter an IPv4 address or a CIDR range such as 192.0.2.0/24.');
  },
});

resource(page, 'loginActivity', 'Sessions & login activity', [
  field('title', 'Demo actor'), field('at', 'Time (UTC)', 'datetime-local'), field('ip', 'Demo source IP'),
  status(['Simulated sign-in', 'Blocked', 'Ended'], 'status', 'Session state'),
], {
  rows: [{ id: 'login-1', title: 'Maya Okafor', at: '2026-11-06T08:15', ip: '192.0.2.10', status: 'Simulated sign-in' }],
  readOnly: true,
  actions: [{ label: 'End recorded demo session', when: row => row.status === 'Simulated sign-in', run: (state, row) => revise(state, 'loginActivity', row.id, { status: 'Ended' }) }],
});

resource(page, 'privacy', 'Privacy requests', [
  ref('user', 'Demo account', 'users'), status(['Access export', 'Deletion'], 'kind', 'Request type'),
  field('date', 'Received on', 'date'), status(['Pending', 'In review', 'Completed', 'Rejected']),
  optional('notes', 'Resolution notes', 'textarea'),
], {
  defaults: { status: 'Pending', date: '2026-11-06' },
  actions: [
    { label: 'Export demo account data', command: 'privacy-export', when: row => row.kind === 'Access export' && row.status !== 'Rejected' },
    { label: 'Apply demo deletion request', command: 'privacy-delete', when: row => row.kind === 'Deletion' && ['Pending', 'In review'].includes(row.status) },
  ],
});

resource(page, 'consents', 'Consent log', [
  ref('user', 'Demo account', 'users'), field('title', 'Consent purpose'),
  field('date', 'Recorded on', 'date'), status(['Granted', 'Withdrawn']),
], { rows: [{ id: 'consent-1', user: 'ife', title: 'Demo event updates', date: '2026-11-02', status: 'Granted' }] });

resource(page, 'fraud', 'Suspicious activity', [
  field('title', 'Flag summary'), ref('transaction', 'Transaction', 'transactions', true),
  ref('user', 'Demo account', 'users', true), status(['Low', 'Medium', 'High'], 'risk', 'Risk'),
  field('reason', 'Signal details', 'textarea'), status(['Open', 'In review', 'Cleared', 'Escalated']),
], {
  rows: [{ id: 'fraud-1', title: 'Repeated payment attempts', transaction: 'tx-3', user: '', risk: 'Medium', reason: 'Synthetic repeated-attempt signal.', status: 'Open' }],
  actions: [{ label: 'Clear flag', when: row => row.status !== 'Cleared', run: (state, row) => revise(state, 'fraud', row.id, { status: 'Cleared' }) }],
});

export function scanFraud(state) {
  const failedByRegistration = new Map();
  for (const transaction of rowsOf(state, 'transactions').filter(row => row.status === 'Failed' && row.registration)) {
    const list = failedByRegistration.get(transaction.registration) || [];
    list.push(transaction);
    failedByRegistration.set(transaction.registration, list);
  }
  let flagged = 0;
  for (const [id, attempts] of failedByRegistration) {
    if (attempts.length < 3 || rowsOf(state, 'fraud').some(row => attempts.some(attempt => attempt.id === row.transaction))) continue;
    saveRecord(state, 'fraud', { title: 'Repeated failed payments', transaction: attempts[0].id,
      user: find(state, 'registrations', id)?.user || '', risk: 'High', reason: attempts.length + ' failed demo payment attempts for one registration.', status: 'Open' });
    flagged++;
  }
  return flagged;
}
