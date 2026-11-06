import { field, optional, ref, resource, section, status } from './catalog.mjs';
import { find, revise, rowsOf } from './store.mjs';

const page = section('feedback', 'Feedback & engagement', '♡', 'Collect post-event feedback, moderate participation, and issue demo certificates.', {
  view({ state, kpis }) {
    const responses = rowsOf(state, 'surveyResponses');
    const average = role => {
      const rows = responses.filter(row => row.audience === role);
      return rows.length ? (rows.reduce((sum, row) => sum + row.score, 0) / rows.length).toFixed(1) + ' / 5' : '—';
    };
    return kpis([
      ['Attendee satisfaction', average('Attendee'), 'Recorded survey responses'],
      ['Organizer satisfaction', average('Organizer'), 'Recorded survey responses'],
      ['Survey responses', responses.length, 'Across demo events'],
    ]);
  },
});

resource(page, 'surveys', 'Post-event surveys', [
  field('title', 'Survey title'), ref('event', 'Event', 'events'), field('questions', 'Questions, one per line', 'textarea'),
  status(['Draft', 'Open', 'Closed']),
], { rows: [{ id: 'survey-1', title: 'Open Canvas feedback', event: 'open', questions: 'How was the event?\nWhat would make it better?', status: 'Open' }] });

resource(page, 'surveyResponses', 'Survey responses', [
  ref('survey', 'Survey', 'surveys'), status(['Attendee', 'Organizer'], 'audience', 'Audience'),
  field('score', 'Rating out of 5', 'number', { min: 1, max: 5, integer: true }), field('theme', 'Feedback theme'),
  optional('feedback', 'Synthetic feedback', 'textarea'),
], {
  rows: [{ id: 'response-1', survey: 'survey-1', audience: 'Attendee', score: 4, theme: 'Venue access', feedback: 'Clearer signs would help.' }],
  validate(row, state, previous) {
    if (!previous && find(state, 'surveys', row.survey).status !== 'Open') throw Error('Open the survey before recording a response.');
  },
});

resource(page, 'reviews', 'Ratings & reviews', [
  field('title', 'Review title'), ref('event', 'Event', 'events'), field('score', 'Stars', 'number', { min: 1, max: 5, integer: true }),
  field('body', 'Review', 'textarea'), status(['Pending', 'Published', 'Hidden']),
], {
  rows: [{ id: 'review-1', title: 'A welcoming gallery', event: 'open', score: 5, body: 'The volunteers were helpful.', status: 'Pending' }],
  actions: [{ label: 'Publish review', when: row => row.status !== 'Published', run: (state, row) => revise(state, 'reviews', row.id, { status: 'Published' }) }],
});

resource(page, 'polls', 'Live polls', [
  field('title', 'Poll question'), ref('event', 'Event', 'events'), field('choices', 'Choices, separated by commas'),
  status(['Draft', 'Live', 'Closed']),
], {
  rows: [{ id: 'poll-1', title: 'What should we program next?', event: 'sunset', choices: 'Live band,DJ set,Open mic', status: 'Live' }],
  validate(row, state, previous) {
    const choices = row.choices.split(',').map(item => item.trim()).filter(Boolean);
    if (new Set(choices).size < 2) throw Error('Add at least two different choices.');
    if (previous && previous.choices !== row.choices && rowsOf(state, 'votes').some(item => item.poll === row.id)) throw Error('Choices are locked once voting starts.');
  },
  actions: [{ label: 'View poll and cast demo vote', command: 'poll' }],
});

resource(page, 'votes', 'Poll votes', [
  ref('poll', 'Poll', 'polls'), field('choice', 'Selected choice'),
], {
  readOnly: true,
  validate(row, state, previous) {
    const poll = find(state, 'polls', row.poll);
    if ((!previous && poll.status !== 'Live') || !poll.choices.split(',').map(item => item.trim()).includes(row.choice)) throw Error('This poll choice is unavailable.');
  },
});

resource(page, 'qa', 'Q&A moderation', [
  field('title', 'Question'), ref('event', 'Event', 'events'), optional('answer', 'Answer', 'textarea'),
  status(['Pending', 'Visible', 'Answered', 'Hidden']),
], { rows: [{ id: 'qa-1', title: 'What time do doors open?', event: 'sunset', answer: '', status: 'Pending' }] });

resource(page, 'certificates', 'Attendance certificates', [
  field('title', 'Certificate title'), ref('registration', 'Attended registration', 'registrations'),
  field('date', 'Issue date', 'date'), status(['Draft', 'Issued', 'Simulated delivered']),
], {
  defaults: { status: 'Draft', date: '2026-11-06' },
  validate(row, state) {
    if (!rowsOf(state, 'checkins').some(item => item.registration === row.registration)) throw Error('Certificates require a recorded check-in.');
  },
  actions: [
    { label: 'Generate certificate PDF', command: 'certificate' },
    { label: 'Simulate certificate delivery', command: 'certificate-send' },
  ],
});
