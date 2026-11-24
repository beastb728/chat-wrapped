import { isZip, listZip, readZipEntry, findChatEntry } from './zip.js';

/** Turn an uploaded File/Blob (.txt or .zip) into chat text. */
export async function fileToChatText(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (isZip(bytes)) {
    const entry = findChatEntry(listZip(bytes));
    if (!entry) throw Object.assign(new Error('No chat .txt file inside this zip.'), { code: 'NO_TXT' });
    return decode(await readZipEntry(bytes, entry));
  }
  return decode(bytes);
}

function decode(bytes) {
  // UTF-16 exports exist on a few old Android builds.
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes);
}
