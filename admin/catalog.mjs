export const sections = [];
export const resources = {};
export const field = (key, label, type = 'text', options = {}) => ({ key, label, type, ...options });

export function section(id, title, icon, description, definition = {}) {
  const entry = { id, title, icon, description, resources: [], ...definition };
  sections.push(entry);
  return entry;
}

export function resource(owner, id, title, fields, options = {}) {
  const definition = { owner: owner.id, id, title, fields, rows: [], ...options };
  resources[id] = definition;
  owner.resources.push(id);
  return definition;
}

export const status = (values, key = 'status', label = 'Status') =>
  field(key, label, 'select', { values });
export const ref = (key, label, target, optional = false) =>
  field(key, label, 'ref', { target, optional });
export const optional = (key, label, type = 'text') => field(key, label, type, { optional: true });
export const amount = (key, label, min = 0, max = 1e9) => field(key, label, 'number', { min, max });
export const bool = (key, label) => field(key, label, 'boolean');
export const currencies = ['NGN', 'USD', 'GBP', 'EUR'];
