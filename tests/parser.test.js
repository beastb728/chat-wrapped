import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseChat, redactSample } from '../src/parser.js';
import { fileToChatText } from '../src/load.js';

const LRM = '‎';
const NNBSP = ' ';
const d = ts => new Date(ts).toISOString().slice(0, 16);

test('Android, US, 12h clock, 2-digit year', () => {
  const chat = [
    '12/31/23, 10:15 PM - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.',
    '12/31/23, 10:15 PM - Ana created group "NYE 🎉"',
    '12/31/23, 10:16 PM - Ana: Happy new year!!',
    '12/31/23, 11:59 PM - Bob: <Media omitted>',
    '1/1/24, 12:01 AM - Bob: This message was deleted',
    '1/1/24, 12:05 AM - Ana: line one',
    'line two',
    '',
    'line four',
  ].join('\n');
  const r = parseChat(chat);
  assert.equal(r.meta.dateOrder, 'MDY');
  assert.equal(r.meta.hour12, true);
  assert.equal(r.meta.platform, 'android');
  assert.deepEqual(r.participants, ['Ana', 'Bob']);
  const types = r.messages.map(m => m.type);
  assert.deepEqual(types, ['system', 'system', 'text', 'media', 'deleted', 'text']);
  assert.equal(d(r.messages[2].ts), '2023-12-31T22:16');
  assert.equal(d(r.messages[4].ts), '2024-01-01T00:01');
  assert.equal(r.messages[5].text, 'line one\nline two\n\nline four');
});

test('Android, Europe, 24h clock, 4-digit year', () => {
  const chat = [
    '31/12/2023, 22:15 - João: Feliz ano novo',
    '01/01/2024, 00:03 - Maria: Igualmente! 🥳',
    '01/01/2024, 00:04 - Maria: <Mídia oculta>',
    '01/01/2024, 00:05 - João: Mensagem apagada',
  ].join('\n');
  const r = parseChat(chat);
  assert.equal(r.meta.dateOrder, 'DMY');
  assert.equal(r.meta.hour12, false);
  assert.deepEqual(r.messages.map(m => m.type), ['text', 'text', 'media', 'deleted']);
  assert.equal(d(r.messages[0].ts), '2023-12-31T22:15');
});

test('German dots, no 4-digit year', () => {
  const chat = '24.12.23, 18:00 - Lena: Frohe Weihnachten\n25.12.23, 09:12 - Tom: Danke, dir auch!\n25.12.23, 09:13 - Tom: Diese Nachricht wurde gelöscht.';
  const r = parseChat(chat);
  assert.equal(r.meta.dateOrder, 'DMY');
  assert.equal(r.messages[2].type, 'deleted');
  assert.equal(d(r.messages[1].ts), '2023-12-25T09:12');
});

test('iOS, US, with U+200E markers and narrow no-break spaces', () => {
  const chat = [
    `[12/3/23, 9:41:07${NNBSP}AM] Family: ${LRM}Messages and calls are end-to-end encrypted.`,
    `${LRM}[12/3/23, 9:41:07${NNBSP}AM] Family: ${LRM}Mom added Sam`,
    `[12/3/23, 9:42:00${NNBSP}AM] Mom: Dinner at 7?`,
    `${LRM}[12/3/23, 9:43:10${NNBSP}AM] Sam: ${LRM}image omitted`,
    `${LRM}[12/3/23, 9:43:50${NNBSP}AM] Sam: ${LRM}audio omitted`,
    `[12/3/23, 12:30:00${NNBSP}PM] Mom: sure ${LRM}<This message was edited>`,
    `[12/13/23, 1:00:00${NNBSP}PM] Sam: ${LRM}You deleted this message.`,
  ].join('\n');
  const r = parseChat(chat);
  assert.equal(r.meta.platform, 'ios');
  assert.equal(r.meta.dateOrder, 'MDY');
  assert.deepEqual(r.participants, ['Sam', 'Mom']);
  assert.deepEqual(r.messages.map(m => m.type), ['system', 'system', 'text', 'media', 'media', 'text', 'deleted']);
  assert.equal(r.messages[4].voice, true);
  assert.equal(r.messages[5].text, 'sure');
  assert.equal(r.messages[5].edited, true);
  assert.equal(d(r.messages[5].ts), '2023-12-03T12:30');
});

test('iOS, Europe, 24h with seconds', () => {
  const chat = '[31/01/2024, 23:59:59] Ana: last one\n[01/02/2024, 00:00:01] ~ Unknown Person: first one';
  const r = parseChat(chat);
  assert.equal(r.meta.dateOrder, 'DMY');
  assert.deepEqual(r.participants, ['Ana', 'Unknown Person']);
  assert.equal(d(r.messages[1].ts), '2024-02-01T00:00');
});

test('Spanish "p. m." style and NBSP', () => {
  const chat = '5/3/24, 9:05 p. m. - Carla: hola\n5/3/24, 9:06 p. m. - Diego: <Multimedia omitido>';
  const r = parseChat(chat);
  assert.equal(r.meta.hour12, true);
  assert.equal(new Date(r.messages[0].ts).getUTCHours(), 21);
  assert.equal(r.messages[1].type, 'media');
});

test('ISO-style YYYY-MM-DD dates', () => {
  const r = parseChat('2024-03-05 14:00 - Kai: hej\n2024-03-05 14:01 - Mia: hej hej');
  assert.equal(r.meta.dateOrder, 'YMD');
  assert.equal(d(r.messages[0].ts), '2024-03-05T14:00');
});

test('ambiguous dates resolved by chronological order', () => {
  // Under MDY this would jump from Jan 5 to Feb 1 to Mar 1 (forward);
  // under DMY it would go 1 May -> 2 Jan -> 3 Jan (backward).
  const r = parseChat('1/5/24, 10:00 - A: x\n2/1/24, 10:00 - B: y\n3/1/24, 10:00 - A: z');
  assert.equal(r.meta.dateOrder, 'MDY');
});

test('manual date order override', () => {
  const r = parseChat('1/5/24, 10:00 - A: x', { dateOrder: 'DMY' });
  assert.equal(d(r.messages[0].ts), '2024-05-01T10:00');
});

test('system lines with colons are not mistaken for people', () => {
  const r = parseChat('1/2/24, 10:00 - Ana changed the subject from "a" to "b: c"\n1/2/24, 10:01 - Ana: ok');
  assert.equal(r.messages[0].type, 'system');
  assert.deepEqual(r.participants, ['Ana']);
});

test('Android media with (file attached)', () => {
  const r = parseChat('1/2/24, 10:00 - Ana: PTT-20240102-WA0001.opus (file attached)\n1/2/24, 10:01 - Ana: IMG-1.jpg (file attached)');
  assert.equal(r.messages[0].type, 'media');
  assert.equal(r.messages[0].voice, true);
  assert.equal(r.messages[1].voice, undefined);
});

test('CRLF line endings and BOM', () => {
  const r = parseChat('﻿1/2/24, 10:00 - Ana: hi\r\n1/2/24, 10:01 - Bo: yo\r\n');
  assert.equal(r.messages.length, 2);
  assert.equal(r.messages[1].text, 'yo');
});

test('a random text file fails with a redacted sample', () => {
  assert.throws(() => parseChat('hello world\nthis is not a chat'), err => {
    assert.equal(err.code, 'NO_MESSAGES');
    assert.ok(!/hello/.test(err.sample));
    return true;
  });
});

test('redactSample keeps the shape but no letters', () => {
  assert.equal(redactSample('12/31/23, 10:15 PM - Ana: hi'), '12/31/23, 10:15 xx - xxx: xx');
});

test('iOS zip export (deflate) is unpacked in pure JS', async () => {
  const buf = readFileSync(new URL('./fixtures/ios-export.zip', import.meta.url));
  const text = await fileToChatText(new Blob([buf]));
  const r = parseChat(text);
  assert.equal(r.meta.platform, 'ios');
  assert.ok(r.messages.length >= 3);
});
