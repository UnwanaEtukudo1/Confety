import { resources, sections } from './catalog.mjs';
import { buildReport, deliverReport } from './analytics.mjs';
import { campaignAudience, deliverCampaign } from './comms.mjs';
import { ipMatches, scanFraud } from './security.mjs';
import { recordCheckin } from './ticketing.mjs';
import { download, downloadPdf, escape, exportTable, money, parseCsv, toCsv } from './output.mjs';
import { find, revise, rowsOf, saveRecord, timestamp, titleOf, validateBackup } from './store.mjs';

const now = () => timestamp().slice(0, 16);
const paragraph = value => '<p>' + escape(value) + '</p>';
const submit = label => `<button class="workspace-button primary" type="submit">${escape(label)}</button>`;
const formMarkup = (fields, label) => `<form class="workflow-form">${fields}<div class="dialog-actions">${submit(label)}</div></form>`;
const option = (value, title) => `<option value="${escape(value)}">${escape(title)}</option>`;
const image = (src, alt) => src ? `<img class="record-image" src="${escape(src)}" alt="${escape(alt)}">` : '';

function workflowForm(ctx, title, fields, label, action) {
  const body = ctx.modal(title, formMarkup(fields, label));
  const form = body.querySelector('form');
  const trigger = form.querySelector('[type="submit"]');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    trigger.disabled = true;
    try { await action(new FormData(form)); }
    catch (problem) { ctx.error(problem); }
    finally { trigger.disabled = false; }
  });
  return body;
}

function logDelivery(state, title, audience, event = '', count = 1) {
  saveRecord(state, 'delivery', { title, audience, event, count, channel: 'Email', date: now(), status: 'Simulated sent' });
}

function logSystem(state, title, detail, level = 'Info') {
  saveRecord(state, 'systemLogs', { title, detail, level, at: now() });
}

function need(ctx, owner) {
  if (!ctx.writeAccess(owner)) throw Error('Your demo role cannot run this action.');
}

function globalSearch(ctx) {
  const view = ctx.modal('Global search', '<label>Search events, users, and orders<input type="search" id="global-query" placeholder="Search by name or reference"></label><div id="global-results"></div>');
  const search = view.querySelector('input');
  const results = view.querySelector('#global-results');
  const refresh = () => {
    const query = search.value.trim().toLowerCase();
    const types = ['events', 'users', 'registrations', 'transactions'].filter(type => ctx.readAccess(resources[type].owner));
    const matches = types.flatMap(type => rowsOf(ctx.read(), type).filter(row =>
      [titleOf(row), row.reference, row.email].some(value => value && value.toLowerCase().includes(query))
    ).map(row => [type, row])).slice(0, 20);
    results.innerHTML = matches.length ? '<div class="action-list">' + matches.map(([type, row]) =>
      `<button data-record="${type}:${escape(row.id)}"><span>${escape(titleOf(row))}</span><small>${escape(resources[type].title)} ↗</small></button>`
    ).join('') + '</div>' : '<p class="empty-result">No matching records.</p>';
  };
  search.addEventListener('input', refresh);
  refresh();
  search.focus();
}

function demoScanner(ctx) {
  need(ctx, 'ticketing');
  let method = 'Manual';
  let stream;
  let interval;
  const dialog = ctx.$('#workspace-dialog');
  const body = workflowForm(ctx, 'Check in a demo ticket', `
    <p class="muted">Scan a QR code, upload its image, or enter a reference. Try CF-SUNSET-01.</p>
    <div class="workspace-actions">${ctx.button('Start camera', 'data-start-camera')}<label class="upload-label">Upload QR image <input type="file" accept="image/*" data-qr-image></label></div>
    <video id="scanner-video" playsinline muted hidden></video>
    <label>Ticket reference<input name="reference" required placeholder="CF-SUNSET-01"></label>
  `, 'Record check-in', async data => {
    const reference = String(data.get('reference')).trim().toUpperCase();
    await ctx.commit('ticketing', 'Recorded ' + method + ' check-in', reference, state => {
      const registration = rowsOf(state, 'registrations').find(row => row.reference.toUpperCase() === reference);
      if (!registration) throw Error('No demo registration matches this reference.');
      recordCheckin(state, registration, method);
    });
    ctx.navigate('ticketing', 'checkins');
  });
  const video = body.querySelector('video');
  const reference = body.querySelector('[name="reference"]');
  const canvas = document.createElement('canvas');
  const renderer = canvas.getContext('2d', { willReadFrequently: true });
  const stop = () => {
    clearInterval(interval);
    stream?.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    video.hidden = true;
  };
  const clean = () => {
    stop();
    dialog.removeEventListener('close', clean);
    dialog.removeEventListener('workspace-replace', clean);
  };
  dialog.addEventListener('close', clean);
  dialog.addEventListener('workspace-replace', clean);
  const decode = (source, width, height) => {
    if (!width || !height || !globalThis.jsQR) return false;
    const scale = Math.min(1, 900 / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    renderer.drawImage(source, 0, 0, canvas.width, canvas.height);
    const pixels = renderer.getImageData(0, 0, canvas.width, canvas.height);
    const code = globalThis.jsQR(pixels.data, pixels.width, pixels.height);
    if (!code?.data) return false;
    reference.value = code.data.trim();
    method = 'QR';
    stop();
    ctx.toast('QR detected. Confirm the check-in.');
    return true;
  };
  reference.addEventListener('input', () => { method = 'Manual'; });
  body.querySelector('[data-start-camera]').addEventListener('click', async event => {
    const trigger = event.currentTarget;
    trigger.disabled = true;
    try {
      if (!globalThis.jsQR) throw Error('QR decoder unavailable. Run npm install or enter the reference manually.');
      stop();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (!video.isConnected || !dialog.open) { stop(); return; }
      video.srcObject = stream;
      video.hidden = false;
      await video.play();
      interval = setInterval(() => {
        if (video.readyState >= 2) decode(video, video.videoWidth, video.videoHeight);
      }, 240);
    } catch { ctx.error('Camera unavailable. Upload a QR image or enter the ticket reference.'); }
    finally { trigger.disabled = false; }
  });
  body.querySelector('[data-qr-image]').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 10_000_000) { ctx.error('Choose an image under 10 MB.'); return; }
    if (!globalThis.jsQR) { ctx.error('QR decoder unavailable. Run npm install or enter the reference manually.'); return; }
    try {
      const bitmap = await createImageBitmap(file);
      if (!decode(bitmap, bitmap.width, bitmap.height)) ctx.error('No QR code was found in this image.');
      bitmap.close();
    } catch { ctx.error('This image could not be scanned.'); }
  });
}

function ticketPreview(ctx, template, registration) {
  const state = ctx.read();
  const event = registration ? find(state, 'events', registration.event) : null;
  const person = registration ? find(state, 'users', registration.user) : null;
  const reference = registration?.reference || 'CF-SUNSET-01';
  const qr = globalThis.qrcode?.(0, 'M');
  if (qr) { qr.addData(reference); qr.make(); }
  const body = ctx.modal('Ticket & badge preview', `
    <div class="printable-card" style="--template-color:${/^#[0-9a-f]{6}$/i.test(template.color) ? template.color : '#df83e8'}">
      ${image(template.logo, 'Template logo')}<p>CONFETY · DEMO ${escape(template.kind.toUpperCase())}</p>
      <h2>${escape(template.headline)}</h2><strong>${escape(event?.title || 'Sunset Sessions')}</strong>
      <p>${escape(person?.name || 'Demo attendee')} · ${escape(reference)}</p>
      <p>${escape(template.message)}</p>${qr ? image(qr.createDataURL(4, 12), 'QR code for ' + reference) : ''}
    </div><div class="dialog-actions">${ctx.button('Print or save as PDF', 'data-print')}${qr ? ctx.button('Download QR image', 'data-download-qr') : ''}</div>`);
  body.querySelector('[data-print]').addEventListener('click', () => window.print());
  body.querySelector('[data-download-qr]')?.addEventListener('click', async () => {
    const response = await fetch(qr.createDataURL(5, 15));
    download(reference + '.gif', await response.blob(), 'image/gif');
  });
}

function printRegistration(ctx, row) {
  const templates = rowsOf(ctx.read(), 'ticketTemplates');
  const defaultTemplate = { kind: 'Ticket', headline: 'Your next good time', message: 'Show your ticket at the door.', color: '#df83e8', logo: '' };
  if (!templates.length) return ticketPreview(ctx, defaultTemplate, row);
  return workflowForm(ctx, 'Choose a ticket design', `<label>Template<select name="template">${templates.map(template => option(template.id, template.title)).join('')}</select></label>`,
    'Preview ticket', data => ticketPreview(ctx, find(ctx.read(), 'ticketTemplates', data.get('template')), row));
}

function reportPreview(ctx, row) {
  const result = buildReport(ctx.read(), row);
  const body = ctx.modal(row.title, '<p class="muted">Filtered synthetic records. Monetary totals are shown by currency.</p>' +
    ctx.table(result.headers.map(escape), result.rows.map(row => row.map(escape))) +
    `<div class="dialog-actions">${[['csv', 'CSV'], ['excel', 'Excel'], ['pdf', 'PDF']].map(([type, label]) => ctx.button('Download ' + label, `data-report-format="${type}"`)).join('')}</div>`);
  body.querySelectorAll('[data-report-format]').forEach(button => button.addEventListener('click', () =>
    exportTable(row.title, result.headers, result.rows, button.dataset.reportFormat)));
}

function simulateLogin(ctx, config) {
  need(ctx, 'security');
  const ip = config.sourceIp;
  const rules = rowsOf(ctx.read(), 'ipRules').filter(rule => rule.enabled && ipMatches(ip, rule.network));
  const blocked = rules.some(rule => rule.action === 'Block') || (config.allowOnly && !rules.some(rule => rule.action === 'Allow'));
  const record = status => ctx.commit('security', 'Recorded demo login attempt', ip, state =>
    saveRecord(state, 'loginActivity', { title: 'Demo administrator', at: now(), ip, status }));
  if (blocked) return record('Blocked').then(() => ctx.toast('Demo sign-in blocked by IP rules.'));
  if (!config.twoFactor) return record('Simulated sign-in');
  const code = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
  return workflowForm(ctx, 'Demo two-factor challenge', `
    <p class="muted">Enter the displayed code to complete the simulated sign-in. In this demo the code is shown locally.</p>
    <p class="demo-code">${code}</p><label>Verification code<input name="code" inputmode="numeric" pattern="[0-9]{6}" required></label>`,
  'Verify code', async data => {
    if (data.get('code') !== code) throw Error('That verification code does not match.');
    await record('Simulated sign-in');
  });
}

function importRecords(ctx) {
  const definitions = Object.values(resources).filter(item => ctx.writeAccess(item.owner) &&
    !item.readOnly && !item.singleton && !item.hidden && item.id !== 'roles');
  if (!definitions.length) throw Error('This demo role cannot import records.');
  const body = workflowForm(ctx, 'Import demo records', `<p class="muted">Import a CSV or JSON array. Use the template’s field keys. For linked fields, use record IDs from the reference guide.</p>
    <label>Record type<select name="type">${definitions.map(item => option(item.id, item.title)).join('')}</select></label>
    <div class="workspace-actions">${ctx.button('Download CSV template', 'data-import-template')}${ctx.button('Download reference guide', 'data-reference-guide')}</div>
    <label>Demo file<input type="file" name="file" accept=".csv,.json" required></label>`,
  'Validate and import', async data => {
    const type = data.get('type');
    const file = data.get('file');
    if (!file?.size || file.size > 2_000_000) throw Error('Choose a CSV or JSON file under 2 MB.');
    const definition = definitions.find(item => item.id === type);
    if (!definition) throw Error('This record type is unavailable.');
    const text = await file.text();
    const rows = file.name.toLowerCase().endsWith('.json') ? JSON.parse(text) : parseCsv(text);
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 1000) throw Error('Include 1–1,000 records.');
    await ctx.commit(definition.owner, 'Imported ' + rows.length + ' demo records', definition.title, state => {
      for (const [index, row] of rows.entries()) {
        try {
          if (!row || typeof row !== 'object' || Array.isArray(row)) throw Error('Expected a record object.');
          const defaults = typeof definition.defaults === 'function' ? definition.defaults() : definition.defaults;
          const created = saveRecord(state, type, { ...defaults, ...row });
          definition.onCreate?.(state, created);
        } catch (problem) { throw Error('Row ' + (index + 1) + ': ' + problem.message); }
      }
    });
    ctx.navigate(definition.owner, type);
  });
  body.querySelector('[data-import-template]').addEventListener('click', () => {
    const type = body.querySelector('select').value;
    download(type + '-template.csv', toCsv(resources[type].fields.map(item => item.key), []), 'text/csv');
  });
  body.querySelector('[data-reference-guide]').addEventListener('click', () => {
    const type = body.querySelector('select').value;
    const references = resources[type].fields.filter(item => item.target && ctx.readAccess(resources[item.target].owner));
    const rows = references.flatMap(item => rowsOf(ctx.read(), item.target).map(row => [item.key, row.id, titleOf(row)]));
    download(type + '-references.csv', toCsv(['field', 'id', 'display name'], rows), 'text/csv');
  });
}

function exportPrivacy(ctx, row) {
  const state = ctx.read();
  const user = find(state, 'users', row.user);
  const data = {
    demo: true, user,
    bookings: rowsOf(state, 'registrations').filter(item => item.user === user.id),
    consents: rowsOf(state, 'consents').filter(item => item.user === user.id),
    support: rowsOf(state, 'support').filter(item => item.user === user.id),
  };
  return ctx.commit('security', 'Completed demo data export', titleOf(user), draft =>
    revise(draft, 'privacy', row.id, { status: 'Completed' })).then(() =>
    download('confety-demo-privacy-export.json', JSON.stringify(data, null, 2), 'application/json'));
}

function certificate(ctx, row, send) {
  const state = ctx.read();
  const registration = find(state, 'registrations', row.registration);
  const event = find(state, 'events', registration.event);
  const user = find(state, 'users', registration.user);
  return ctx.commit('feedback', send ? 'Simulated certificate delivery' : 'Issued demo certificate', row.title, draft => {
    const fresh = find(draft, 'certificates', row.id);
    if (!fresh) throw Error('The certificate is unavailable.');
    if (send && fresh.status === 'Simulated delivered') throw Error('The demo certificate has already been delivered.');
    revise(draft, 'certificates', row.id, { status: send || fresh.status === 'Simulated delivered' ? 'Simulated delivered' : 'Issued' });
    if (send) logDelivery(draft, row.title, 'Attendee', event.id);
  }).then(() => {
    if (!send) downloadPdf(row.title, ['Certificate of attendance', '', user.name, 'attended ' + event.title, 'Issued ' + row.date, 'Demo reference ' + registration.reference]);
  });
}

export function executeCommand(name, ctx, context) {
  const { row, type } = context;
  const state = ctx.read();
  switch (name) {
    case 'search': return globalSearch(ctx);
    case 'checkin': return demoScanner(ctx);
    case 'template': return ticketPreview(ctx, row);
    case 'registration-ticket': return printRegistration(ctx, row);
    case 'invoice': {
      const settings = rowsOf(state, 'financeSettings').find(item => item.currency === row.currency);
      return downloadPdf((settings?.invoicePrefix || 'CF') + ' demo invoice ' + row.reference, [
        'Transaction: ' + row.reference, 'Date: ' + row.date, 'Status: ' + row.status,
        'Gross amount: ' + money(row.amount, row.currency), 'Refunds: ' + money(row.refunded, row.currency),
        'Platform fee: ' + money(row.fee, row.currency), (settings?.taxLabel || 'Tax') + ': ' + money(row.tax, row.currency),
        'Demo invoice for preview only.',
      ]);
    }
    case 'reset-password':
      return ctx.confirm('Request a demo reset', 'Queue a simulated reset for ' + row.name + '.', () =>
        ctx.commit('users', 'Simulated password reset request', row.name, draft =>
          logDelivery(draft, 'Password reset request · ' + row.name, row.role)));
    case 'impersonate':
      return ctx.commit('users', 'Opened simulated user view', row.name, () => {}, { close: false }).then(() => {
        const bookings = rowsOf(ctx.read(), 'registrations').filter(item => item.user === row.id);
        ctx.modal('Viewing as ' + row.name, '<p class="muted">Read-only demo customer view. End this preview to return to administration.</p>' +
          ctx.table(['Booking', 'Quantity', 'Status'], bookings.map(item => [escape(item.reference), item.quantity, escape(item.status)])) +
          `<div class="dialog-actions">${ctx.button('End demo preview', 'data-close')}</div>`);
      });
    case 'role-preview': {
      const choices = rowsOf(state, 'roles');
      return workflowForm(ctx, 'Preview access by role',
        `<p class="muted">Try local section permissions. Super admin restores the full demo.</p><label>Demo role<select name="role">
        ${option('super', 'Super admin')}${choices.map(item => option(item.id, item.title)).join('')}</select></label>`,
        'Switch preview role', data => ctx.setRole(data.get('role')));
    }
    case 'seating':
      return ctx.modal(row.title, image(row.image, 'Floor plan') + '<div class="seat-preview"><p>Stage</p>' +
        row.seating.split('\n').filter(Boolean).map(line => {
          const [label, capacity] = line.split(':');
          return `<div><strong>${escape(label)}</strong><small>${escape(capacity)} seats</small></div>`;
        }).join('') + '</div>');
    case 'run-due-campaigns':
      need(ctx, 'comms');
      return workflowForm(ctx, 'Run due demo messages', '<label>Simulated cutoff (WAT)<input type="datetime-local" name="cutoff" required value="2026-11-14T12:00"></label>',
        'Process due campaigns', async data => {
          const cutoff = String(data.get('cutoff'));
          await ctx.commit('comms', 'Processed due demo messages', cutoff, draft => {
            const due = rowsOf(draft, 'campaigns').filter(item => item.status === 'Scheduled' && item.scheduled <= cutoff);
            if (!due.length) throw Error('No scheduled campaigns are due by this time.');
            const utc = new Date(Date.parse(cutoff + '+01:00')).toISOString().slice(0, 16);
            for (const campaign of due) deliverCampaign(draft, campaign, utc);
          });
        });
    case 'campaign-preview': {
      const recipients = campaignAudience(state, row);
      const template = find(state, 'templates', row.template);
      return ctx.modal(row.title, paragraph(row.channel + ' · ' + recipients.length + ' active recipients') +
        (template ? `<h3>${escape(template.subject)}</h3>` : '') + paragraph(row.body || template?.body || ''));
    }
    case 'tracking': {
      const url = new URL(row.url);
      for (const field of ['source', 'medium', 'campaign', 'content']) if (row[field]) url.searchParams.set('utm_' + field, row[field]);
      const body = ctx.modal('Share link', `<label>Tracked URL<input value="${escape(url.href)}" readonly></label><div class="dialog-actions">${ctx.button('Copy link', 'data-copy')}</div>`);
      body.querySelector('[data-copy]').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(url.href); ctx.toast('Tracked link copied'); }
        catch { body.querySelector('input').select(); ctx.error('Copy the selected link using your keyboard.'); }
      });
      return;
    }
    case 'page-preview':
      return ctx.modal(row.title, `<article class="page-preview">${image(row.banner || row.image, 'Cover image')}
        <h2>${escape(row.headline || row.title)}</h2>${paragraph(row.body || '')}
        ${row.slug ? paragraph('Preview slug /' + row.slug) : ''}
        ${row.metaTitle ? paragraph('SEO title · ' + row.metaTitle) + paragraph(row.metaDescription) : ''}</article>`);
    case 'historical':
      if (!ctx.readAccess('analytics')) throw Error('The analytics section is restricted.');
      location.href = '/admin/history';
      return;
    case 'report': return reportPreview(ctx, row);
    case 'report-send':
      return ctx.confirm('Simulate scheduled report', 'Log the demo report email for ' + row.recipient + '.', () =>
        ctx.commit('analytics', 'Simulated scheduled report email', row.title, draft => {
          const fresh = find(draft, 'savedReports', row.id);
          if (!fresh || fresh.cadence === 'On demand') throw Error('This report is no longer scheduled.');
          deliverReport(draft, fresh, now());
        }));
    case 'run-due-reports':
      need(ctx, 'analytics');
      return workflowForm(ctx, 'Run due report emails', '<label>Simulated cutoff date<input type="date" name="cutoff" required value="2026-11-06"></label>',
        'Process due reports', async data => {
          const cutoff = String(data.get('cutoff'));
          await ctx.commit('analytics', 'Processed scheduled demo reports', cutoff, draft => {
            const due = rowsOf(draft, 'savedReports').filter(item => item.cadence !== 'On demand' && item.nextRun <= cutoff);
            if (!due.length) throw Error('No scheduled reports are due by this date.');
            for (const report of due) deliverReport(draft, report, cutoff + 'T09:00');
          });
        });
    case 'poll': {
      const choices = row.choices.split(',').map(value => value.trim()).filter(Boolean);
      const counts = choices.map(choice => [escape(choice), rowsOf(state, 'votes').filter(vote => vote.poll === row.id && vote.choice === choice).length]);
      const chart = ctx.table(['Choice', 'Votes'], counts);
      if (row.status !== 'Live') return ctx.modal(row.title, chart + paragraph('Voting is closed.'));
      return workflowForm(ctx, row.title, chart + `<label>Demo choice<select name="choice">${choices.map(choice => option(choice, choice)).join('')}</select></label>`,
        'Cast demo vote', async data => {
          await ctx.commit('feedback', 'Recorded demo poll vote', row.title, draft =>
            saveRecord(draft, 'votes', { poll: row.id, choice: data.get('choice') }), { close: false });
          executeCommand('poll', ctx, { row: find(ctx.read(), 'polls', row.id) });
        });
    }
    case 'certificate': return certificate(ctx, row, false);
    case 'certificate-send':
      return ctx.confirm('Simulate certificate delivery', 'Add a demo email delivery to the log.', () => certificate(ctx, row, true));
    case 'brand-preview': {
      const locales = rowsOf(state, 'localizations').filter(item => item.language === row.language && item.status === 'Ready');
      return ctx.modal('Brand and localization preview', `<article class="printable-card" style="--template-color:${/^#[0-9a-f]{6}$/i.test(row.color) ? row.color : '#df83e8'}">
        ${image(row.logo, 'Workspace logo')}<h2>${escape(row.title)}</h2>${paragraph([row.language, row.timezone, row.currency].join(' · '))}
        ${paragraph(row.whiteLabel ? row.domain || 'White-label demo' : 'Confety branded preview')}
        ${locales.map(item => paragraph(item.text)).join('')}</article>`);
    }
    case 'integration-test':
      return ctx.commit('settings', 'Simulated integration connection', row.title, draft => {
        revise(draft, 'integrations', row.id, { status: 'Simulated connected' });
        logSystem(draft, row.title, 'Local connection test for ' + row.kind + '.');
      });
    case 'demo-key':
      return ctx.modal('Demo key identifier', paragraph(row.status === 'Active' ? 'cf_demo_' + row.id.replaceAll('-', '') : 'This demo key is revoked.'));
    case 'webhook-test':
      return ctx.commit('settings', 'Simulated webhook delivery', row.title, draft => logSystem(draft, row.topic, 'Simulated HTTP 200 for ' + row.endpoint));
    case 'fraud-scan':
      return ctx.commit('security', 'Scanned demo fraud signals', 'Payment ledger', scanFraud).then(count =>
        ctx.toast(count ? count + ' new fraud flags' : 'No new repeated-payment flags'));
    case 'test-signin': return simulateLogin(ctx, row);
    case 'privacy-export': return exportPrivacy(ctx, row);
    case 'privacy-delete':
      return ctx.confirm('Apply demo deletion request', 'Anonymize the fictional profile and clear linked private notes. Booking totals and references are retained.', () =>
        ctx.commit('security', 'Applied demo deletion request', 'Synthetic account', draft => {
          const user = find(draft, 'users', row.user);
          if (user.id === 'maya') throw Error('The demo owner cannot be anonymized.');
          const label = 'Anonymized ' + user.id.slice(0, 12);
          for (const entry of draft.audit.filter(entry => entry.target === user.name)) entry.target = label;
          revise(draft, 'users', user.id, { name: label, email: 'removed-' + user.id + '@example.test', city: 'Anonymized', status: 'Suspended', notes: '' });
          for (const caseRow of rowsOf(draft, 'support').filter(item => item.user === user.id)) {
            Object.assign(caseRow, { title: 'Anonymized support case', message: 'Removed in demo deletion workflow.', reply: '' });
          }
          for (const booking of rowsOf(draft, 'registrations').filter(item => item.user === user.id)) booking.answers = '';
          draft.records.consents = rowsOf(draft, 'consents').filter(item => item.user !== user.id);
          revise(draft, 'privacy', row.id, { status: 'Completed', notes: 'Demo profile anonymized.' });
        }));
    case 'backup':
      if (ctx.role() !== 'super') throw Error('Demo backups require the super admin role.');
      return download('confety-demo-backup.json', JSON.stringify(state, null, 2), 'application/json');
    case 'restore':
      if (ctx.role() !== 'super') throw Error('Demo restore requires the super admin role.');
      return workflowForm(ctx, 'Restore demo backup', '<p class="muted">The selected file replaces the local demo records after validation.</p><label>Confety backup<input type="file" name="file" accept=".json" required></label>',
        'Validate backup', async data => {
          const file = data.get('file');
          if (!file?.size || file.size > 6_000_000) throw Error('Choose a JSON backup under 6 MB.');
          const backup = validateBackup(JSON.parse(await file.text()));
          ctx.confirm('Replace local demo records', 'Restore the validated snapshot?', () => ctx.commit('security', 'Restored demo backup', 'Workspace', draft => {
            draft.records = backup.records;
            draft.audit = backup.audit;
          }));
        });
    case 'migration': return importRecords(ctx);
    case 'help':
      return ctx.modal('Workspace help', '<p>Use the sidebar to open a section, then choose a record type. Search or filter each table and open a record to see the available actions.</p><ul><li>Reports and exports use synthetic data.</li><li>Role preview changes visible sections and edit access.</li><li>Export a demo backup before testing imports or restoring records.</li></ul>' +
        `<div class="dialog-actions">${ctx.button('Open support inbox', 'data-nav="comms" data-resource="support"')}</div>`);
    default: throw Error('This demo action is unavailable.');
  }
}
