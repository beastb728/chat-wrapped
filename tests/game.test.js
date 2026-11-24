import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChat } from '../src/parser.js';
import { buildGame, isPlayable, summarize } from '../src/game.js';
import { generateSampleChat } from '../src/sample.js';

const msg = (text, author = 'Maya') => ({ type: 'text', author, text, ts: 0 });

test('filters out unsafe or boring messages', () => {
  assert.equal(isPlayable(msg('ok but hear me out on this')), true);
  assert.equal(isPlayable(msg('ok sure')), false, 'too short');
  assert.equal(isPlayable(msg('call me on 0612 345 678 tonight please')), false, 'phone number');
  assert.equal(isPlayable(msg('look at this https://x.com/abc it is wild')), false, 'link');
  assert.equal(isPlayable(msg('my email is me@example.com if you need it')), false, 'email');
  assert.equal(isPlayable(msg('Maya here, who is coming tonight then')), false, 'own name');
  assert.equal(isPlayable(msg('what the fuck is going on here guys')), false, 'spicy off');
  assert.equal(isPlayable(msg('what the fuck is going on here guys'), { spicy: true }), true, 'spicy on');
  assert.equal(isPlayable(msg('bc I was literally late again today')), true, '"bc" is not profanity');
  assert.equal(isPlayable({ ...msg('<Media omitted> is not text at all ok'), type: 'media' }), false);
});

test('builds a balanced deck from the sample chat', () => {
  const { messages } = parseChat(generateSampleChat());
  const g = buildGame(messages, { rounds: 20, seed: 42 });
  assert.equal(g.rounds.length, 20);
  assert.ok(g.reserve.length > 10);
  const quotes = g.rounds.filter(r => r.type === 'quote');
  const emojis = g.rounds.filter(r => r.type === 'emoji');
  assert.ok(emojis.length >= 1 && emojis.length <= 4);
  for (const r of g.rounds) {
    assert.ok(r.options.includes(r.answer));
    assert.ok(r.options.length >= 2 && r.options.length <= 4);
    assert.equal(new Set(r.options).size, r.options.length);
  }
  assert.ok(new Set(quotes.map(q => q.answer)).size >= 3, 'several different people appear');
  // Same seed → same deck.
  assert.deepEqual(buildGame(messages, { rounds: 20, seed: 42 }).rounds, g.rounds);
});

test('not enough people → empty game', () => {
  const g = buildGame(parseChat('1/2/24, 10:00 - Ana: hello there my old friend').messages);
  assert.equal(g.rounds.length, 0);
});

test('summary has scores and no message text', () => {
  const log = [
    { type: 'quote', answer: 'Leo', correct: true, player: 'A' },
    { type: 'quote', answer: 'Leo', correct: true, player: 'B' },
    { type: 'quote', answer: 'Sam', correct: false, player: 'A' },
    { type: 'quote', answer: 'Sam', correct: false, player: 'B' },
    { type: 'emoji', answer: 'Maya', correct: true, player: 'A' },
  ];
  const s = summarize(log, ['A', 'B']);
  assert.equal(s.correct, 3);
  assert.deepEqual(s.scores.map(x => [x.name, x.score]), [['A', 2], ['B', 1]]);
  assert.equal(s.easiest.name, 'Leo');
  assert.equal(s.hardest.name, 'Sam');
});

test('emoji rounds carry a displayable emoji and clear winner', () => {
  const { messages } = parseChat(generateSampleChat());
  const e = buildGame(messages, { rounds: 20, seed: 7 }).rounds.filter(r => r.type === 'emoji');
  assert.ok(e.length);
  for (const r of e) {
    assert.match(r.emoji, /\p{Extended_Pictographic}/u);
    assert.equal(r.counts[0][0], r.answer);
  }
});

test('near-duplicate messages are dealt only once', () => {
  const { messages } = parseChat(generateSampleChat());
  const g = buildGame(messages, { rounds: 25, seed: 3 });
  const keys = [...g.rounds, ...g.reserve].filter(r => r.type === 'quote').map(r => r.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim());
  assert.equal(new Set(keys).size, keys.length);
});
