# Generates the PWA icons (gradient + speech bubble) with no dependencies.
import zlib, struct, math, sys
def png(path, n):
    rows = []
    for y in range(n):
        row = bytearray([0])
        for x in range(n):
            t = max(0.0, 1 - ((x - n / 2) ** 2 + (y + n * 0.2) ** 2) ** 0.5 / n)
            r = g = b = int(10 + 30 * t)
            cx, cy, rad = n * 0.5, n * 0.46, n * 0.27
            inside = (x - cx) ** 2 + (y - cy) ** 2 < rad ** 2
            tail = n * 0.30 < x < n * 0.42 and n * 0.62 < y < n * 0.75 and (x - n * 0.30) > (y - n * 0.62) * 0.9
            if inside or tail:
                r = g = b = 255
                for dx in (-0.11, 0, 0.11):
                    if (x - (cx + dx * n)) ** 2 + (y - cy) ** 2 < (n * 0.035) ** 2:
                        r, g, b = 0, 0, 0
            row += bytes((r, g, b))
        rows.append(bytes(row))
    raw = zlib.compress(b''.join(rows), 9)
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 2, 0, 0, 0)) + chunk(b'IDAT', raw) + chunk(b'IEND', b''))
for n in (192, 512): png(f'icons/icon-{n}.png', n)
