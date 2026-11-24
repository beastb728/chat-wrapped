// Runs parsing and stats off the main thread so huge chats don't freeze the page.
// The chat text lives only in this worker's memory and is dropped on "clear".
import { parseChat } from './parser.js';
import { fileToChatText } from './load.js';
import { computeStats, chatYears } from './stats.js';
import { generateSampleChat } from './sample.js';
import { buildGame } from './game.js';

let text = null;
let parsed = null;
const post = msg => self.postMessage(msg);

function parse(dateOrder) {
  post({ type: 'progress', stage: 'Reading messages…', fraction: 0 });
  parsed = parseChat(text, { dateOrder, onProgress: f => post({ type: 'progress', stage: 'Reading messages…', fraction: f }) });
  post({
    type: 'loaded',
    meta: parsed.meta,
    participants: parsed.participants,
    years: chatYears(parsed.messages),
    count: parsed.messages.filter(m => m.type !== 'system').length,
  });
}

self.onmessage = async ({ data }) => {
  try {
    switch (data.type) {
      case 'file':
        post({ type: 'progress', stage: 'Opening file…', fraction: 0 });
        text = await fileToChatText(data.file);
        parse(data.dateOrder);
        break;
      case 'sample':
        text = generateSampleChat();
        parse();
        break;
      case 'reparse':
        parse(data.dateOrder);
        break;
      case 'stats':
        post({ type: 'stats', id: data.id, stats: computeStats(parsed.messages, { year: data.year }) });
        break;
      case 'game':
        post({ type: 'game', game: buildGame(parsed.messages, { rounds: data.rounds, year: data.year, spicy: data.spicy }) });
        break;
      case 'preview': {
        // Stats from the fictional sample chat, for the hero cards on the home page.
        const sample = parseChat(generateSampleChat());
        post({ type: 'preview', stats: computeStats(sample.messages, { year: 2026 }) });
        break;
      }
      case 'clear':
        text = null;
        parsed = null;
        break;
    }
  } catch (e) {
    post({ type: 'error', code: e.code || 'UNKNOWN', message: e.message, sample: e.sample || null });
  }
};
