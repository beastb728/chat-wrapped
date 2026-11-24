// Cookieless visit counting via GoatCounter. Runs once when the page loads,
// before any chat is opened, and only sends the page path and title.
// Your chat is never involved, and the network badge proves nothing is sent after you open one.
import { GOATCOUNTER_CODE } from './config.js';

export function initVisits(el) {
  if (!GOATCOUNTER_CODE || !navigator.onLine) return;
  const base = `https://${GOATCOUNTER_CODE}.goatcounter.com`;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  // Count this visit with a tracking pixel (no cookies, no script from a third party).
  if (!local) {
    const q = new URLSearchParams({ p: '/', t: 'Chat Wrapped', rnd: Math.random().toString(36).slice(2) });
    new Image().src = `${base}/count?${q}`;
  }

  // Show the public total. Needs "Allow adding visitor counts on your website"
  // enabled in GoatCounter's site settings.
  fetch(`${base}/counter/TOTAL.json`, { credentials: 'omit', referrerPolicy: 'no-referrer' })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      if (!d?.count) return;
      el.textContent = `🔥 ${d.count} visits so far`;
      el.hidden = false;
    })
    .catch(() => {});
}
