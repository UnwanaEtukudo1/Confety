import { resources, sections } from './catalog.mjs';

export const STORAGE_KEY = 'confety-final-admin-v1';
export const signedInKey = 'confety-final-admin-role';
export const DEMO_DAY = '2026-11-06';
export const timestamp = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export const titleOf = row => row?.title || row?.name || row?.reference || row?.id || 'Unknown record';
export const rowsOf = (state, id) => state.records[id] || [];
export const find = (state, type, id) => rowsOf(state, type).find(row => row.id === id);
export const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function freshState() {
  return {
    version: 1,
    records: Object.fromEntries(Object.values(resources).map(item => [item.id, structuredClone(item.rows)])),
    audit: [
      { id: 'audit-1', at: '2026-11-06T09:40:00Z', actor: 'Tomi Ade', action: 'Reviewed organizer documents', target: 'Open Canvas Studio' },
      { id: 'audit-2', at: '2026-11-06T08:55:00Z', actor: 'Maya Okafor', action: 'Published event', target: 'Sunset Sessions' },
    ],
  };
}

export function can(state, role, owner, mode = 'write') {
  if (role === 'super') return true;
  const definition = find(state, 'roles', role);
  const granted = String(definition?.permissions || '').split(',').map(item => item.trim());
  return granted.includes(owner + ':write') || (mode === 'read' && granted.includes(owner + ':read'));
}

function actorName(state, role) {
  return role === 'super' ? 'Maya Okafor · Super admin' : titleOf(find(state, 'roles', role));
}

export function createStore(storage = localStorage) {
  function read() {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return freshState();
    const value = JSON.parse(text);
    if (value.version !== 1 || !value.records || !Array.isArray(value.audit)) {
      throw Error('The demo data format is invalid. Restore a Confety demo backup to continue.');
    }
    return value;
  }

  async function change(role, owner, action, target, update) {
    if (!navigator.locks) throw Error('This browser cannot safely save changes across tabs.');
    return navigator.locks.request(STORAGE_KEY, () => {
      const state = read();
      if (!can(state, role, owner)) throw Error('Your current demo role cannot make this change.');
      const result = update(state);
      state.audit.unshift({ id: uid(), at: timestamp(), actor: actorName(state, role), action, target });
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      return result;
    });
  }

  return { read, change };
}

export function normalize(definition, input, state, previous = {}) {
  const row = { ...previous };
  for (const item of definition.fields) {
    let value = input[item.key];
    if (item.type === 'boolean') {
      row[item.key] = value === true || value === 'true' || value === 'on';
      continue;
    }
    value = String(value ?? '').trim();
    if (!value && !item.optional) throw Error(item.label + ' is required.');
    if (!value) { row[item.key] = ''; continue; }
    if (value.length > (item.type === 'media' ? 1_400_000 : 4000)) throw Error(item.label + ' is too long.');
    if (item.type === 'number') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < (item.min ?? 0) || parsed > (item.max ?? 1e9)) throw Error(item.label + ' is outside the allowed range.');
      if (item.integer && !Number.isInteger(parsed)) throw Error(item.label + ' must be a whole number.');
      value = parsed;
    }
    if (item.type === 'select' && !item.values.includes(value)) throw Error('Choose a valid ' + item.label.toLowerCase() + '.');
    if (item.type === 'ref' && !find(state, item.target, value)) throw Error('Choose an existing ' + item.label.toLowerCase() + '.');
    if (item.type === 'date' || item.type === 'datetime-local') {
      const format = item.type === 'date' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
      const iso = item.type === 'date' ? value + 'T00:00Z' : value + 'Z';
      if (!format.test(value) || !validDate(iso) || new Date(iso).toISOString().slice(0, value.length) !== value) {
        throw Error('Enter a valid ' + item.label.toLowerCase() + '.');
      }
    }
    if (item.type === 'color' && !/^#[0-9a-f]{6}$/i.test(value)) throw Error('Enter a valid hex color.');
    if (item.type === 'url' && !/^https?:\/\/[^\s]+$/i.test(value)) throw Error('Enter an HTTP or HTTPS address.');
    if (item.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw Error('Enter a valid email address.');
    if (item.type === 'media' && !/^(https?:\/\/[^\s]+|data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+)$/i.test(value)) {
      throw Error('Choose an image file or enter an HTTP(S) image address.');
    }
    row[item.key] = value;
  }
  return row;
}

export function saveRecord(state, type, input, id) {
  const definition = resources[type];
  if (!definition) throw Error('Unknown record type.');
  const previous = id ? find(state, type, id) : null;
  if (id && !previous) throw Error('This record no longer exists.');
  const row = normalize(definition, input, state, previous || {});
  row.id = previous?.id || uid();
  row.updatedAt = timestamp();
  definition.validate?.(row, state, previous);
  if (previous) {
    state.records[type] = rowsOf(state, type).map(item => item.id === id ? row : item);
  } else {
    state.records[type].push(row);
  }
  return row;
}

export function revise(state, type, id, patch) {
  const row = find(state, type, id);
  if (!row) throw Error('This record no longer exists.');
  return saveRecord(state, type, { ...row, ...patch }, id);
}

export function removeRecord(state, type, id) {
  for (const definition of Object.values(resources)) {
    for (const field of definition.fields.filter(field => field.target === type)) {
      if (rowsOf(state, definition.id).some(row => row[field.key] === id)) {
        throw Error('This record is linked to ' + definition.title.toLowerCase() + '. Archive it or remove those links first.');
      }
    }
  }
  state.records[type] = rowsOf(state, type).filter(row => row.id !== id);
}

export function validateBackup(value) {
  if (value?.version !== 1 || !value.records || !Array.isArray(value.audit)) throw Error('Choose a Confety demo backup.');
  const next = freshState();
  for (const [type, definition] of Object.entries(resources)) {
    if (!Array.isArray(value.records[type])) throw Error('Backup is missing ' + definition.title.toLowerCase() + '.');
    const ids = new Set();
    next.records[type] = value.records[type].map(row => {
      if (typeof row?.id !== 'string' || !row.id || ids.has(row.id)) throw Error('Backup contains invalid record IDs.');
      ids.add(row.id);
      return { ...row };
    });
  }
  for (const [type, definition] of Object.entries(resources)) {
    next.records[type] = next.records[type].map(row => {
      const cleaned = normalize(definition, row, next, { id: row.id, updatedAt: row.updatedAt });
      definition.validate?.(cleaned, next, row);
      return cleaned;
    });
  }
  next.audit = value.audit.slice(0, 1000).map(row => ({
    id: String(row.id), at: String(row.at), actor: String(row.actor),
    action: String(row.action), target: String(row.target),
  }));
  return next;
}

export const sectionTitle = id => sections.find(item => item.id === id)?.title || id;
