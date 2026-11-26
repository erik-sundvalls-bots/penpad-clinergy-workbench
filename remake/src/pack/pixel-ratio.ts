import { PIXEL_RATIOS, type ImagePack, type PackImage, type PackIssue, type PixelRatio } from "./types.ts";

export function isPixelRatio(v: unknown): v is PixelRatio {
  return v === 1 || v === 2 || v === 4;
}

export function packPixelRatio(pack: Pick<ImagePack, "pixelRatio">): PixelRatio {
  return pack.pixelRatio ?? 1;
}

export function imagePixelRatio(pack: Pick<ImagePack, "pixelRatio">, rec: PackImage): PixelRatio {
  return rec.pixelRatio ?? pack.pixelRatio ?? 1;
}

export function nativePixelSize(pack: Pick<ImagePack, "pixelRatio">, rec: PackImage): { width: number; height: number } {
  const r = imagePixelRatio(pack, rec);
  return { width: rec.width * r, height: rec.height * r };
}

/** Read width/height from a PNG, JPEG, or WebP file. Returns null for SVG and unknown formats. */
export function readRasterSize(bytes: Uint8Array, path = ""): { width: number; height: number } | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".svg")) return null;
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (bytes.length >= 16 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return jpegSize(bytes);
  }
  if (bytes.length >= 16 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    // RIFF....WEBP
    const tag = String.fromCharCode(...bytes.subarray(8, 12));
    if (tag === "WEBP") return webpSize(bytes);
  }
  return null;
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    // SOF0 / SOF1 / SOF2
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    if (len < 2) break;
    i += 2 + len;
  }
  return null;
}

function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const fourcc = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
    const data = offset + 8;
    if (fourcc === "VP8X" && data + 10 <= bytes.length) {
      const w = 1 + (bytes[data + 4] | (bytes[data + 5] << 8) | (bytes[data + 6] << 16));
      const h = 1 + (bytes[data + 7] | (bytes[data + 8] << 8) | (bytes[data + 9] << 16));
      return { width: w, height: h };
    }
    if (fourcc === "VP8 " && data + 10 <= bytes.length && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      const w = bytes[data + 6] | ((bytes[data + 7] & 0x3f) << 8);
      const h = bytes[data + 8] | ((bytes[data + 9] & 0x3f) << 8);
      return { width: w, height: h };
    }
    if (fourcc === "VP8L" && data + 5 <= bytes.length && bytes[data] === 0x2f) {
      const bits = bytes[data + 1] | (bytes[data + 2] << 8) | (bytes[data + 3] << 16) | (bytes[data + 4] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    // chunks are padded to even size
    offset = data + size + (size % 2);
  }
  return null;
}

const SIZE_TOLERANCE_PX = 2;

/**
 * Compare decoded raster pixels to declared width/height × pixelRatio.
 * These are warnings only — they do not fail pack validation.
 * SVGs are skipped (they have no native raster size).
 */
export function imageSizeWarnings(
  pack: ImagePack,
  files?: Iterable<[string, Uint8Array]> | Map<string, Uint8Array>,
): PackIssue[] {
  if (!files) return [];
  const map = files instanceof Map ? files : new Map(files);
  const warnings: PackIssue[] = [];
  for (const [id, rec] of Object.entries(pack.images)) {
    const bytes = map.get(rec.path);
    if (!bytes) continue;
    const actual = readRasterSize(bytes, rec.path);
    if (!actual) continue;
    const expected = nativePixelSize(pack, rec);
    const dw = Math.abs(actual.width - expected.width);
    const dh = Math.abs(actual.height - expected.height);
    if (dw > SIZE_TOLERANCE_PX || dh > SIZE_TOLERANCE_PX) {
      const ratio = imagePixelRatio(pack, rec);
      warnings.push({
        path: `images.${id}`,
        message: `File is ${actual.width}×${actual.height} pixels, but width/height ${rec.width}×${rec.height} at pixelRatio ${ratio} would be ${expected.width}×${expected.height}. Canvas and click boxes still use the 1× size; this is a warning only.`,
      });
    }
  }
  return warnings;
}

export { PIXEL_RATIOS };
