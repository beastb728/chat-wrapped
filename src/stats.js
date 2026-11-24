// Turns parsed messages into Wrapped stats. Pure, returns plain JSON-safe data.
// Output never contains message text: only counts, names, emojis and single words.
import { STOPWORDS } from './stopwords.js';

const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const WORD_RE = /[\p{L}\p{M}][\p{L}\p{M}\p{N}'’]*/gu;
const PICTO = /\p{Extended_Pictographic}/u;
const LAUGH_WORD = /^(?:a?(?:ha){2,}h?|(?:he){2,}|(?:ja){2,}|(?:ji){2,}|k{3,}|(?:rs){2,}|lol+|lmao+|lmfao+|rofl|xd+|(?:hi){2,}|(?:wk){2,}|5{3,})$/;
const LAUGH_EMOJI = new Set(['😂', '🤣', '😹', '💀']);
const SORRY = /(?<!\p{L})(?:sorry|sry|soz|my bad|apologi[sz]e|desculp\p{L}*|perd[oó]n\p{L}*|lo siento|entschuldig\p{L}*|d[ée]sol[ée]e?|scusa\p{L}*|maaf|sorri)(?!\p{L})/giu;
const LOVE = /(?<!\p{L})(?:i love you|love you|love u|luv u|ily|te amo|te quiero|eu te amo|ich liebe dich|hab dich lieb|je t'aime|ti amo|ti voglio bene|aku sayang kamu|i love u)(?!\p{L})/giu;
const MORNING = /(?<!\p{L})(?:good morning|morning|gm|bom dia|buenos d[ií]as|buen d[ií]a|guten morgen|bonjour|buongiorno|selamat pagi|goedemorgen)(?!\p{L})/iu;

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

function emojisIn(text) {
  if (!PICTO.test(text)) return [];
  const out = [];
  if (segmenter) {
    for (const { segment } of segmenter.segment(text)) if (PICTO.test(segment)) out.push(segment);
  } else {
    for (const ch of text) if (PICTO.test(ch)) out.push(ch);
  }
  return out;
}

const bump = (map, k, n = 1) => map.set(k, (map.get(k) || 0) + n);
const median = arr => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b), mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const topN = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
const dayKey = ts => Math.floor(ts / DAY);

/** Years present in the chat (non-system messages), newest first. */
export function chatYears(messages) {
  const ys = new Set();
  for (const m of messages) if (m.type !== 'system') ys.add(new Date(m.ts).getUTCFullYear());
  return [...ys].sort((a, b) => b - a);
}

/**
 * @param {Array} messages  from parseChat
 * @param {object} [opts]
 * @param {number|null} [opts.year]   restrict to a calendar year
 * @param {number} [opts.gapHours]    silence that splits conversations
 */
export function computeStats(messages, opts = {}) {
  const { year = null, gapHours = 4 } = opts;
  const msgs = messages.filter(m => m.type !== 'system' && (year == null || new Date(m.ts).getUTCFullYear() === year));
  if (!msgs.length) return null;

  const P = new Map();
  const person = name => {
    let p = P.get(name);
    if (!p) {
      p = {
        name, messages: 0, textMessages: 0, words: 0, media: 0, voice: 0, deleted: 0, edited: 0,
        emojis: 0, links: 0, laughs: 0, sorry: 0, love: 0, morning: 0, night: 0, early: 0,
        starts: 0, ends: 0, doubleTexts: 0, replyTimes: [],
        emojiCounts: new Map(), wordCounts: new Map(), hours: new Array(24).fill(0),
      };
      P.set(name, p);
    }
    return p;
  };

  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  const days = new Map();
  const months = new Map();
  const allEmoji = new Map();
  const allWords = new Map();
  const emojiDisplay = new Map();
  const pairs = new Map(); // "a\u0000b" -> [gaps]: b replying to a
  const gapMs = gapHours * HOUR;
  let conversations = 0;
  let silence = { ms: 0, from: null, to: null };

  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const prev = msgs[i - 1];
    const p = person(m.author);
    const gap = prev ? m.ts - prev.ts : Infinity;
    const date = new Date(m.ts);
    const h = date.getUTCHours();

    p.messages++;
    p.hours[h]++;
    hours[h]++;
    weekdays[date.getUTCDay()]++;
    bump(days, dayKey(m.ts));
    bump(months, `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
    if (h < 5) p.night++;
    else if (h < 9) p.early++;

    if (gap >= gapMs) {
      conversations++;
      p.starts++;
      if (prev) person(prev.author).ends++;
    } else if (prev.author !== m.author) {
      p.replyTimes.push(gap);
      const key = prev.author + '\u0000' + m.author;
      if (!pairs.has(key)) pairs.set(key, []);
      pairs.get(key).push(gap);
    } else if (gap >= 20 * MIN) {
      p.doubleTexts++;
    }
    if (prev && gap > silence.ms) silence = { ms: gap, from: prev.ts, to: m.ts };

    if (m.edited) p.edited++;
    if (m.type === 'media') { p.media++; if (m.voice) p.voice++; continue; }
    if (m.type === 'deleted') { p.deleted++; continue; }

    p.textMessages++;
    const text = m.text;
    const links = text.match(URL_RE);
    if (links) p.links += links.length;
    const clean = links ? text.replace(URL_RE, ' ') : text;

    for (const e of emojisIn(clean)) {
      const key = e.replace(/️/g, '');
      if (!emojiDisplay.has(key)) emojiDisplay.set(key, e);
      p.emojis++;
      bump(p.emojiCounts, key);
      bump(allEmoji, key);
      if (LAUGH_EMOJI.has(key)) p.laughs++;
    }

    const tokens = clean.toLowerCase().match(WORD_RE) || [];
    p.words += tokens.length;
    for (const t of tokens) {
      if (LAUGH_WORD.test(t)) { p.laughs++; continue; }
      if (t.length < 3 || STOPWORDS.has(t) || /^\p{N}/u.test(t)) continue;
      bump(p.wordCounts, t);
      bump(allWords, t);
    }
    SORRY.lastIndex = 0; LOVE.lastIndex = 0;
    p.sorry += (clean.match(SORRY) || []).length;
    p.love += (clean.match(LOVE) || []).length;
    if (h >= 4 && h < 12 && MORNING.test(clean)) p.morning++;
  }

  const total = msgs.length;
  const first = msgs[0].ts, last = msgs[msgs.length - 1].ts;

  // Streak of consecutive active days.
  const dayList = [...days.keys()].sort((a, b) => a - b);
  let streak = { days: 1, from: dayList[0], to: dayList[0] }, run = 1, runStart = dayList[0];
  for (let i = 1; i < dayList.length; i++) {
    if (dayList[i] === dayList[i - 1] + 1) run++;
    else { run = 1; runStart = dayList[i]; }
    if (run > streak.days) streak = { days: run, from: runStart, to: dayList[i] };
  }
  const [busiestDayKey, busiestDayCount] = topN(days, 1)[0];

  const totalWordsAll = [...P.values()].reduce((s, p) => s + p.words, 0);
  const people = [...P.values()].sort((a, b) => b.messages - a.messages).map(p => {
    const othersWords = totalWordsAll - p.words;
    const signature = [];
    if (P.size > 1) {
      for (const [w, c] of p.wordCounts) {
        if (c < 3) continue;
        const o = (allWords.get(w) || 0) - c;
        const score = c * Math.log((c / Math.max(1, p.words)) / ((o + 1) / (othersWords + 1)));
        if (score > 0) signature.push([w, score, c]);
      }
      signature.sort((a, b) => b[1] - a[1]);
    }
    const topHour = p.hours.indexOf(Math.max(...p.hours));
    return {
      name: p.name,
      messages: p.messages,
      share: p.messages / total,
      words: p.words,
      avgWords: p.textMessages ? p.words / p.textMessages : 0,
      media: p.media, voice: p.voice, deleted: p.deleted, edited: p.edited,
      emojis: p.emojis, links: p.links, laughs: p.laughs, sorry: p.sorry, love: p.love, morning: p.morning,
      nightShare: p.night / p.messages,
      earlyShare: p.early / p.messages,
      starts: p.starts, ends: p.ends, doubleTexts: p.doubleTexts,
      medianReplyMs: median(p.replyTimes),
      replies: p.replyTimes.length,
      topHour,
      topEmojis: topN(p.emojiCounts, 5).map(([e, c]) => [emojiDisplay.get(e), c]),
      signatureWords: signature.slice(0, 3).map(([w, , c]) => [w, c]),
      topWords: topN(p.wordCounts, 5),
    };
  });

  const pairList = [...pairs.entries()].map(([k, gaps]) => {
    const [from, to] = k.split('\u0000');
    return { from, to, replies: gaps.length, medianMs: median(gaps) };
  });

  const result = {
    year,
    totals: {
      messages: total,
      words: totalWordsAll,
      people: people.length,
      conversations,
      activeDays: days.size,
      spanDays: Math.round((last - first) / DAY) + 1,
      media: people.reduce((s, p) => s + p.media, 0),
      emojis: people.reduce((s, p) => s + p.emojis, 0),
    },
    first, last,
    people,
    hours, weekdays,
    months: [...months.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    busiestDay: { ts: busiestDayKey * DAY, count: busiestDayCount },
    streak: { days: streak.days, from: streak.from * DAY, to: streak.to * DAY },
    silence,
    topEmojis: topN(allEmoji, 10).map(([e, c]) => [emojiDisplay.get(e), c]),
    topWords: topN(allWords, 10),
    pairs: pairList,
  };
  result.awards = computeAwards(result);
  result.archetypes = computeArchetypes(result);
  return result;
}

// --- Awards & archetypes -----------------------------------------------------

const fmtDur = ms => {
  if (ms == null) return '–';
  if (ms < MIN) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (ms < HOUR) return `${Math.round(ms / MIN)}m`;
  if (ms < DAY) return `${(ms / HOUR).toFixed(ms < 10 * HOUR ? 1 : 0).replace(/\.0$/, '')}h`;
  return `${Math.round(ms / DAY)}d`;
};
export { fmtDur };

const pct = x => `${Math.round(x * 100)}%`;

// metric(p, stats) -> number (higher = more deserving); min(p) gates eligibility.
export const AWARD_DEFS = [
  { id: 'nightowl', emoji: '🦉', title: 'Night Owl', metric: p => p.nightShare, min: p => p.nightShare >= 0.05,
    line: p => `${pct(p.nightShare)} of their messages land between midnight and 5am` },
  { id: 'earlybird', emoji: '🌅', title: 'Early Bird', metric: p => p.earlyShare, min: p => p.earlyShare >= 0.08,
    line: p => `${pct(p.earlyShare)} of their texts are sent before 9am` },
  { id: 'essayist', emoji: '📜', title: 'The Essayist', metric: p => p.avgWords, min: p => p.avgWords >= 6,
    line: p => `${p.avgWords.toFixed(1)} words per message on average` },
  { id: 'doubletexter', emoji: '📲', title: 'Double Texter', metric: p => p.doubleTexts / p.messages, min: p => p.doubleTexts >= 3,
    line: p => `Followed up on their own message ${p.doubleTexts} times` },
  { id: 'starter', emoji: '🔥', title: 'Conversation Starter', metric: p => p.starts / p.messages, min: p => p.starts >= 3,
    line: p => `Broke the silence ${p.starts} times` },
  { id: 'killer', emoji: '🔇', title: 'Conversation Killer', metric: p => p.ends / p.messages, min: p => p.ends >= 3,
    line: p => `Sent the last message before silence ${p.ends} times` },
  { id: 'speed', emoji: '⚡', title: 'Speed Demon', metric: p => (p.medianReplyMs ? 1 / p.medianReplyMs : 0), min: p => p.replies >= 10,
    line: p => `Replies in ${fmtDur(p.medianReplyMs)} (median)` },
  { id: 'ghost', emoji: '👻', title: 'The Ghost', metric: p => p.medianReplyMs || 0, min: p => p.replies >= 5,
    line: p => `Takes ${fmtDur(p.medianReplyMs)} to reply (median)` },
  { id: 'hype', emoji: '😂', title: 'Hype Person', metric: p => p.laughs / p.messages, min: p => p.laughs >= 5,
    line: p => `Laughed ${p.laughs} times. Best audience in the chat` },
  { id: 'emoji', emoji: '🎨', title: 'Emoji Machine', metric: p => p.emojis / p.messages, min: p => p.emojis >= 10,
    line: p => `${p.emojis.toLocaleString('en')} emojis sent${p.topEmojis[0] ? `, mostly ${p.topEmojis[0][0]}` : ''}` },
  { id: 'media', emoji: '📸', title: 'Media Hoarder', metric: p => p.media / p.messages, min: p => p.media >= 5,
    line: p => `${p.media.toLocaleString('en')} photos, videos & stickers` },
  { id: 'voice', emoji: '🎙️', title: 'Voice Note Villain', metric: p => p.voice / p.messages, min: p => p.voice >= 3,
    line: p => `${p.voice} voice notes. Some of us can't listen right now` },
  { id: 'sorry', emoji: '🙏', title: 'Apology Champion', metric: p => p.sorry / p.messages, min: p => p.sorry >= 3,
    line: p => `Said sorry ${p.sorry} times` },
  { id: 'deleter', emoji: '🫣', title: 'Undo Button', metric: p => p.deleted / p.messages, min: p => p.deleted >= 2,
    line: p => `Deleted ${p.deleted} messages. What were they hiding?` },
  { id: 'links', emoji: '🔗', title: 'Link Dealer', metric: p => p.links / p.messages, min: p => p.links >= 5,
    line: p => `Dropped ${p.links} links into the chat` },
];

function eligible(stats) {
  const floor = Math.max(10, stats.totals.messages * 0.02);
  return stats.people.filter(p => p.messages >= floor);
}

function computeAwards(stats) {
  const pool = eligible(stats);
  const out = [];
  for (const def of AWARD_DEFS) {
    if (def.id === 'ghost' && pool.length < 2) continue;
    const cands = pool.filter(def.min);
    if (!cands.length) continue;
    const winner = cands.reduce((a, b) => (def.metric(b) > def.metric(a) ? b : a));
    out.push({ id: def.id, emoji: def.emoji, title: def.title, name: winner.name, line: def.line(winner) });
  }
  return out;
}

/** One distinct personality label per person, based on where they stand out most. */
function computeArchetypes(stats) {
  const pool = eligible(stats);
  const scored = [];
  for (const def of AWARD_DEFS) {
    const vals = pool.map(p => def.metric(p));
    const mean = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
    if (!mean) continue;
    pool.forEach((p, i) => { if (def.min(p)) scored.push({ p, def, score: vals[i] / mean }); });
  }
  scored.sort((a, b) => b.score - a.score);
  const assigned = new Map(), used = new Set();
  for (const s of scored) {
    if (assigned.has(s.p.name) || used.has(s.def.id) || s.score < 1.05) continue;
    assigned.set(s.p.name, s.def);
    used.add(s.def.id);
  }
  return stats.people.map(p => {
    const def = assigned.get(p.name);
    if (def) return { name: p.name, emoji: def.emoji, title: def.title, line: def.line(p) };
    if (p.messages < Math.max(10, stats.totals.messages * 0.02))
      return { name: p.name, emoji: '🕵️', title: 'The Lurker', line: `Only ${p.messages} messages. Reads everything, says nothing` };
    return { name: p.name, emoji: '🧱', title: 'The Steady One', line: `${pct(p.share)} of the chat, perfectly balanced` };
  });
}
