/**
 * Remove privacy-sensitive metadata (EXIF GPS/camera data, XMP, IPTC, text comments) from
 * uploaded JPEG, PNG and WebP images without re-encoding the pixels.
 * Any parse problem returns the original buffer unchanged, so a malformed file is never corrupted.
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// APP1 = EXIF / XMP, APP13 = Photoshop IRB / IPTC, COM = free-text comment
const JPEG_DROP_MARKERS = new Set([0xe1, 0xed, 0xfe]);

const PNG_DROP_CHUNKS = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt']);

const WEBP_DROP_CHUNKS = new Set(['EXIF', 'XMP ']);
const VP8X_EXIF_FLAG = 0x08;
const VP8X_XMP_FLAG = 0x04;

const stripJpeg = (buf: Buffer): Buffer => {
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
    const parts: Buffer[] = [buf.subarray(0, 2)];
    let i = 2;
    let dropped = false;

    while (i < buf.length) {
        if (buf[i] !== 0xff) return buf;
        // Skip fill bytes before a marker
        let markerPos = i;
        while (markerPos + 1 < buf.length && buf[markerPos + 1] === 0xff) markerPos++;
        if (markerPos + 1 >= buf.length) return buf;
        const marker = buf[markerPos + 1];

        // Standalone markers (no length field)
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
            parts.push(buf.subarray(i, markerPos + 2));
            i = markerPos + 2;
            continue;
        }
        if (marker === 0xd9) {
            parts.push(buf.subarray(i));
            i = buf.length;
            break;
        }

        if (markerPos + 4 > buf.length) return buf;
        const segLen = buf.readUInt16BE(markerPos + 2);
        if (segLen < 2) return buf;
        const segEnd = markerPos + 2 + segLen;
        if (segEnd > buf.length) return buf;

        if (marker === 0xda) {
            // Start of scan: the rest is compressed image data — keep it verbatim
            parts.push(buf.subarray(i));
            i = buf.length;
            break;
        }

        if (JPEG_DROP_MARKERS.has(marker)) {
            dropped = true;
        } else {
            parts.push(buf.subarray(i, segEnd));
        }
        i = segEnd;
    }

    return dropped ? Buffer.concat(parts) : buf;
};

const stripPng = (buf: Buffer): Buffer => {
    if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return buf;
    const parts: Buffer[] = [buf.subarray(0, 8)];
    let i = 8;
    let dropped = false;
    let sawEnd = false;

    while (i < buf.length) {
        if (i + 12 > buf.length) return buf;
        const len = buf.readUInt32BE(i);
        const type = buf.toString('latin1', i + 4, i + 8);
        if (!/^[A-Za-z]{4}$/.test(type)) return buf;
        const chunkEnd = i + 12 + len;
        if (chunkEnd > buf.length) return buf;

        if (PNG_DROP_CHUNKS.has(type)) {
            dropped = true;
        } else {
            parts.push(buf.subarray(i, chunkEnd));
        }
        i = chunkEnd;
        if (type === 'IEND') {
            sawEnd = true;
            break;
        }
    }

    if (!sawEnd) return buf;
    return dropped ? Buffer.concat(parts) : buf;
};

const stripWebp = (buf: Buffer): Buffer => {
    if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return buf;
    const riffEnd = Math.min(buf.length, 8 + buf.readUInt32LE(4));
    const chunks: Buffer[] = [];
    let i = 12;
    let dropped = false;
    let vp8xIndex = -1;

    while (i < riffEnd) {
        if (i + 8 > riffEnd) return buf;
        const fourcc = buf.toString('latin1', i, i + 4);
        const size = buf.readUInt32LE(i + 4);
        const padded = size + (size & 1);
        const chunkEnd = i + 8 + padded;
        if (chunkEnd > riffEnd) {
            // Some encoders omit the final pad byte
            if (i + 8 + size !== riffEnd) return buf;
        }
        const end = Math.min(chunkEnd, riffEnd);

        if (WEBP_DROP_CHUNKS.has(fourcc)) {
            dropped = true;
        } else {
            if (fourcc === 'VP8X') {
                if (size < 10) return buf;
                vp8xIndex = chunks.length;
            }
            chunks.push(buf.subarray(i, end));
        }
        i = end;
    }

    if (!dropped) return buf;

    if (vp8xIndex >= 0) {
        const vp8x = Buffer.from(chunks[vp8xIndex]);
        vp8x[8] &= ~(VP8X_EXIF_FLAG | VP8X_XMP_FLAG) & 0xff;
        chunks[vp8xIndex] = vp8x;
    }

    const body = Buffer.concat(chunks);
    const header = Buffer.alloc(12);
    header.write('RIFF', 0, 'latin1');
    header.writeUInt32LE(4 + body.length, 4);
    header.write('WEBP', 8, 'latin1');
    return Buffer.concat([header, body]);
};

export const stripImageMetadata = (buf: Buffer, mime: string): Buffer => {
    try {
        if (mime === 'image/jpeg') return stripJpeg(buf);
        if (mime === 'image/png') return stripPng(buf);
        if (mime === 'image/webp') return stripWebp(buf);
        return buf;
    } catch {
        return buf;
    }
};
