// Draws Wrapped cards on a 1080×1920 canvas (Instagram / WhatsApp Status size).
// The same drawing is shown on screen and exported, so what you see is what you share.
// Cards contain stats only, never message text.
import { fmtDur } from './stats.js';

export const W = 1080, H = 1920;
const FONT = 'Inter, "SF Pro Display", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// One accent per card on a black canvas. Muted, not neon.
const ACCENT = {
  intro: '#ffffff',
  mvp: '#bef264',
  starters: '#fdba74',
  speed: '#67e8f9',
  hours: '#a5b4fc',
  emojis: '#fcd34d',
  words: '#c4b5fd',
  streak: '#fda4af',
  bigday: '#f9a8d4',
  awards: '#fcd34d',
  person: '#5eead4',
  duo: '#fda4af',
  outro: '#ffffff',
  game: '#67e8f9',
};

const fmtNum = n => Math.round(n).toLocaleString('en');
const fmtDate = ts => { const d = new Date(ts); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
const fmtShort = ts => { const d = new Date(ts); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
const fmtHour = h => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
const pct = x => `${Math.round(x * 100)}%`;

function font(ctx, size, weight = 600) {
  ctx.font = `${Math.min(weight, 700)} ${size}px ${FONT}`;
  // Tight tracking on display sizes, like the site headline.
  if ('letterSpacing' in ctx) ctx.letterSpacing = size >= 80 ? `${(-size * 0.035).toFixed(1)}px` : '0px';
}

function text(ctx, str, x, y, { size = 60, weight = 600, color = '#fafafa', align = 'left', max = W - 160, min = 24, alpha = 1 } = {}) {
  let s = size;
  font(ctx, s, weight);
  while (ctx.measureText(str).width > max && s > min) { s -= 2; font(ctx, s, weight); }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
  return s;
}

function wrap(ctx, str, x, y, { size = 48, weight = 500, color = '#a1a1aa', max = W - 160, lh = 1.25, align = 'left', maxLines = 4, alpha = 1 } = {}) {
  font(ctx, size, weight);
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((l, i) => text(ctx, l, x, y + i * size * lh, { size, weight, color, align, max, alpha }));
  return y + Math.min(lines.length, maxLines) * size * lh;
}

function background(ctx) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  // Faint grid...
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 90) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 90) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  // ...that fades out away from the top.
  const fade = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.75);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.55, 'rgba(0,0,0,0.85)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);
  // Soft light from the top.
  const top = ctx.createRadialGradient(W / 2, -200, 0, W / 2, -200, 900);
  top.addColorStop(0, 'rgba(255,255,255,0.14)');
  top.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H);
}

/** Glowing planet horizon near the bottom, in the card's accent color. */
function horizon(ctx, accent) {
  const R = 2600, cy = H - 250 + R;
  const glow = ctx.createRadialGradient(W / 2, H - 250, 0, W / 2, H - 250, 520);
  glow.addColorStop(0, hexA(accent, 0.28));
  glow.addColorStop(1, hexA(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, H - 800, W, 560);
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.shadowColor = hexA(accent, 0.9);
  ctx.shadowBlur = 70;
  ctx.fill();
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(W / 2, cy, R, Math.PI * 1.25, Math.PI * 1.75);
  ctx.strokeStyle = hexA(accent, 0.95);
  ctx.lineWidth = 3;
  ctx.stroke();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function frame(ctx, o, theme) {
  background(ctx);
  horizon(ctx, ACCENT[theme]);
  // Outlined pill label, like the site's eyebrow.
  const label = `CHAT WRAPPED · ${o.label.toUpperCase()}`;
  font(ctx, 26, 500);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  const lw = ctx.measureText(label).width;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  roundRect(ctx, 80, 92, lw + 56, 58, 29);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a1a1aa';
  ctx.textAlign = 'left';
  ctx.fillText(label, 108, 131);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  // Footer: the link is how the next group finds the site.
  text(ctx, o.site, W / 2, H - 120, { size: 38, weight: 600, align: 'center', max: W - 200 });
  text(ctx, 'Made on-device. Your chat never left the phone.', W / 2, H - 72, { size: 26, weight: 400, align: 'center', color: '#71717a' });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bars(ctx, rows, y, { accent = '#fff', valueFmt = fmtNum, rowH = 150, max } = {}) {
  const top = max ?? Math.max(...rows.map(r => r.value), 1);
  rows.forEach((r, i) => {
    const yy = y + i * rowH;
    text(ctx, r.label, 80, yy, { size: 44, weight: 500, max: 640, color: i === 0 ? '#fafafa' : '#d4d4d8' });
    text(ctx, r.display ?? valueFmt(r.value), W - 80, yy, { size: 44, weight: 600, align: 'right', max: 300, color: i === 0 ? accent : '#d4d4d8' });
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, 80, yy + 28, W - 160, 14, 7); ctx.fill();
    ctx.fillStyle = i === 0 ? accent : 'rgba(255,255,255,0.45)';
    roundRect(ctx, 80, yy + 28, Math.max(14, (W - 160) * (r.bar ?? r.value / top)), 14, 7); ctx.fill();
  });
  return y + rows.length * rowH;
}

// --- Card definitions -------------------------------------------------------

function introCard(s, o) {
  return { id: 'intro', title: 'Intro', draw(ctx) {
    frame(ctx, o, 'intro');
    text(ctx, s.year ? "Your chat's" : 'Your chat,', 80, 480, { size: 84, weight: 700 });
    text(ctx, s.year ? String(s.year) : 'all time', 70, 760, { size: 300, weight: 900, max: W - 140 });
    text(ctx, 'Wrapped', 80, 930, { size: 150, weight: 900, color: '#8b8b93' });
    const rows = [
      [fmtNum(s.totals.messages), 'messages'],
      [fmtNum(s.totals.people), s.totals.people === 1 ? 'person' : 'people'],
      [fmtNum(s.totals.activeDays), 'days of chatting'],
    ];
    rows.forEach(([n, l], i) => {
      const y = 1170 + i * 140;
      text(ctx, n, 80, y, { size: 96, weight: 900 });
      const nw = ctx.measureText(n).width;
      text(ctx, l, 80 + nw + 24, y, { size: 52, weight: 600, alpha: 0.9 });
    });
    text(ctx, 'Swipe to see who carries this chat', 80, 1620, { size: 40, weight: 700, alpha: 0.85 });
  } };
}

function mvpCard(s, o) {
  const top = s.people[0];
  const rows = s.people.slice(0, 6).map(p => ({ label: o.name(p.name), value: p.messages }));
  return { id: 'mvp', title: 'Top texter', draw(ctx) {
    frame(ctx, o, 'mvp');
    text(ctx, 'The main character', 80, 330, { size: 64, weight: 700 });
    text(ctx, o.name(top.name), 80, 520, { size: 170, weight: 900, color: ACCENT.mvp });
    wrap(ctx, `sent ${fmtNum(top.messages)} messages: ${pct(top.share)} of the whole chat`, 80, 620, { size: 50, weight: 600 });
    bars(ctx, rows, 880, { accent: ACCENT.mvp, rowH: Math.min(150, 700 / rows.length) });
  } };
}

function startersCard(s, o) {
  const ppl = [...s.people].sort((a, b) => b.starts - a.starts).slice(0, 6);
  const total = s.people.reduce((t, p) => t + p.starts, 0) || 1;
  const rows = ppl.map(p => ({ label: o.name(p.name), value: p.starts, display: pct(p.starts / total) }));
  return { id: 'starters', title: 'Conversation starters', draw(ctx) {
    frame(ctx, o, 'starters');
    text(ctx, 'Who breaks', 80, 560, { size: 110, weight: 900 });
    text(ctx, 'the silence', 80, 680, { size: 110, weight: 900, color: ACCENT.starters });
    wrap(ctx, `${o.name(ppl[0].name)} kicked off ${pct(ppl[0].starts / total)} of the chat's ${fmtNum(s.totals.conversations)} conversations`, 80, 800, { size: 46 });
    bars(ctx, rows, 1040, { accent: ACCENT.starters, rowH: Math.min(140, 600 / rows.length) });
  } };
}

function speedCard(s, o) {
  const ppl = s.people.filter(p => p.medianReplyMs != null && p.replies >= 3).sort((a, b) => a.medianReplyMs - b.medianReplyMs).slice(0, 6);
  if (ppl.length < 2) return null;
  const slow = ppl[ppl.length - 1].medianReplyMs;
  const rows = ppl.map(p => ({ label: o.name(p.name), value: p.medianReplyMs, display: fmtDur(p.medianReplyMs), bar: Math.max(0.04, p.medianReplyMs / slow) }));
  return { id: 'speed', title: 'Reply speed', draw(ctx) {
    frame(ctx, o, 'speed');
    text(ctx, 'Reply speed', 80, 580, { size: 120, weight: 900 });
    wrap(ctx, `${o.name(ppl[0].name)} replies in ${fmtDur(ppl[0].medianReplyMs)}. ${o.name(ppl[ppl.length - 1].name)} takes ${fmtDur(slow)}.`, 80, 690, { size: 50 });
    bars(ctx, rows, 980, { accent: ACCENT.speed, rowH: Math.min(140, 600 / rows.length) });
    text(ctx, 'median time to reply', 80, 1660, { size: 32, weight: 600, alpha: 0.7 });
  } };
}

function hoursCard(s, o) {
  const peak = s.hours.indexOf(Math.max(...s.hours));
  const wd = s.weekdays.indexOf(Math.max(...s.weekdays));
  const night = s.hours.slice(0, 5).reduce((a, b) => a + b, 0) / s.totals.messages;
  return { id: 'hours', title: 'Prime time', draw(ctx) {
    frame(ctx, o, 'hours');
    text(ctx, 'Prime time', 80, 340, { size: 70, weight: 700 });
    text(ctx, fmtHour(peak), 80, 600, { size: 250, weight: 900, color: ACCENT.hours });
    wrap(ctx, `is when this chat comes alive. Busiest day of the week: ${WEEKDAYS[wd]}.`, 80, 700, { size: 50 });
    const max = Math.max(...s.hours), x0 = 80, bw = (W - 160) / 24, base = 1450, hMax = 480;
    s.hours.forEach((v, h) => {
      const bh = Math.max(6, (v / max) * hMax);
      ctx.fillStyle = h === peak ? ACCENT.hours : 'rgba(255,255,255,0.28)';
      roundRect(ctx, x0 + h * bw + 3, base - bh, bw - 6, bh, 8); ctx.fill();
    });
    ['12a', '6a', '12p', '6p'].forEach((l, i) => text(ctx, l, x0 + i * 6 * bw + 4, base + 54, { size: 30, weight: 700, alpha: 0.7 }));
    if (night >= 0.03) text(ctx, `${pct(night)} of messages sent after midnight`, 80, 1640, { size: 40, weight: 700 });
  } };
}

function emojiCard(s, o) {
  if (!s.topEmojis.length) return null;
  const top = s.topEmojis.slice(0, 5);
  const per = s.people.filter(p => p.topEmojis.length).slice(0, 6);
  return { id: 'emojis', title: 'Emojis', draw(ctx) {
    frame(ctx, o, 'emojis');
    text(ctx, 'Emoji DNA', 80, 340, { size: 110, weight: 900 });
    text(ctx, `${fmtNum(s.totals.emojis)} emojis sent`, 80, 430, { size: 48, weight: 600, alpha: 0.9 });
    text(ctx, top[0][0], W / 2, 760, { size: 280, align: 'center' });
    text(ctx, `#1 · used ${fmtNum(top[0][1])} times`, W / 2, 860, { size: 44, weight: 800, align: 'center' });
    top.slice(1).forEach(([e, c], i) => {
      const x = 80 + i * ((W - 160) / 4) + (W - 160) / 8;
      text(ctx, e, x, 1060, { size: 120, align: 'center' });
      text(ctx, fmtNum(c), x, 1130, { size: 36, weight: 800, align: 'center' });
    });
    per.forEach((p, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 80 + col * 470, y = 1300 + row * 105;
      text(ctx, `${p.topEmojis[0][0]}  ${o.name(p.name)}`, x, y, { size: 46, weight: 800, max: 440 });
    });
  } };
}

function wordsCard(s, o) {
  const ppl = s.people.filter(p => p.signatureWords.length).slice(0, 6);
  if (ppl.length < 2) return null;
  return { id: 'words', title: 'Signature words', draw(ctx) {
    frame(ctx, o, 'words');
    text(ctx, 'Words that are', 80, 340, { size: 90, weight: 900 });
    text(ctx, 'SO them', 80, 460, { size: 130, weight: 900, color: ACCENT.words });
    const rowH = Math.min(190, 1000 / ppl.length);
    ppl.forEach((p, i) => {
      const y = 650 + i * rowH;
      text(ctx, o.name(p.name), 80, y, { size: 40, weight: 700, alpha: 0.85 });
      text(ctx, `“${p.signatureWords[0][0]}”`, 80, y + 80, { size: 76, weight: 900, max: 700 });
      text(ctx, `×${fmtNum(p.signatureWords[0][1])}`, W - 80, y + 80, { size: 44, weight: 800, align: 'right', alpha: 0.85 });
    });
  } };
}

function streakCard(s, o) {
  const silenceDays = Math.floor(s.silence.ms / 86_400_000);
  return { id: 'streak', title: 'Streaks', draw(ctx) {
    frame(ctx, o, 'streak');
    text(ctx, 'Longest streak', 80, 340, { size: 70, weight: 700 });
    text(ctx, fmtNum(s.streak.days), 70, 640, { size: 300, weight: 900, color: ACCENT.streak });
    text(ctx, `days in a row`, 80, 740, { size: 64, weight: 800 });
    text(ctx, `${fmtShort(s.streak.from)} – ${fmtDate(s.streak.to)}`, 80, 820, { size: 42, weight: 600, alpha: 0.85 });
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(80, 960, W - 160, 2);
    text(ctx, 'Longest silence', 80, 1110, { size: 70, weight: 700 });
    if (silenceDays >= 1) {
      text(ctx, `${fmtNum(silenceDays)} days`, 70, 1300, { size: 170, weight: 900 });
      text(ctx, `${fmtShort(s.silence.from)} – ${fmtDate(s.silence.to)}`, 80, 1390, { size: 42, weight: 600, alpha: 0.85 });
      wrap(ctx, 'Who broke it? Check the chat.', 80, 1520, { size: 46, weight: 700 });
    } else {
      text(ctx, fmtDur(s.silence.ms), 70, 1300, { size: 170, weight: 900 });
      wrap(ctx, 'This chat never sleeps.', 80, 1420, { size: 50, weight: 700 });
    }
  } };
}

function bigDayCard(s, o) {
  const avg = s.totals.messages / s.totals.activeDays;
  const d = new Date(s.busiestDay.ts);
  return { id: 'bigday', title: 'Biggest day', draw(ctx) {
    frame(ctx, o, 'bigday');
    text(ctx, 'The day the chat', 80, 590, { size: 84, weight: 900 });
    text(ctx, 'exploded', 80, 700, { size: 120, weight: 900, color: ACCENT.bigday });
    text(ctx, MONTHS[d.getUTCMonth()], 80, 960, { size: 140, weight: 900 });
    text(ctx, String(d.getUTCDate()), 80, 1200, { size: 260, weight: 900 });
    text(ctx, String(d.getUTCFullYear()), 80, 1290, { size: 60, weight: 700, alpha: 0.85 });
    wrap(ctx, `${fmtNum(s.busiestDay.count)} messages in one day: ${(s.busiestDay.count / avg).toFixed(0)}× a normal day. What happened?!`, 80, 1430, { size: 50, weight: 700 });
  } };
}

function awardsCard(s, o) {
  const list = s.awards.slice(0, 8);
  if (!list.length) return null;
  return { id: 'awards', title: 'Awards', draw(ctx) {
    frame(ctx, o, 'awards');
    text(ctx, 'The Awards', 80, 330, { size: 110, weight: 900, color: ACCENT.awards });
    const rowH = Math.min(150, 1100 / list.length);
    list.forEach((a, i) => {
      const y = 500 + i * rowH;
      text(ctx, a.emoji, 80, y + 40, { size: 84 });
      text(ctx, a.title, 210, y, { size: 40, weight: 700, alpha: 0.8, max: W - 300 });
      text(ctx, o.name(a.name), 210, y + 62, { size: 58, weight: 900, max: W - 300 });
    });
  } };
}

function personCard(s, o, arch, idx) {
  const p = s.people.find(x => x.name === arch.name);
  return { id: `person-${idx}`, title: o.name(p.name), draw(ctx) {
    frame(ctx, o, 'person');
    text(ctx, o.name(p.name), 80, 330, { size: 110, weight: 900, max: W - 160 });
    text(ctx, 'is', 80, 420, { size: 56, weight: 600, alpha: 0.85 });
    text(ctx, arch.emoji, W / 2, 820, { size: 340, align: 'center' });
    text(ctx, arch.title, W / 2, 1030, { size: 110, weight: 900, align: 'center', color: ACCENT.person });
    wrap(ctx, arch.line, W / 2, 1120, { size: 46, weight: 600, align: 'center', max: W - 200, maxLines: 3 });
    const tiles = [
      [fmtNum(p.messages), 'messages'],
      [p.medianReplyMs != null ? fmtDur(p.medianReplyMs) : '–', 'reply time'],
      [p.topEmojis[0]?.[0] ?? '—', 'top emoji'],
    ];
    tiles.forEach(([v, l], i) => {
      const tw = (W - 160 - 40) / 3, x = 80 + i * (tw + 20);
      roundRect(ctx, x, 1360, tw, 220, 36); ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, v, x + tw / 2, 1480, { size: 76, weight: 900, align: 'center', max: tw - 30 });
      text(ctx, l, x + tw / 2, 1540, { size: 32, weight: 700, align: 'center', alpha: 0.8 });
    });
  } };
}

function duoCard(s, o) {
  if (s.people.length !== 2) return null;
  const [a, b] = s.people;
  const rows = [
    ['Messages', fmtNum(a.messages), fmtNum(b.messages)],
    ['Reply time', fmtDur(a.medianReplyMs), fmtDur(b.medianReplyMs)],
    ['"Love you"s', fmtNum(a.love), fmtNum(b.love)],
    ['Good mornings', fmtNum(a.morning), fmtNum(b.morning)],
    ['Sorrys', fmtNum(a.sorry), fmtNum(b.sorry)],
    ['Started chats', fmtNum(a.starts), fmtNum(b.starts)],
  ];
  return { id: 'duo', title: 'You two', draw(ctx) {
    frame(ctx, o, 'duo');
    text(ctx, 'You two', 80, 340, { size: 120, weight: 900 });
    text(ctx, o.name(a.name), 80, 520, { size: 64, weight: 900, max: 440 });
    text(ctx, o.name(b.name), W - 80, 520, { size: 64, weight: 900, align: 'right', max: 440 });
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; roundRect(ctx, 80, 560, W - 160, 60, 30); ctx.fill();
    ctx.fillStyle = ACCENT.duo; roundRect(ctx, 80, 560, Math.max(60, (W - 160) * a.share), 60, 30); ctx.fill();
    text(ctx, pct(a.share), 110, 604, { size: 36, weight: 900, color: '#000' });
    text(ctx, pct(b.share), W - 110, 604, { size: 36, weight: 900, align: 'right' });
    rows.forEach(([label, va, vb], i) => {
      const y = 800 + i * 145;
      text(ctx, label, W / 2, y - 50, { size: 34, weight: 700, align: 'center', alpha: 0.8 });
      text(ctx, va, 80, y + 10, { size: 70, weight: 900 });
      text(ctx, vb, W - 80, y + 10, { size: 70, weight: 900, align: 'right' });
    });
  } };
}

function outroCard(s, o) {
  return { id: 'outro', title: 'Outro', draw(ctx) {
    background(ctx);
    horizon(ctx, ACCENT.outro);
    text(ctx, "That's a", 80, 560, { size: 120, weight: 800 });
    text(ctx, 'wrap.', 80, 760, { size: 230, weight: 900, color: ACCENT.outro });
    wrap(ctx, 'Think your group chat is crazier? Prove it.', 80, 940, { size: 64, weight: 800 });
    ['✓ Runs entirely in your browser', '✓ Nothing uploaded, no account', '✓ Works in airplane mode']
      .forEach((l, i) => text(ctx, l, 80, 1180 + i * 80, { size: 46, weight: 700 }));
    ctx.fillStyle = '#ffffff'; roundRect(ctx, 80, 1480, W - 160, 160, 80); ctx.fill();
    text(ctx, o.site, W / 2, 1585, { size: 64, weight: 900, align: 'center', color: '#111', max: W - 240 });
  } };
}

/**
 * Build the deck.
 * @param stats         computeStats output
 * @param opts.hideNames  replace names with "Person A", "Person B"...
 * @param opts.showWords  include the signature-words card
 * @param opts.site       domain printed on cards
 */
export function buildDeck(stats, { hideNames = false, showWords = true, site = 'chatwrapped.app' } = {}) {
  const alias = new Map(stats.people.map((p, i) => [p.name, `Person ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}`]));
  const o = {
    site,
    label: stats.year ? String(stats.year) : 'All time',
    name: n => (hideNames ? alias.get(n) ?? 'Someone' : n),
  };
  const cards = [
    introCard(stats, o),
    mvpCard(stats, o),
    duoCard(stats, o),
    startersCard(stats, o),
    speedCard(stats, o),
    hoursCard(stats, o),
    emojiCard(stats, o),
    showWords ? wordsCard(stats, o) : null,
    streakCard(stats, o),
    bigDayCard(stats, o),
    awardsCard(stats, o),
    ...stats.archetypes.filter(a => a.title !== 'The Lurker' || stats.people.length <= 8).slice(0, 10).map((a, i) => personCard(stats, o, a, i)),
    outroCard(stats, o),
  ];
  return cards.filter(Boolean);
}

export function drawCard(canvas, card) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  card.draw(ctx);
}

/** Result card for "Who Said It?". Scores and names only, never message text. */
export function buildGameCard(sum, { hideNames = false, site = 'chatwrapped.app' } = {}) {
  const alias = new Map();
  const name = n => {
    if (!hideNames) return n;
    if (!alias.has(n)) alias.set(n, `Person ${String.fromCharCode(65 + (alias.size % 26))}`);
    return alias.get(n);
  };
  const o = { site, label: 'Who Said It?', name };
  const rate = sum.total ? sum.correct / sum.total : 0;
  const verdict = rate >= 0.8 ? 'Certified chat experts.' : rate >= 0.5 ? 'You know each other… mostly.' : 'Do you even read the chat?';
  return { id: 'game', title: 'Who Said It? result', draw(ctx) {
    frame(ctx, o, 'game');
    text(ctx, sum.scores.length ? 'Final score' : 'We scored', 80, 560, { size: 80, weight: 800 });
    text(ctx, `${sum.correct}/${sum.total}`, 70, 820, { size: 270, weight: 900, color: ACCENT.game });
    wrap(ctx, verdict, 80, 930, { size: 56, weight: 800 });
    let y = 1100;
    if (sum.scores.length) {
      sum.scores.slice(0, 4).forEach((p, i) => {
        text(ctx, `${i + 1}. ${name(p.name)}`, 80, y, { size: 56, weight: 800, max: 700 });
        text(ctx, `${p.score}`, W - 80, y, { size: 56, weight: 900, align: 'right' });
        y += 90;
      });
      y += 30;
    }
    if (sum.easiest) {
      text(ctx, `Easiest to spot: ${name(sum.easiest.name)}`, 80, y, { size: 44, weight: 700, max: W - 160 });
      y += 80;
    }
    if (sum.hardest && sum.hardest.name !== sum.easiest?.name) {
      text(ctx, `Total mystery: ${name(sum.hardest.name)}`, 80, y, { size: 44, weight: 700, max: W - 160 });
    }
  } };
}
