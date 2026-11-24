import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChat } from '../src/parser.js';
import { computeStats, chatYears } from '../src/stats.js';
import { generateSampleChat } from '../src/sample.js';

test('sample chat parses and produces full stats', () => {
  const { messages, participants } = parseChat(generateSampleChat());
  assert.equal(participants.length, 5);
  assert.deepEqual(chatYears(messages), [2026]);
  const s = computeStats(messages, { year: 2026 });
  assert.equal(s.people[0].name, 'Maya');
  assert.ok(s.totals.messages > 3000);
  assert.ok(s.silence.ms > 10 * 86400000, 'August silence detected');
  assert.ok(s.archetypes.length === 5);
  assert.equal(new Set(s.archetypes.map(a => a.title)).size, 5, 'archetypes are distinct');
  // Never leak message text in stats.
  assert.ok(!JSON.stringify(s).includes('hear me out'));
});

test('reply times, starters and streaks', () => {
  const chat = [
    '01/03/2024, 10:00 - A: hi',
    '01/03/2024, 10:02 - B: hey',
    '01/03/2024, 10:05 - A: 😂😂 lol',
    '02/03/2024, 09:00 - B: morning',
    '02/03/2024, 09:10 - A: yo',
    '03/03/2024, 23:00 - A: anyone?',
    '03/03/2024, 23:30 - A: hello??',
  ].join('\n');
  const s = computeStats(parseChat(chat).messages);
  const A = s.people.find(p => p.name === 'A'), B = s.people.find(p => p.name === 'B');
  assert.equal(s.totals.conversations, 3);
  assert.equal(A.starts, 2); assert.equal(B.starts, 1);
  assert.equal(B.medianReplyMs, 120000);
  assert.equal(A.doubleTexts, 1);
  assert.equal(A.laughs, 3);
  assert.equal(s.streak.days, 3);
  assert.equal(s.topEmojis[0][0], '😂');
});
