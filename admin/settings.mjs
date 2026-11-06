import { bool, currencies, field, optional, resource, section, status } from './catalog.mjs';

const page = section('settings', 'Platform settings', '⚙', 'Set branding, localization, policy text, and sandbox integrations.');

resource(page, 'branding', 'Branding & defaults', [
  field('title', 'Workspace name'), optional('logo', 'Logo', 'media'), field('color', 'Accent color', 'color'),
  status(['Africa/Lagos', 'UTC', 'Europe/London', 'America/New_York'], 'timezone', 'Default time zone'),
  status(['English', 'French', 'Yoruba', 'Igbo', 'Hausa'], 'language', 'Default locale'),
  status(currencies, 'currency', 'Default currency'), bool('whiteLabel', 'White-label preview'),
  optional('domain', 'Custom domain for preview'),
], {
  singleton: true, columns: ['title', 'timezone', 'language', 'currency'],
  rows: [{ id: 'brand', title: 'Confety', logo: '', color: '#e28ce9', timezone: 'Africa/Lagos', language: 'English', currency: 'NGN', whiteLabel: false, domain: '' }],
  validate(row) {
    if (row.domain && !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(row.domain)) throw Error('Enter a domain name without a protocol or path.');
  },
  actions: [{ label: 'Preview white-label branding', command: 'brand-preview' }],
});

resource(page, 'localizations', 'Localized content', [
  field('title', 'Content label'), status(['English', 'French', 'Yoruba', 'Igbo', 'Hausa'], 'language', 'Language'),
  field('key', 'Translation key'), field('text', 'Translated text', 'textarea'), status(['Draft', 'Ready']),
], { rows: [{ id: 'locale-fr', title: 'Event welcome', language: 'French', key: 'event.welcome', text: 'Bienvenue à notre événement.', status: 'Ready' }] });

resource(page, 'providers', 'Email & SMS providers', [
  field('title', 'Provider name'), status(['Email', 'SMS'], 'channel', 'Channel'),
  field('sender', 'Demo sender'), optional('sandboxAlias', 'Sandbox account alias'), bool('enabled', 'Enabled in demo'),
], { rows: [{ id: 'provider-mail', title: 'Local mail simulator', channel: 'Email', sender: 'events@example.test', sandboxAlias: 'confety-demo', enabled: true }] });

resource(page, 'integrations', 'Third-party integrations', [
  field('title', 'Integration name'),
  status(['Calendar sync', 'CRM', 'Zoom', 'Microsoft Teams', 'Analytics', 'Zapier'], 'kind', 'Integration type'),
  optional('sandboxAlias', 'Demo connection alias'), status(['Disconnected', 'Sandbox configured', 'Simulated connected']),
], {
  rows: [{ id: 'calendar', title: 'Confety calendar', kind: 'Calendar sync', sandboxAlias: 'demo-calendar', status: 'Sandbox configured' }],
  actions: [{ label: 'Test demo connection', command: 'integration-test' }],
});

resource(page, 'apiKeys', 'Demo API keys', [
  field('title', 'Key label'), field('scope', 'Scope'), status(['Active', 'Revoked']),
], {
  defaults: { status: 'Active' },
  actions: [{ label: 'Reveal demo key identifier', command: 'demo-key' }],
});

resource(page, 'webhooks', 'Webhooks', [
  field('title', 'Webhook name'), field('endpoint', 'Sandbox endpoint', 'url'),
  status(['event.published', 'order.created', 'refund.approved', 'checkin.recorded'], 'topic', 'Event topic'),
  bool('enabled', 'Enabled in demo'),
], { actions: [{ label: 'Simulate webhook delivery', command: 'webhook-test', when: row => row.enabled }] });

resource(page, 'policies', 'Platform policies', [
  field('title', 'Policy name'), status(['Terms', 'Cancellation', 'Refund'], 'kind', 'Policy type'),
  field('body', 'Preview policy text', 'textarea'), status(['Draft', 'Preview published']),
], { rows: [{ id: 'refund-policy', title: 'Demo refund policy', kind: 'Refund', body: 'All payments on this workspace are simulated.', status: 'Draft' }], actions: [{ label: 'Preview policy', command: 'page-preview' }] });
