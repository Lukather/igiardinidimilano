/**
 * Image type detection from magic bytes.
 *
 * The declared `Content-Type` and the client filename are attacker-controlled:
 * a `.jpg` extension on a ZIP file costs nothing to forge. The first bytes of
 * a file are not, so the type is decided here and nowhere else.
 */

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

/** Bytes needed to recognise every accepted format. */
const HEADER_BYTES = 12;

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = offset; i < offset + length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

/** The image type of `bytes`, or null when it is not one we accept. */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // RIFF....WEBP
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'image/webp';
  }

  return null;
}

/** The extension used for the stored original, derived from the detected type. */
export function extensionFor(type: ImageType): string {
  switch (type) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
  }
}

/** How many bytes `detectImageType` needs to look at. */
export const HEADER_LENGTH = HEADER_BYTES;
