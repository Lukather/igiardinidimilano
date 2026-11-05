/**
 * Metadata inspection for published images.
 *
 * The site must publish images with no EXIF, IPTC, XMP or ICC payload: the
 * only geolocation that reaches the site is the one confirmed by hand in the
 * photo metadata. The ingest strips it with sharp; this module is the check
 * used both while ingesting and, as a last gate, before publishing.
 */

import ExifReader from 'exifreader';

/**
 * Metadata groups ExifReader can report. `file` is excluded on purpose: it
 * holds structural JPEG properties (dimensions, subsampling, file type) that
 * every image has, and counting those made every clean photo look dirty.
 */
const METADATA_GROUPS = [
  'exif',
  'gps',
  'xmp',
  'iptc',
  'icc',
  'photoshop',
  'thumbnail',
  'makerNotes',
  'mpf',
  'riff',
  'gif',
  'png',
  'pngText',
] as const;

/**
 * Names of the metadata groups still present in an image, empty when the
 * image is clean.
 */
export function findRemainingMetadata(buffer: Buffer): string[] {
  const tags = ExifReader.load(buffer, { expanded: true }) as Record<string, unknown>;

  return METADATA_GROUPS.filter((group) => {
    const value = tags[group];
    return (
      value !== null &&
      typeof value === 'object' &&
      Object.keys(value as Record<string, unknown>).length > 0
    );
  });
}
