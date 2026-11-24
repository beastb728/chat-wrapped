// Minimal zip reader using the browser's built-in DecompressionStream.
// No dependencies: supports stored (0) and deflate (8) entries, which is what
// WhatsApp (and every OS "compress" menu) produces. Zip64 is not supported.

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;
const SIG_LOC = 0x04034b50;

export function isZip(bytes) {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export function listZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw Object.assign(new Error('This zip file looks damaged.'), { code: 'BAD_ZIP' });
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const utf8 = new TextDecoder('utf-8');
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== SIG_CEN) break;
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, compSize, size, local, encrypted: !!(flags & 1) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export async function readZipEntry(bytes, entry) {
  if (entry.encrypted) throw Object.assign(new Error('This zip is password-protected.'), { code: 'BAD_ZIP' });
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(entry.local, true) !== SIG_LOC) throw Object.assign(new Error('This zip file looks damaged.'), { code: 'BAD_ZIP' });
  const start = entry.local + 30 + dv.getUint16(entry.local + 26, true) + dv.getUint16(entry.local + 28, true);
  const data = bytes.subarray(start, start + entry.compSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw Object.assign(new Error(`Unsupported zip compression (${entry.method}).`), { code: 'BAD_ZIP' });
}

/** Pick the chat transcript out of a WhatsApp export zip. */
export function findChatEntry(entries) {
  const txt = entries.filter(e => /\.txt$/i.test(e.name) && !/(^|\/)__MACOSX\//.test(e.name) && !/(^|\/)\._/.test(e.name));
  return txt.find(e => /(^|\/)_chat\.txt$/i.test(e.name)) || txt.sort((a, b) => b.size - a.size)[0] || null;
}
