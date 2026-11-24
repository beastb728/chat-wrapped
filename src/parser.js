// WhatsApp chat export parser. Pure functions, no DOM, no network.
// Handles Android (.txt) and iOS (_chat.txt) exports across locales:
// 12h/24h clocks, DMY/MDY/YMD dates, system messages, media placeholders,
// deleted/edited markers and multi-line messages.
//
// Timestamps are stored as "wall clock" UTC milliseconds: the export's local
// time is encoded with Date.UTC, so always read them back with getUTC*().

const BIDI = /[‎‏‪-‮⁦-⁩﻿]/g;
const ODD_SPACES = /[    ]/g;

// [?  date  ,?  time  am/pm?  ]?  ( - )?
const HEADER =
  /^(\[)?(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})\.?,?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([ap]\.?\s?m\.?)?\s*(\])?\s*([-–—]\s)?/i;

const DELETED = new Set([
  'this message was deleted', 'you deleted this message',
  'se eliminó este mensaje', 'eliminaste este mensaje', 'este mensaje fue eliminado',
  'mensagem apagada', 'essa mensagem foi apagada', 'esta mensagem foi apagada', 'você apagou esta mensagem',
  'diese nachricht wurde gelöscht', 'du hast diese nachricht gelöscht',
  'ce message a été supprimé', 'vous avez supprimé ce message',
  'questo messaggio è stato eliminato', 'hai eliminato questo messaggio',
  'pesan ini telah dihapus', 'anda menghapus pesan ini',
  'dit bericht is verwijderd', 'je hebt dit bericht verwijderd',
  'यह संदेश हटा दिया गया था', 'आपने यह संदेश हटा दिया',
  'bu mesaj silindi', 'bu mesajı sildiniz',
]);

const MEDIA = new Set([
  '<media omitted>', '<médias omis>', '<multimedia omitido>', '<mídia oculta>', '<arquivo de mídia oculto>',
  '<medien ausgeschlossen>', '<media weggelaten>', '<media omessi>', '<media tidak disertakan>',
  '<मीडिया के बिना>', '<medya dahil edilmedi>', 'null',
]);

const EDITED = /\s*<(?:this message was edited|se editó este mensaje|mensagem editada|esta mensagem foi editada|diese nachricht wurde bearbeitet|ce message a été modifié|messaggio modificato|pesan ini telah diedit|dit bericht is bewerkt|यह संदेश संपादित किया गया)>\s*$/i;
const IOS_MEDIA = /omitted|omitid[oa]|ocultad[oa]|weggelassen|omis(?:e|es)?$|disertakan|tidak disertakan|<attached:|<anexado:|<adjunto:|<angehängt:/i;
const FILE_ATTACHED = /\((?:file attached|arquivo anexado|archivo adjunto|datei angehängt|fichier joint|file allegato|file terlampir)\)\s*$/i;
const VOICE = /audio omitted|audio omitido|áudio ocultado|audio weggelassen|audio omis|<attached: [^>]*\.opus>|ptt-[^ ]*\.opus|\.opus \(/i;
const ENCRYPTION = /end-to-end encrypted|cifrad[oa]s? de extremo a extremo|criptografia de ponta a ponta|ende-zu-ende-verschlüsselt|chiffrés de bout en bout|crittografia end-to-end|terenkripsi end-to-end/i;

/**
 * Parse an exported chat.
 * @param {string} raw            file contents
 * @param {object} [opts]
 * @param {'DMY'|'MDY'|'YMD'} [opts.dateOrder]  override auto-detection
 * @param {(fraction:number)=>void} [opts.onProgress]
 */
export function parseChat(raw, opts = {}) {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const entries = [];
  let cur = null;
  let leading = 0;
  let iosVotes = 0;
  const step = Math.max(1, Math.floor(lines.length / 20));

  for (let i = 0; i < lines.length; i++) {
    if (opts.onProgress && i % step === 0) opts.onProgress(i / lines.length);
    const line = lines[i].replace(ODD_SPACES, ' ');
    const stripped = line.replace(BIDI, '');
    const m = HEADER.exec(stripped);
    const valid = m && (m[1] ? m[9] : m[10]);
    if (!valid) {
      if (cur) cur.cont.push(stripped);
      else if (line.trim()) leading++;
      continue;
    }
    if (m[1]) iosVotes++;
    // Take the rest from the un-stripped line so we can see iOS's U+200E marker.
    const cut = m[1] ? line.indexOf(']') + 1 : line.search(/[-–—]\s/) + 2;
    const restRaw = line.slice(cut).replace(/^ +/, '');
    cur = {
      a: +m[2], b: +m[3], c: +m[4], aLen: m[2].length,
      h: +m[5], mi: +m[6], s: m[7] ? +m[7] : 0,
      ampm: m[8] ? (m[8][0].toLowerCase() === 'p' ? 'pm' : 'am') : '',
      restRaw, cont: [],
    };
    entries.push(cur);
  }

  if (!entries.length) {
    const err = new Error("We couldn't find any messages in this file.");
    err.code = 'NO_MESSAGES';
    err.sample = redactSample(text);
    throw err;
  }

  const hour12 = entries.filter(e => e.ampm).length > entries.length / 2;
  const dateOrder = opts.dateOrder || detectDateOrder(entries, hour12);
  const messages = [];
  let invalid = 0;

  for (const e of entries) {
    const ts = toTimestamp(e, dateOrder);
    if (ts == null) { invalid++; continue; }
    const msg = splitRest(e.restRaw);
    while (e.cont.length && !e.cont[e.cont.length - 1].trim()) e.cont.pop();
    if (e.cont.length) msg.text += '\n' + e.cont.join('\n');
    msg.ts = ts;
    classify(msg);
    delete msg.lrm;
    messages.push(msg);
  }

  // Stable sort: exports are chronological, but guard against odd clocks.
  messages.sort((x, y) => x.ts - y.ts);

  const counts = new Map();
  for (const m of messages) if (m.type !== 'system') counts.set(m.author, (counts.get(m.author) || 0) + 1);
  const participants = [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([n]) => n);

  if (!participants.length) {
    const err = new Error('We found timestamps but no messages from people.');
    err.code = 'NO_MESSAGES';
    err.sample = redactSample(text);
    throw err;
  }

  opts.onProgress?.(1);
  return {
    messages,
    participants,
    meta: {
      platform: iosVotes > entries.length / 2 ? 'ios' : 'android',
      dateOrder, hour12,
      lines: lines.length,
      skippedLeadingLines: leading,
      invalidDates: invalid,
    },
  };
}

function detectDateOrder(entries, hour12) {
  let ymd = 0, aBig = 0, bBig = 0;
  for (const e of entries) {
    if (e.aLen === 4) { ymd++; continue; }
    if (e.a > 12) aBig++;
    if (e.b > 12) bBig++;
  }
  if (ymd > entries.length / 2) return 'YMD';
  if (aBig && !bBig) return 'DMY';
  if (bBig && !aBig) return 'MDY';
  if (aBig && bBig) return aBig >= bBig ? 'DMY' : 'MDY';
  // Ambiguous (all days <= 12): pick the order that keeps time moving forward.
  const back = order => {
    let n = 0, prev = -Infinity;
    for (const e of entries) {
      const t = toTimestamp(e, order);
      if (t == null) { n += 2; continue; }
      if (t < prev) n++;
      prev = t;
    }
    return n;
  };
  const dmy = back('DMY'), mdy = back('MDY');
  if (dmy !== mdy) return dmy < mdy ? 'DMY' : 'MDY';
  return hour12 ? 'MDY' : 'DMY';
}

function toTimestamp(e, order) {
  let y, mo, d;
  if (order === 'YMD') [y, mo, d] = [e.a, e.b, e.c];
  else if (order === 'MDY') [mo, d, y] = [e.a, e.b, e.c];
  else [d, mo, y] = [e.a, e.b, e.c];
  if (y < 100) y += 2000;
  let h = e.h;
  if (e.ampm === 'pm' && h < 12) h += 12;
  if (e.ampm === 'am' && h === 12) h = 0;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || e.mi > 59 || y < 2009 || y > 2100) return null;
  const ts = Date.UTC(y, mo - 1, d, h, e.mi, e.s);
  if (new Date(ts).getUTCDate() !== d) return null; // e.g. 31/02
  return ts;
}

function splitRest(restRaw) {
  const idx = restRaw.indexOf(': ');
  let author = null, textRaw = restRaw;
  if (idx > 0 && idx <= 80) {
    const cand = restRaw.slice(0, idx).replace(BIDI, '').trim();
    if (cand && !/["“”«»]/.test(cand)) { author = cand; textRaw = restRaw.slice(idx + 2); }
  } else if (/^[^:]{1,80}:$/.test(restRaw.replace(BIDI, '').trim())) {
    author = restRaw.replace(BIDI, '').trim().slice(0, -1);
    textRaw = '';
  }
  if (author) author = author.replace(/^~\s*/, '').trim();
  return {
    author,
    text: textRaw.replace(BIDI, ''),
    lrm: /^[‎‏]/.test(textRaw),
    type: 'text',
  };
}

function classify(msg) {
  if (EDITED.test(msg.text)) { msg.text = msg.text.replace(EDITED, ''); msg.edited = true; }
  const t = msg.text.trim();
  const low = t.toLowerCase().replace(/[.。!]+$/, '');
  if (!msg.author) { msg.type = 'system'; return; }
  if (DELETED.has(low)) { msg.type = 'deleted'; return; }
  if (MEDIA.has(low) || /^<[^<>\n]{2,40}>$/.test(t) || FILE_ATTACHED.test(t) || (msg.lrm && IOS_MEDIA.test(t))) {
    msg.type = 'media';
    if (VOICE.test(t)) msg.voice = true;
    return;
  }
  if (msg.lrm || ENCRYPTION.test(t)) { msg.type = 'system'; return; }
}

/** Replace letters with x so a user can share the *shape* of their format. */
export function redactSample(text, maxLines = 6) {
  return text
    .split('\n')
    .filter(l => l.trim())
    .slice(0, maxLines)
    .map(l => l.replace(/\p{L}/gu, 'x').replace(BIDI, '⟨LRM⟩').replace(ODD_SPACES, '⟨sp⟩'))
    .join('\n');
}
