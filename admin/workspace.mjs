import './dashboard.mjs';
import './events.mjs';
import './ticketing.mjs';
import './finance.mjs';
import './users.mjs';
import './roles.mjs';
import './venues.mjs';
import './partners.mjs';
import './comms.mjs';
import './marketing.mjs';
import './analytics.mjs';
import './content.mjs';
import './feedback.mjs';
import './settings.mjs';
import './security.mjs';
import './system.mjs';

import { resources, sections } from './catalog.mjs';
import { can, createStore, find, removeRecord, revise, rowsOf, saveRecord, signedInKey, STORAGE_KEY, titleOf } from './store.mjs';
import { escape, exportTable, money } from './output.mjs';
import { executeCommand } from './workflows.mjs';

const $ = selector => document.querySelector(selector);
const store = createStore();
const dialog = $('#workspace-dialog');
const page = $('#workspace-page');
let state = store.read();
let role = sessionStorage.getItem(signedInKey) || 'super';
let activePage = 'dashboard';
let activeResource = '';
let toastTimer;
const selections = new Set();
const filters = { query: '', status: '', page: 0 };

function button(label, attributes = '', primary = false) {
  return `<button type="button" class="workspace-button${primary ? ' primary' : ''}" ${attributes}>${escape(label)}</button>`;
}

function panel(title, content) {
  return `<section class="workspace-panel"><h2>${escape(title)}</h2>${content}</section>`;
}

function table(headers, rows) {
  if (!rows.length) return '<p class="empty-result">No records match this view.</p>';
  return `<div class="workspace-table" role="region" aria-label="${escape(headers[0])} table" tabindex="0"><table>
    <thead><tr>${headers.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function kpis(items) {
  return `<div class="workspace-kpis">${items.map(([label, value, note]) => `
    <article><span>${escape(label)}</span><strong>${escape(value)}</strong><small>${escape(note)}</small></article>
  `).join('')}</div>`;
}

function bars(entries) {
  if (!entries.length) return '<p class="empty-result">No activity to chart.</p>';
  const maximum = Math.max(...entries.map(([, value]) => value), 1);
  return `<ul class="workspace-bars">${entries.map(([label, value]) => `<li>
    <span>${escape(label)}</span><i aria-hidden="true"><b style="width:${value / maximum * 100}%"></b></i><strong>${escape(value)}</strong>
  </li>`).join('')}</ul>`;
}

function readAccess(owner) { return can(state, role, owner, 'read'); }
function writeAccess(owner) { return can(state, role, owner); }

function navigate(owner, resource = '', changeUrl = true, initialStatus = '') {
  if (!sections.some(item => item.id === owner) || !readAccess(owner)) owner = sections.find(item => readAccess(item.id))?.id || 'dashboard';
  activePage = owner;
  activeResource = resources[resource]?.owner === owner && !resources[resource].hidden ? resource : '';
  selections.clear();
  Object.assign(filters, { query: '', status: initialStatus, page: 0 });
  if (changeUrl) history.replaceState(null, '', '#' + [owner, activeResource].filter(Boolean).join('/'));
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function statusBadge(value) {
  const state = /active|approved|confirmed|paid|published|verified|resolved|completed|issued|sent/i.test(value) ? 'good'
    : /cancelled|failed|rejected|banned|blocked|high/i.test(value) ? 'bad' : 'neutral';
  return `<span class="record-status ${state}">${escape(value)}</span>`;
}

function visibleFields(definition) {
  return (definition.columns || definition.fields.map(item => item.key).slice(0, 6))
    .map(key => definition.fields.find(item => item.key === key)).filter(Boolean);
}

function rawValue(item, row) {
  if (item.type === 'ref') {
    const target = resources[item.target];
    if (!row[item.key]) return '';
    return readAccess(target.owner) ? titleOf(find(state, item.target, row[item.key])) : 'Restricted';
  }
  if (item.type === 'boolean') return row[item.key] ? 'Yes' : 'No';
  return row[item.key] ?? '';
}

function displayValue(item, row) {
  const value = rawValue(item, row);
  if (item.key === 'status' && value) return statusBadge(value);
  if (item.type === 'media') return value ? 'Image set' : '—';
  if (item.type === 'number' && row.currency && ['price', 'amount', 'refunded'].includes(item.key)) return escape(money(value, row.currency));
  return escape(value === '' ? '—' : String(value).replace('T', item.type === 'datetime-local' ? ' ' : 'T'));
}

function matchingRows(definition) {
  return rowsOf(state, definition.id).filter(row => (!filters.status || row.status === filters.status) &&
    (!filters.query || [row.id, ...definition.fields.filter(item => item.type !== 'media').map(item => rawValue(item, row))]
      .some(value => String(value).toLowerCase().includes(filters.query.toLowerCase()))));
}

function renderTable(definition) {
  const view = $('#resource-table');
  const rows = matchingRows(definition);
  const cols = visibleFields(definition);
  const selectable = writeAccess(definition.owner) && definition.bulkStatus;
  filters.page = Math.min(filters.page, Math.max(0, Math.ceil(rows.length / 25) - 1));
  const visible = rows.slice(filters.page * 25, (filters.page + 1) * 25);
  const headers = [...(selectable ? ['Select'] : []), ...cols.map(item => escape(item.label)), 'Details'];
  view.innerHTML = table(headers, visible.map(row => [
    ...(selectable ? [`<input type="checkbox" data-select-row="${escape(row.id)}" aria-label="Select ${escape(titleOf(row))}" ${selections.has(row.id) ? 'checked' : ''}>`] : []),
    ...cols.map(item => displayValue(item, row)),
    button('Open', `data-record="${definition.id}:${escape(row.id)}"`),
  ])) + `<div class="table-meta"><span>${rows.length} records${selections.size ? ' · ' + selections.size + ' selected' : ''}</span>
    ${rows.length > 25 ? `<div>${button('Previous', `data-paging="-1" ${filters.page === 0 ? 'disabled' : ''}`)}
    ${button('Next', `data-paging="1" ${(filters.page + 1) * 25 >= rows.length ? 'disabled' : ''}`)}</div>` : ''}</div>`;
  const bulk = $('#bulk-actions');
  if (bulk) bulk.hidden = !selections.size;
}

function render() {
  $('#role-chip').textContent = role === 'super' ? 'Super admin' : titleOf(find(state, 'roles', role));
  const access = sections.filter(item => readAccess(item.id));
  $('#section-nav').innerHTML = access.map(item => `<button type="button" data-nav="${item.id}" ${activePage === item.id ? 'aria-current="page"' : ''}>
    <span aria-hidden="true">${item.icon}</span> ${escape(item.title)}
  </button>`).join('');
  const current = access.find(item => item.id === activePage);
  if (!current) { page.innerHTML = panel('No section access', '<p>Use the demo role control to return to the super admin view.</p>'); return; }
  const all = current.resources.filter(id => !resources[id].hidden);
  const definition = resources[activeResource || all[0]];
  const position = sections.indexOf(current) + 1;
  page.innerHTML = `<section class="workspace-heading">
      <div class="workspace-eyebrow">ADMINISTRATION <span>·</span> ${String(position).padStart(2, '0')} / 16</div>
      <h1>${escape(current.title)}</h1><p>${escape(current.description)}</p>
      ${current.actions ? `<div class="workspace-actions">${current.actions.map(action =>
        button(action.label, action.nav ? `data-nav="${action.nav}" data-resource="${action.resource || ''}"` : `data-command="${action.command}"`)).join('')}</div>` : ''}
    </section>
    ${!activeResource && current.view ? current.view({ state, panel, kpis, table, bars, money, escape, readAccess }) : ''}
    ${definition ? `<section class="workspace-panel record-panel">
      <nav class="resource-tabs" aria-label="Record types">${all.map(id => `<button type="button" data-nav="${current.id}" data-resource="${id}" ${definition.id === id ? 'aria-current="page"' : ''}>${escape(resources[id].title)} <small>${rowsOf(state, id).length}</small></button>`).join('')}</nav>
      <div class="records-heading"><h2>${escape(definition.title)}</h2><div class="workspace-actions">
        ${writeAccess(definition.owner) && !definition.readOnly && !definition.singleton ? button('＋ Add record', `data-create="${definition.id}"`, true) : ''}
        ${definition.importable && writeAccess(definition.owner) ? button('Import', 'data-command="migration"') : ''}
        ${button('CSV', 'data-export="csv"')}${button('Excel', 'data-export="excel"')}
      </div></div>
      <div class="record-filters"><label>Search records <input id="record-query" type="search" value="${escape(filters.query)}" placeholder="Search this table"></label>
        ${definition.fields.some(item => item.key === 'status') ? `<label>Status <select id="record-status"><option value="">All statuses</option>${definition.fields.find(item => item.key === 'status').values.map(value => `<option ${filters.status === value ? 'selected' : ''}>${escape(value)}</option>`).join('')}</select></label>` : ''}
        ${definition.bulkStatus && writeAccess(definition.owner) ? `<div id="bulk-actions" hidden>${button('Change selected status', 'data-bulk="status"')}${definition.bulkFields ? button('Edit selected', 'data-bulk="edit"') : ''}${definition.id === 'users' ? button('Queue selected email', 'data-bulk="email"') : ''}</div>` : ''}
      </div>
      <div id="resource-table"></div></section>` : ''}`;
  if (definition) renderTable(definition);
}

function currentDefinition() {
  const current = sections.find(item => item.id === activePage);
  return resources[activeResource || current.resources.find(id => !resources[id].hidden)];
}

function toast(message) {
  const target = $('#workspace-toast');
  target.textContent = message;
  target.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => target.classList.remove('visible'), 3600);
}

function modal(title, body) {
  if (dialog.open) dialog.dispatchEvent(new Event('workspace-replace'));
  $('#dialog-title').textContent = title;
  $('#dialog-body').innerHTML = body;
  $('#dialog-error').hidden = true;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  return $('#dialog-body');
}

function error(message) {
  const element = $('#dialog-error');
  element.textContent = message?.message || String(message);
  element.hidden = false;
}

function confirm(title, description, action) {
  const body = modal(title, `<p>${escape(description)}</p><div class="dialog-actions">${button('Cancel', 'data-close')}${button('Confirm demo action', 'data-confirm', true)}</div>`);
  const trigger = body.querySelector('[data-confirm]');
  trigger.addEventListener('click', async () => {
    trigger.disabled = true;
    try { await action(); } catch (problem) { error(problem); trigger.disabled = false; }
  });
}

async function commit(owner, action, target, apply, { close = true } = {}) {
  const result = await store.change(role, owner, action, target, apply);
  state = store.read();
  if (close && dialog.open) dialog.close();
  render();
  toast(action);
  return result;
}

function permissionFields(item, value) {
  const current = new Set(String(value || '').split(','));
  return `<fieldset class="editor-wide permission-fields"><legend>${escape(item.label)}</legend>
    ${sections.map(entry => `<div><span>${escape(entry.title)}</span>${['read', 'write'].map(mode => {
      const permission = entry.id + ':' + mode;
      return `<label><input type="checkbox" name="${item.key}" value="${permission}" ${current.has(permission) ? 'checked' : ''}> ${mode}</label>`;
    }).join('')}</div>`).join('')}</fieldset>`;
}

function inputMarkup(item, value) {
  const name = escape(item.key);
  const label = escape(item.label);
  const required = item.optional ? '' : 'required';
  const safe = escape(value);
  if (item.type === 'permissions') return permissionFields(item, value);
  if (item.type === 'boolean') return `<label class="editor-checkbox"><input type="checkbox" name="${name}" ${value ? 'checked' : ''}> ${label}</label>`;
  if (item.type === 'textarea') return `<label class="editor-wide">${label}<textarea name="${name}" rows="4" ${required}>${safe}</textarea></label>`;
  if (item.type === 'media') return `<label class="editor-wide">${label}<input type="text" name="${name}" value="${safe}" placeholder="Image URL or choose a file">
    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-media-field="${name}"></label>`;
  if (item.type === 'ref' || item.type === 'select') {
    const entries = item.type === 'ref'
      ? rowsOf(state, item.target).map(row => [row.id, readAccess(resources[item.target].owner) ? titleOf(row) : row.id])
      : item.values.map(value => [value, value]);
    return `<label>${label}<select name="${name}" ${required}><option value="">${item.optional ? 'None' : 'Choose…'}</option>
      ${entries.map(([id, text]) => `<option value="${escape(id)}" ${id === value ? 'selected' : ''}>${escape(text)}</option>`).join('')}</select></label>`;
  }
  const limits = item.type === 'number' ? `min="${item.min ?? 0}" max="${item.max ?? 1e9}" step="${item.integer ? 1 : '0.01'}"` : '';
  return `<label>${label}<input type="${item.type}" name="${name}" value="${safe}" ${required} ${limits}></label>`;
}

function editor(type, row = null, prefill = {}) {
  const definition = resources[type];
  if (!definition || !writeAccess(definition.owner) || definition.readOnly) { toast('This demo role cannot edit these records.'); return; }
  const defaults = typeof definition.defaults === 'function' ? definition.defaults() : definition.defaults;
  const values = { ...defaults, ...row, ...prefill };
  const body = modal((row ? 'Edit · ' : 'New · ') + definition.title, `<form id="record-form">
    <div class="editor-grid">${definition.fields.map(item => inputMarkup(item, values[item.key] ?? '')).join('')}</div>
    <div class="dialog-actions">${button('Cancel', 'data-close')}<button class="workspace-button primary" type="submit">Save record</button></div>
  </form>`);
  const form = body.querySelector('form');
  const submit = form.querySelector('[type="submit"]');
  form.querySelectorAll('[data-media-field]').forEach(input => input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 1_000_000) { error('Choose an image smaller than 1 MB.'); input.value = ''; return; }
    const reader = new FileReader();
    submit.disabled = true;
    reader.onload = () => { form.elements[input.dataset.mediaField].value = reader.result; submit.disabled = false; };
    reader.onerror = () => { error('The image could not be read.'); submit.disabled = false; };
    reader.readAsDataURL(file);
  }));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const input = Object.fromEntries(definition.fields.map(item => [item.key,
      item.type === 'permissions' ? data.getAll(item.key).join(',') : data.get(item.key)]));
    submit.disabled = true;
    try {
      await commit(definition.owner, row ? 'Updated demo record' : 'Created demo record', titleOf({ ...values, ...input }), draft => {
        if (row && find(draft, type, row.id)?.updatedAt !== row.updatedAt) {
          throw Error('Another change was saved to this record. Reopen it before editing.');
        }
        const created = saveRecord(draft, type, input, row?.id);
        if (!row) definition.onCreate?.(draft, created);
      });
      navigate(definition.owner, type);
    } catch (problem) { error(problem); submit.disabled = false; }
  });
}

function openRecord(type, id) {
  const definition = resources[type];
  const row = find(state, type, id);
  if (!definition || !row || definition.hidden || !readAccess(definition.owner)) { toast('This record is unavailable for the current demo role.'); return; }
  const writable = writeAccess(definition.owner);
  const actions = (definition.actions || []).map((action, index) => ({ action, index }))
    .filter(({ action }) => (!action.when || action.when(row)) && (writable || action.readOnly) && (!action.create || writeAccess(resources[action.create].owner)));
  const detail = `<dl class="record-detail">${definition.fields.map(item => `<div><dt>${escape(item.label)}</dt><dd>${
    item.type === 'media' && row[item.key] ? `<img class="record-image" src="${escape(row[item.key])}" alt="${escape(item.label)}">` : displayValue(item, row)
  }</dd></div>`).join('')}</dl>`;
  const related = type === 'users' ? userActivity(row) : '';
  modal(titleOf(row), detail + related + `<div class="dialog-actions">
    ${writable && !definition.readOnly ? button('Edit', `data-edit="${type}:${escape(id)}"`, true) : ''}
    ${writable && !definition.readOnly && !definition.singleton ? button('Duplicate', `data-duplicate="${type}:${escape(id)}"`) : ''}
    ${actions.map(({ action, index }) => button(action.label, `data-action="${type}:${escape(id)}:${index}"`)).join('')}
    ${writable && !definition.readOnly && !definition.singleton && !definition.noDelete?.(row) ? button('Delete', `data-remove="${type}:${escape(id)}"`) : ''}
  </div>`);
}

function userActivity(row) {
  const bookings = readAccess('ticketing') ? rowsOf(state, 'registrations').filter(item => item.user === row.id) : [];
  const activity = state.audit.filter(item => item.target === row.name).slice(0, 5);
  return '<h3>Booking history</h3>' + table(['Reference', 'Event', 'Status'], bookings.map(item => [
    escape(item.reference), escape(readAccess('events') ? titleOf(find(state, 'events', item.event)) : 'Restricted'), statusBadge(item.status),
  ])) + '<h3>Recent administrative activity</h3>' + table(['Action', 'Time'], activity.map(item => [
    escape(item.action), escape(item.at.slice(0, 16)),
  ]));
}

function bulk(kind) {
  const definition = currentDefinition();
  const ids = [...selections];
  if (!ids.length || !definition?.bulkStatus || !writeAccess(definition.owner)) return;
  if (kind === 'edit' && definition.bulkFields) {
    const fields = definition.fields.filter(item => definition.bulkFields.includes(item.key));
    const body = modal('Edit ' + ids.length + ' selected records',
      `<form><label>Field to update<select name="key">${fields.map(item => `<option value="${item.key}">${escape(item.label)}</option>`).join('')}</select></label><div id="bulk-field"></div><button class="workspace-button primary">Apply edit</button></form>`);
    const form = body.querySelector('form');
    const refresh = () => {
      body.querySelector('#bulk-field').innerHTML = inputMarkup(fields.find(item => item.key === form.elements.key.value), '');
    };
    form.elements.key.addEventListener('change', refresh);
    refresh();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(form);
      const key = data.get('key');
      if (!definition.bulkFields.includes(key)) return;
      const trigger = form.querySelector('button');
      trigger.disabled = true;
      try {
        await commit(definition.owner, 'Edited ' + ids.length + ' demo records', definition.title, draft => {
          for (const id of ids) revise(draft, definition.id, id, { [key]: data.get(key) });
        });
        selections.clear();
        render();
      } catch (problem) { error(problem); trigger.disabled = false; }
    });
    return;
  }
  const choices = definition.fields.find(item => item.key === 'status')?.values || [];
  const body = modal('Update ' + ids.length + ' selected records', kind === 'email'
    ? '<form><label>Demo message<textarea name="message" required rows="4"></textarea></label><button class="workspace-button primary">Simulate email</button></form>'
    : `<form><label>New status<select name="status">${choices.map(value => `<option>${escape(value)}</option>`).join('')}</select></label><button class="workspace-button primary">Apply status</button></form>`);
  body.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      if (kind === 'email') {
        await commit('comms', 'Simulated bulk email', 'Selected users', draft => {
          const count = rowsOf(draft, 'users').filter(row => ids.includes(row.id) && row.status === 'Active').length;
          if (!count) throw Error('No selected users are active.');
          saveRecord(draft, 'delivery', { title: String(data.get('message')).slice(0, 100), audience: 'Selected users', channel: 'Email', event: '', date: new Date().toISOString().slice(0, 16), status: 'Simulated sent', count });
        });
      } else {
        await commit(definition.owner, 'Changed status for ' + ids.length + ' records', definition.title, draft => {
          for (const id of ids) revise(draft, definition.id, id, { status: data.get('status') });
        });
      }
      selections.clear();
      render();
    } catch (problem) { error(problem); }
  });
}

const ctx = {
  $ , button, table, modal, error, confirm, commit, toast, navigate, openRecord, editor,
  read: () => state, role: () => role, readAccess, writeAccess,
  setRole(next) {
    role = next;
    sessionStorage.setItem(signedInKey, next);
    if (dialog.open) dialog.close();
    navigate('dashboard');
  },
};

function command(name, context = {}) {
  try { return Promise.resolve(executeCommand(name, ctx, context)).catch(problem => dialog.open ? error(problem) : toast(problem.message)); }
  catch (problem) { if (dialog.open) error(problem); else toast(problem.message); }
}

document.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;
  const data = target.dataset;
  if ('close' in data) { dialog.close(); return; }
  if (data.nav) { if (dialog.open) dialog.close(); navigate(data.nav, data.resource, true, data.filterStatus || ''); return; }
  if (data.command) { command(data.command); return; }
  if (data.create) { editor(data.create); return; }
  if (data.record) { openRecord(...data.record.split(':')); return; }
  if (data.paging) { filters.page += Number(data.paging); renderTable(currentDefinition()); return; }
  if (data.bulk) { bulk(data.bulk); return; }
  if (data.export) {
    const definition = currentDefinition();
    const cols = visibleFields(definition);
    return exportTable(definition.title, cols.map(item => item.label),
      matchingRows(definition).map(row => cols.map(item => rawValue(item, row))), data.export);
  }
  const recordAction = data.edit || data.duplicate || data.remove || data.action;
  if (!recordAction) return;
  const [type, id, index] = recordAction.split(':');
  const definition = resources[type];
  const row = find(state, type, id);
  if (!row || !writeAccess(definition.owner)) { toast('Your demo role cannot change this record.'); return; }
  if (data.edit) editor(type, row);
  if (data.duplicate) {
    const values = { ...row };
    for (const key of ['title', 'name', 'reference']) if (values[key]) values[key] += ' copy';
    if (type === 'events') Object.assign(values, { status: 'Draft', featured: false, promoted: false });
    editor(type, null, values);
  }
  if (data.remove) confirm('Delete demo record', 'Delete ' + titleOf(row) + ' from the local workspace?', () =>
    commit(definition.owner, 'Deleted demo record', titleOf(row), draft => {
      const fresh = find(draft, type, id);
      if (!fresh || definition.noDelete?.(fresh)) throw Error('This record cannot be deleted.');
      removeRecord(draft, type, id);
    }));
  if (data.action) {
    const action = definition.actions?.[Number(index)];
    if (!action || action.when && !action.when(row)) return;
    if (action.create) editor(action.create, null, action.prefill?.(row));
    if (action.command) command(action.command, { type, row });
    if (action.run) confirm(action.label, 'Apply this change to ' + titleOf(row) + ' in the demo?', () =>
      commit(definition.owner, action.label, titleOf(row), draft => {
        const fresh = find(draft, type, id);
        if (!fresh || action.when && !action.when(fresh)) throw Error('This action is no longer available.');
        return action.run(draft, fresh);
      }));
  }
});

page.addEventListener('input', event => {
  if (event.target.id !== 'record-query') return;
  filters.query = event.target.value;
  filters.page = 0;
  renderTable(currentDefinition());
});

page.addEventListener('change', event => {
  if (event.target.id === 'record-status') {
    filters.status = event.target.value;
    filters.page = 0;
    renderTable(currentDefinition());
  }
  const id = event.target.dataset.selectRow;
  if (id) {
    if (event.target.checked) selections.add(id);
    else selections.delete(id);
    $('#bulk-actions').hidden = !selections.size;
  }
});

window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY) { state = store.read(); render(); }
});

function restoreRoute() {
  const [owner, resource] = location.hash.slice(1).split('/');
  navigate(owner || 'dashboard', resource, false);
}
window.addEventListener('hashchange', restoreRoute);
restoreRoute();
