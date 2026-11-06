// The ground under a place.
//
// Our map is flat. Everything we publish about water is measured against a
// datum that cannot be transferred to the ground, so a reader has no way to
// see whether the street they are looking at sits in a dip — and our own
// polder note says it plainly: no terrain is available.
//
// This is the one public height source we can name: Terrain Tiles, terrarium
// encoding, on the AWS open bucket, derived from SRTM, NED and ETOPO. It is
// what the Location Scout uses, and it is a raster model, not a survey:
// about 19 m of ground per pixel at zoom 13 over Jakarta.
//
// Two rules, and they are the whole point:
//
//   1. The number is reported with its source and its resolution, and never
//      alone.
//   2. It is never combined with a water level. A gauge reads against its
//      own datum; the project's own words are that heights cannot be
//      transferred between station datums. Two heights in two frames is not
//      a subtraction, it is a mistake with a number in it.

export const ELEVATION_SOURCE = {
  id: 'terrain-tiles',
  name: 'Terrain Tiles',
  encoding: 'terrarium',
  // Our own edge: the bucket sends no CORS header, so a browser cannot read
  // it. The Worker fetches the tile and hands the bytes on.
  endpoint: '/api/ground-elevation?z={z}&x={x}&y={y}',
  upstream: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  attribution: 'Terrain Tiles (elevation-tiles-prod) · SRTM, NED and ETOPO derived',
  license: 'Open elevation tiles; attribution to the source datasets',
};

/** The tile that holds a point. */
export function tileFor(lat, lng, zoom) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return null;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * n);
  if (x < 0 || y < 0 || x >= n || y >= n) return null;
  return { z: zoom, x, y };
}

/** How much ground one pixel of the tile covers, at that latitude. */
export function metresPerPixel(lat, zoom) {
  if (!Number.isFinite(lat) || !Number.isFinite(zoom)) return NaN;
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** Terrarium: metres = R * 256 + G + B / 256 - 32768. */
export function decodeTerrarium(r, g, b) {
  if (![r, g, b].every((v) => Number.isFinite(v))) return NaN;
  return r * 256 + g + b / 256 - 32768;
}

/** The pixel inside the tile that holds the point, and its height. */
export function sampleElevation(pixels, width, height, lat, lng, zoom) {
  const t = tileFor(lat, lng, zoom);
  if (!t || !pixels || !width || !height) return null;
  const n = 2 ** zoom;
  const fx = ((lng + 180) / 360) * n - t.x;
  const r = (lat * Math.PI) / 180;
  const fy = ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * n - t.y;
  const px = Math.min(width - 1, Math.max(0, Math.floor(fx * width)));
  const py = Math.min(height - 1, Math.max(0, Math.floor(fy * height)));
  const i = (py * width + px) * 4;
  const metres = decodeTerrarium(pixels[i], pixels[i + 1], pixels[i + 2]);
  return Number.isFinite(metres) ? metres : null;
}

/**
 * Decode a PNG tile into pixels.
 *
 * The width and the height are read BEFORE the bitmap is closed: closing
 * releases its pixels, and its size with them, so a closed bitmap measures
 * zero and a zero-sized canvas is an empty one. That produced an unknown
 * height with no error anywhere to say why.
 */
export async function decodePng(blob) {
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width, height = bitmap.height;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  const image = context.getImageData(0, 0, width, height);
  if (bitmap.close) bitmap.close();
  return { data: image.data, width, height };
}

/**
 * The ground height at a point, in metres above sea level, with its source
 * and its resolution. Null when the tile cannot be read — the caller says
 * "unknown", never "0".
 */
export async function groundElevation({ lat, lng, zoom = 13, fetch: request, signal, decodeImage }) {
  const t = tileFor(lat, lng, zoom);
  if (!t || typeof request !== 'function') return null;
  const url = ELEVATION_SOURCE.endpoint.replace('{z}', t.z).replace('{x}', t.x).replace('{y}', t.y);
  let response;
  try {
    response = await request(url, { signal, headers: { accept: 'image/png' } });
  } catch {
    return null;
  }
  if (!response || !response.ok) return null;
  const image = decodeImage ? await decodeImage(await response.blob()) : null;
  if (!image) return null;
  const metres = sampleElevation(image.data, image.width, image.height, lat, lng, zoom);
  if (!Number.isFinite(metres)) return null;
  return {
    metres,
    resolutionMetres: metresPerPixel(lat, zoom),
    zoom,
    source: ELEVATION_SOURCE,
    retrievedAt: new Date().toISOString(),
  };
}
