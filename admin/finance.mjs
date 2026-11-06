import { amount, bool, currencies, field, optional, ref, resource, section, status } from './catalog.mjs';
import { DEMO_DAY, find, revise, rowsOf } from './store.mjs';

const page = section('finance', 'Payments & finance', '₦', 'Reconcile demo transactions, refunds, fees, taxes, and organizer payouts.', {
  view({ state, kpis, panel, table, money }) {
    const rows = rowsOf(state, 'transactions');
    const totals = currencies.map(currency => {
      const items = rows.filter(row => row.currency === currency);
      const settled = items.filter(row => ['Paid', 'Partially refunded', 'Refunded'].includes(row.status));
      const sum = (list, key) => list.reduce((total, row) => total + (row[key] || 0), 0);
      const gross = sum(settled, 'amount');
      const refunds = sum(settled, 'refunded');
      const disputes = settled.reduce((total, row) => total + chargebackLoss(state, row.id), 0);
      const payouts = sum(rowsOf(state, 'payouts').filter(row => row.currency === currency && row.status === 'Simulated paid'), 'amount');
      return [currency, money(gross, currency), money(refunds, currency), money(disputes, currency), money(gross - refunds - disputes, currency),
        money(sum(settled, 'fee'), currency), money(sum(settled, 'tax'), currency), money(payouts, currency)];
    });
    return kpis([
      ['Transactions', rows.length, 'All payment states'],
      ['Refunds awaiting review', rowsOf(state, 'refunds').filter(row => row.status === 'Pending').length, 'Review in Refund requests'],
      ['Open disputes', rowsOf(state, 'chargebacks').filter(row => row.status === 'Open').length, 'Demo chargebacks'],
    ]) + panel('Currency reconciliation', table(['Currency', 'Collected', 'Refunds', 'Chargeback losses', 'Net collected', 'Original fees', 'Original tax', 'Payouts'], totals));
  },
});
const paid = ['Paid', 'Partially refunded'];

export function chargebackLoss(state, transaction, exclude = '') {
  return rowsOf(state, 'chargebacks').filter(row => row.transaction === transaction && row.status === 'Lost' && row.id !== exclude)
    .reduce((sum, row) => sum + row.amount, 0);
}

function refundable(state, tx) {
  return Math.max(0, tx.amount - tx.refunded - chargebackLoss(state, tx.id));
}

resource(page, 'transactions', 'Transactions', [
  field('reference', 'Transaction reference'), ref('registration', 'Registration', 'registrations', true),
  amount('amount', 'Gross amount including fees and tax'), status(currencies, 'currency', 'Currency'),
  status(['Pending', 'Paid', 'Failed', 'Partially refunded', 'Refunded']),
  amount('refunded', 'Refunded amount'), amount('tax', 'Tax'), amount('fee', 'Platform fee'),
  status(['Card', 'Bank transfer', 'Mobile wallet', 'Manual / demo'], 'method', 'Payment method'),
  field('date', 'Transaction date', 'date'),
], {
  columns: ['reference', 'amount', 'currency', 'status', 'date'],
  defaults: { status: 'Pending', refunded: 0, tax: 0, fee: 0, date: DEMO_DAY, currency: 'NGN' },
  rows: [
    { id: 'tx-1', reference: 'TX-CF-SUNSET-01', registration: 'reg-1', amount: 30000, currency: 'NGN', status: 'Paid', refunded: 0, tax: 1600, fee: 1400, method: 'Card', date: '2026-11-02' },
    { id: 'tx-2', reference: 'TX-CF-SUNSET-02', registration: 'reg-2', amount: 32000, currency: 'NGN', status: 'Paid', refunded: 0, tax: 1200, fee: 800, method: 'Bank transfer', date: '2026-11-05' },
    { id: 'tx-3', reference: 'TX-DEMO-USD', registration: '', amount: 65, currency: 'USD', status: 'Pending', refunded: 0, tax: 4, fee: 2, method: 'Card', date: '2026-11-06' },
  ],
  validate(row, state) {
    if (row.refunded + chargebackLoss(state, row.id) > row.amount || row.tax + row.fee > row.amount) throw Error('Refunds and fee components must fit within the gross amount.');
    if (row.refunded && !['Partially refunded', 'Refunded'].includes(row.status)) throw Error('Choose a refund status when money has been refunded.');
    if (row.status === 'Partially refunded' && (!row.refunded || row.refunded >= row.amount)) throw Error('A partial refund must be between zero and the gross amount.');
    if (row.status === 'Refunded' && row.refunded !== row.amount) throw Error('A fully refunded transaction must match the gross amount.');
    if (rowsOf(state, 'transactions').some(item => item.id !== row.id && item.reference === row.reference)) throw Error('The transaction reference must be unique.');
  },
  actions: [
    { label: 'Generate demo invoice', command: 'invoice' },
    { label: 'Request refund', create: 'refunds', when: row => paid.includes(row.status), prefill: row => ({ transaction: row.id, amount: row.amount - row.refunded }) },
    { label: 'Open chargeback', create: 'chargebacks', prefill: row => ({ transaction: row.id, amount: row.amount - row.refunded }) },
  ],
});

resource(page, 'refunds', 'Refund requests', [
  ref('transaction', 'Transaction', 'transactions'), amount('amount', 'Refund amount', .01),
  field('reason', 'Reason', 'textarea'), status(['Pending', 'Simulated refunded', 'Rejected']),
], {
  defaults: { status: 'Pending' },
  rows: [{ id: 'refund-1', transaction: 'tx-1', amount: 15000, reason: 'One guest can no longer attend.', status: 'Pending' }],
  validate(row, state, previous) {
    if (row.status === 'Simulated refunded' && previous?.status !== 'Simulated refunded') throw Error('Use Approve refund to update the transaction and record together.');
    if (previous?.status === 'Simulated refunded' && (row.amount !== previous.amount || row.transaction !== previous.transaction || row.status !== previous.status)) {
      throw Error('An applied refund cannot be edited.');
    }
    const tx = find(state, 'transactions', row.transaction);
    if (row.status === 'Pending' && (!paid.includes(tx.status) || row.amount > refundable(state, tx))) throw Error('The request exceeds the remaining refundable amount.');
  },
  actions: [
    { label: 'Approve refund', when: row => row.status === 'Pending', run(state, row) {
      const tx = find(state, 'transactions', row.transaction);
      if (!paid.includes(tx.status) || row.amount > refundable(state, tx)) throw Error('The remaining refundable amount has changed.');
      const refunded = Math.round((tx.refunded + row.amount) * 100) / 100;
      revise(state, 'transactions', tx.id, { refunded, status: refunded === tx.amount ? 'Refunded' : 'Partially refunded' });
      row.status = 'Simulated refunded';
    } },
    { label: 'Reject refund', when: row => row.status === 'Pending', run: (state, row) => revise(state, 'refunds', row.id, { status: 'Rejected' }) },
  ],
  noDelete: row => row.status === 'Simulated refunded',
});

resource(page, 'chargebacks', 'Chargebacks', [
  ref('transaction', 'Transaction', 'transactions'), amount('amount', 'Disputed amount', .01),
  field('reason', 'Dispute reason', 'textarea'), optional('evidence', 'Evidence summary', 'textarea'),
  status(['Open', 'Evidence submitted', 'Won', 'Lost']),
], {
  defaults: { status: 'Open' },
  validate(row, state, previous) {
    const tx = find(state, 'transactions', row.transaction);
    if (previous?.status === 'Lost' && (row.status !== 'Lost' || row.transaction !== previous.transaction || row.amount !== previous.amount)) {
      throw Error('A settled chargeback cannot be edited.');
    }
    if (row.amount > tx.amount) throw Error('Disputed amount exceeds the transaction.');
    if (row.status === 'Lost' && (!paid.includes(tx.status) || tx.refunded + row.amount + chargebackLoss(state, tx.id, row.id) > tx.amount)) {
      throw Error('This chargeback exceeds the unsettled transaction balance.');
    }
    if (row.status === 'Evidence submitted' && !row.evidence) throw Error('Add an evidence summary before submitting.');
  },
  actions: [
    { label: 'Mark chargeback won', when: row => ['Open', 'Evidence submitted'].includes(row.status), run: (state, row) => revise(state, 'chargebacks', row.id, { status: 'Won' }) },
    { label: 'Record chargeback loss', when: row => ['Open', 'Evidence submitted'].includes(row.status), run: (state, row) => revise(state, 'chargebacks', row.id, { status: 'Lost' }) },
  ],
  noDelete: row => row.status === 'Lost',
});

resource(page, 'payouts', 'Organizer payouts', [
  ref('organizer', 'Organizer', 'users'), amount('amount', 'Payout amount', .01),
  status(currencies, 'currency', 'Currency'), field('date', 'Payout date', 'date'),
  status(['Queued', 'Simulated paid', 'Failed']), optional('notes', 'Payout notes', 'textarea'),
], {
  defaults: { currency: 'NGN', date: DEMO_DAY, status: 'Queued' },
  validate(row, state, previous) {
    if (find(state, 'users', row.organizer)?.role !== 'Organizer') throw Error('Choose an organizer.');
    if (previous?.status === 'Simulated paid' && (row.amount !== previous.amount || row.currency !== previous.currency ||
      row.organizer !== previous.organizer || row.status !== previous.status)) throw Error('An applied payout cannot be edited.');
    if (row.status !== 'Simulated paid' || previous?.status === 'Simulated paid') return;
    const collected = rowsOf(state, 'transactions').filter(tx => paid.includes(tx.status) && tx.currency === row.currency)
      .filter(tx => find(state, 'events', find(state, 'registrations', tx.registration)?.event)?.organizer === row.organizer)
      .reduce((sum, tx) => sum + Math.max(0, tx.amount - tx.refunded - chargebackLoss(state, tx.id) - tx.fee - tx.tax), 0);
    const alreadyPaid = rowsOf(state, 'payouts').filter(item => item.id !== row.id && item.organizer === row.organizer &&
      item.currency === row.currency && item.status === 'Simulated paid').reduce((sum, item) => sum + item.amount, 0);
    if (row.amount + alreadyPaid > collected) throw Error('Payout exceeds the available demo balance.');
  },
  actions: [{ label: 'Mark payout simulated paid', when: row => row.status === 'Queued', run: (state, row) => revise(state, 'payouts', row.id, { status: 'Simulated paid' }) }],
  noDelete: row => row.status === 'Simulated paid',
});

resource(page, 'financeSettings', 'Fees & taxes', [
  status(currencies, 'currency', 'Currency'), amount('commission', 'Commission (%)', 0, 100),
  amount('tax', 'VAT or GST (%)', 0, 100), field('taxLabel', 'Tax label'),
  optional('invoicePrefix', 'Invoice prefix'),
], {
  rows: [{ id: 'ngn-rates', currency: 'NGN', commission: 5, tax: 7.5, taxLabel: 'Demo VAT', invoicePrefix: 'CF' }],
  validate(row, state) {
    if (rowsOf(state, 'financeSettings').some(item => item.id !== row.id && item.currency === row.currency)) throw Error('A fee configuration already exists for this currency.');
  },
});

resource(page, 'gateways', 'Payment gateways', [
  field('title', 'Gateway display name'), status(['Demo gateway', 'Paystack sandbox', 'Stripe test', 'Bank transfer demo'], 'provider', 'Provider'),
  status(currencies, 'currency', 'Settlement currency'), bool('enabled', 'Enabled in demo'),
  optional('accountAlias', 'Sandbox account alias'),
], { rows: [{ id: 'sandbox-gateway', title: 'Demo card payments', provider: 'Demo gateway', currency: 'NGN', enabled: true, accountAlias: 'confety-demo' }] });
