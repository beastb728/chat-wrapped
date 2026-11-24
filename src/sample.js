// Generates a fictional group chat in Android export format, so people can try
// everything without uploading anything. Deterministic (seeded).

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEOPLE = [
  { name: 'Maya', weight: 3.8, speed: 2, hours: [9, 23], emoji: 0.5, lines: ['omg yes', 'wait what 😭', 'I’m literally screaming', 'ok but hear me out', 'same 💀', 'nooo 😭😭', 'love this ❤️', 'who’s coming??', 'brb', 'okay omw 🏃‍♀️', 'stoppp 😂', 'this is so us', 'ok who ate my fries at the party', 'I need a vacation from my vacation', 'can we please do karaoke again soon', 'the group photo is actually iconic', 'I’m wearing the yellow jacket tonight', 'tell me why I just cried at an ad'] },
  { name: 'Leo', weight: 2.0, speed: 9, hours: [13, 28], emoji: 0.15, double: 0.25, lines: ['anyone up', 'bro', 'hello??', 'can’t sleep again', 'ok hear me out: tacos', 'guys', 'did nobody see my message', 'lowkey hungry', 'night shift brain', 'yo', 'just discovered a 24 hour bakery near me', 'why is my brain so awake at this hour', 'hot take: cereal is a soup', 'who wants to watch the meteor shower tonight', 'I fixed my bike at 3am, ask me anything', 'can someone remind me what day it is'] },
  { name: 'Priya', weight: 1.5, speed: 6, hours: [6, 21], emoji: 0.1, long: true, lines: ['Good morning everyone ☀️', 'Okay so I looked into it and the cheapest option is the train on Saturday morning, which gets us there by 11, and we can split a car from the station.', 'Honestly I think we should just book it now before prices go up again, last time we waited and it doubled.', 'Morning! Did everyone see the plan I sent?', 'I made a list of things we still need for the trip, adding it below.', 'Sorry, been in meetings all day, catching up now', 'Reminder that the deposit for the cabin is due on Friday everyone', 'I booked a table for six at the new Italian place downtown', 'Can we agree on a budget before we plan anything else please', 'Weather forecast says sunshine all weekend so pack accordingly', 'I made a shared playlist for the road trip, add your songs'] },
  { name: 'Sam', weight: 0.8, speed: 120, hours: [11, 22], emoji: 0.05, lines: ['ya', 'k', 'sounds good', 'sorry just saw this', 'I’m in', 'lol', 'maybe', 'sorry was asleep', 'wait what did I miss here', 'I can bring the speaker this time', 'my phone died for three days sorry', 'just saw all of this now honestly'] },
  { name: 'Jonas', weight: 1.6, speed: 4, hours: [10, 24], emoji: 0.35, media: 0.25, lines: ['HAHAHAHA', 'hahaha no way', 'lmaooo', '😂😂😂', 'I can’t 🤣', 'hahah legend', 'kkkkkk my brazilian side is out', 'this group is unhinged 😂', 'look at this', 'check this https://example.com/video', 'I am never going camping with you again', 'the dog stole my sandwich again today', 'whoever made this group deserves a medal', 'I just laughed so loud on the bus', 'the face Sam made in that photo though'] },
];

export function generateSampleChat() {
  const r = rng(2026);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const weighted = (exclude) => {
    const pool = PEOPLE.filter(p => p !== exclude);
    let x = r() * pool.reduce((s, p) => s + p.weight, 0);
    for (const p of pool) { x -= p.weight; if (x <= 0) return p; }
    return pool[0];
  };
  const pad = n => String(n).padStart(2, '0');
  const fmt = ts => {
    const d = new Date(ts);
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  };
  const out = [];
  const start = Date.UTC(2026, 0, 1, 10, 0);
  out.push(`${fmt(start)} - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.`);
  out.push(`${fmt(start)} - Maya created group "Weekend Crew 🌊"`);
  out.push(`${fmt(start)} - Maya added Leo, Priya, Sam and Jonas`);

  const quietFrom = Date.UTC(2026, 7, 3), quietTo = Date.UTC(2026, 7, 19);
  const bigDay = Date.UTC(2026, 5, 12);
  for (let day = 0; day < 328; day++) {
    const dayTs = start - 10 * 3600_000 + day * 86_400_000;
    if (dayTs >= quietFrom && dayTs < quietTo) continue;
    const isBig = dayTs === bigDay;
    if (!isBig && r() > 0.8) continue;
    const convos = isBig ? 6 : 1 + Math.floor(r() * 3);
    for (let c = 0; c < convos; c++) {
      let author = weighted(null);
      if (r() < 0.35) author = PEOPLE[2]; // Priya starts a lot
      const [h0, h1] = author.hours;
      let ts = dayTs + (h0 + r() * (h1 - h0)) * 3600_000 + Math.floor(r() * 60) * 60_000;
      const len = isBig ? 60 + Math.floor(r() * 40) : 4 + Math.floor(r() * 26);
      for (let i = 0; i < len; i++) {
        let text = pick(author.lines);
        if (author.media && r() < author.media) text = '<Media omitted>';
        else if (r() < author.emoji && !/\p{Extended_Pictographic}/u.test(text)) text += ' ' + pick(['😂', '❤️', '🔥', '😭', '👀', '🙌']);
        if (r() < 0.004) text = 'This message was deleted';
        if (author.long && r() < 0.15) text += '\n1. Snacks\n2. Speaker\n3. Sunscreen (Sam!!)';
        out.push(`${fmt(ts)} - ${author.name}: ${text}`);
        const next = author.double && r() < author.double ? author : weighted(author);
        const speed = next === author ? 25 + r() * 40 : next.speed * (0.3 + r() * 1.6);
        ts += Math.max(1, Math.round(speed)) * 60_000;
        author = next;
      }
    }
  }
  return out.join('\n') + '\n';
}
