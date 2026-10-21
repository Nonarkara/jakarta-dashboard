// Put the pinned MapLibre module on the window before the atlas client runs.
//
// The import is STATIC, and this file is a module, so the browser treats it as
// a load-blocking resource: the page is not "loaded" until MapLibre is here.
// The client reads window.maplibregl as its very first statement, and it is a
// deferred script after this one, so the order holds.
//
// The previous version imported the module dynamically and appended the client
// with a script element. A script appended that way does not delay the load
// event, so the browser reported the page loaded while the atlas was still an
// inert shell — and every check that reads the page on load (the spatial
// gate, the rendered audit) was reading that shell instead of the map.
//
// If the module fails to load, this file never runs, but the client still
// does: it finds no window.maplibregl and shows the text fallback.
import * as maplibregl from '/vendor/maplibre-6.4.1/maplibre-gl.mjs';

window.maplibregl = maplibregl;
