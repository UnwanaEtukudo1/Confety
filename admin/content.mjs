import { field, optional, ref, resource, section, status } from './catalog.mjs';
import { find, revise, rowsOf } from './store.mjs';

const page = section('content', 'Content & moderation', '▤', 'Review reported material, edit help pages, and organize event classifications.');

resource(page, 'reports', 'Reported content queue', [
  field('title', 'Report summary'), status(['Event', 'Review', 'Comment', 'Media'], 'kind', 'Content type'),
  ref('event', 'Related event', 'events', true), ref('content', 'Moderated item', 'moderatedContent', true),
  ref('review', 'Related review', 'reviews', true), field('reason', 'Report reason', 'textarea'),
  status(['Open', 'In review', 'Resolved', 'Dismissed']), optional('resolution', 'Resolution notes', 'textarea'),
], {
  defaults: { status: 'Open' },
  rows: [{ id: 'report-content', title: 'Review of Makers Market cover', kind: 'Media', event: 'makers', content: 'asset-1', review: '', reason: 'Demo report requesting a copyright review.', status: 'Open', resolution: '' }],
  actions: [{ label: 'Hide linked content and resolve', when: row => ['Open', 'In review'].includes(row.status), run(state, row) {
    if (row.content) revise(state, 'moderatedContent', row.content, { status: 'Hidden' });
    else if (row.kind === 'Review' && row.review) revise(state, 'reviews', row.review, { status: 'Hidden' });
    else if (row.kind === 'Event' && row.event) revise(state, 'events', row.event, { status: 'Draft' });
    else throw Error('Link the affected content before taking action.');
    revise(state, 'reports', row.id, { status: 'Resolved', resolution: 'Linked item hidden by a demo moderator.' });
  } }],
});

resource(page, 'moderatedContent', 'Comments & media', [
  field('title', 'Item title'), status(['Comment', 'Media'], 'kind', 'Item type'),
  ref('event', 'Event', 'events'), optional('body', 'Comment or description', 'textarea'),
  optional('media', 'Uploaded image', 'media'), status(['Pending', 'Approved', 'Hidden']),
], { rows: [{ id: 'asset-1', title: 'Makers Market cover', kind: 'Media', event: 'makers', body: 'Cover image submitted for review.', media: '', status: 'Pending' }] });

resource(page, 'pages', 'Static pages & blog', [
  field('title', 'Page title'), status(['About', 'FAQ', 'Terms', 'Privacy', 'Blog', 'News'], 'kind', 'Content type'),
  field('slug', 'Slug'), field('body', 'Page content', 'textarea'),
  optional('image', 'Cover image', 'media'), status(['Draft', 'Preview published', 'Archived']),
], {
  defaults: { status: 'Draft' },
  rows: [
    { id: 'about', title: 'About Confety', kind: 'About', slug: 'about', body: 'A little more together. A lot more alive.', image: '', status: 'Preview published' },
    { id: 'faq', title: 'Help center FAQ', kind: 'FAQ', slug: 'faq', body: 'This workspace uses fictional records. Use the preview to try event workflows.', image: '', status: 'Preview published' },
    { id: 'terms', title: 'Terms preview', kind: 'Terms', slug: 'terms', body: 'Demo terms placeholder for review.', image: '', status: 'Draft' },
    { id: 'privacy', title: 'Privacy preview', kind: 'Privacy', slug: 'privacy', body: 'Demo privacy page placeholder for review.', image: '', status: 'Draft' },
  ],
  validate(row, state) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)) throw Error('Use a lowercase URL slug with hyphens.');
    if (rowsOf(state, 'pages').some(item => item.id !== row.id && item.slug === row.slug)) throw Error('That slug is already in use.');
  },
  actions: [{ label: 'Preview content', command: 'page-preview' }],
});

resource(page, 'categories', 'Categories', [field('title', 'Category name'), optional('description', 'Description', 'textarea')], {
  rows: [{ id: 'music', title: 'Music', description: 'Live music and festivals' }, { id: 'arts', title: 'Arts & culture', description: 'Exhibitions and screenings' }, { id: 'community', title: 'Community', description: 'Markets, meetups, and workshops' }],
});
resource(page, 'tags', 'Tags', [field('title', 'Tag name'), optional('description', 'Description')], {
  rows: [{ id: 'tag-live', title: 'Live music', description: '' }, { id: 'tag-workshop', title: 'Workshop', description: '' }],
});
