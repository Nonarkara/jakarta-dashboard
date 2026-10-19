# Haze evidence release · 19 October 2026

The brief is implemented as an evidence desk inside the existing regional haze lens. It adds no map engine, framework, database or account dependency.

## What a person can do

- Screen admitted NOAA-20 detections over 6/12/24 hours and high confidence, with the same selection on the hotspot map and count. Read four equal age intervals and choose one of eight busiest 0.5° coordinate cells to locate it. These are detections/bins, not unique fires or administrative areas.
- Compare measured Singapore NEA one-hour PM2.5 across five representative regions, each with observation time, units and a map action. No region coordinate is claimed as an individual station. Values expire at 3 hours; zero remains valid and unknown stays unavailable.
- Open ASMC's situation PNG and 24-hour PM10 forecast GIF on demand, with full-size/publisher links. Printed issue/valid times belong to ASMC. No numeric PM10 pixels, automated issue-date extraction or georeferenced overlay is claimed.
- Export the admitted satellite feed, screening summary, receptor envelope and admitted wind field as JSON. Use direct links to Jakarta official monitors and its separate model timeline.

## Operational fixes

Haze now uses the same abortable 5-minute visible-session lifecycle as Research. It retires layers when hidden, reloads on return, rechecks admission at draw/render and refuses a missing current hour rather than falling back to index 0. The actual controller is tested across hide/return and a clock jump beyond its forecast hours. Main-map FIRMS admission uses acquisition times and fetchedAt, with filtered map counts updated from the same callback. The legacy count cannot keep the old value beside refreshed analysis. Acquisition clock skew within the existing 5-minute tolerance is clamped into the newest histogram bin; no negative array index loses a counted detection.

FIRMS feature metadata now retains sensor/product/version; selection brings time, red WGS84 coordinates, FRP and confidence to the evidence panel's beginning. Historical Jakarta monthly ISPU content is preserved behind its own disclosure.

## Sources verified

- NASA FIRMS: existing keyless NOAA-20 VIIRS 375 m Collection 2 Southeast Asia 24 h CSV. Existing tier and orbital/cloud limits retained. No new sensor or 72 h archive claimed.
- ASMC official pages: https://wis2.asmc.asean.org/regional-haze-situation/ and https://wis2.asmc.asean.org/smoke-haze-dispersion-model/. Their documented fixed WIS item endpoints return PNG/GIF binary, not numeric JSON, even with f=json. Source objects declare binary/octet-stream; the adapter verifies full magic bytes and bounded size before serving image MIME. PNG 3,936,465 bytes, GIF 456,666 bytes in the local smoke. Daily cadence remains distinct from near-real-time.
- NEA / data.gov.sg: https://api-open.data.gov.sg/v2/real-time/api/pm25. Shell egress initially 403; actual local Worker returned 200 and five measured regions. Exact payload identity, numeric ranges, observation date and three-hour expiry are tested; no model substitutes for outages. Coordinates are the publisher's regional label locations.
- OpenAQ v3 documentation confirms an API key requirement: https://docs.openaq.org/using-the-api/api-key. No key provisioned or station coverage asserted.

The bilingual source ledger now has 60 contracts, 41 integrated, with JSON/CSV parity and a reproducible upsert script. Integration means a callable bounded adapter/reference capability; it does not promise perpetual availability.

## Remaining evidence gaps

No authoritative peat/concession join, calibrated regional dispersion, Malaysia/Indonesia measured receptor integration, multi-pass persistence analysis, 72 h history or attribution verdict. Existing Java 850 hPa wind field cannot trace most Kalimantan or the full route to Singapore. Local emissions, dust, rainfall, cloud and missing overpasses remain alternatives. ASMC graphics retain publisher context instead of being scraped into unsupported numeric claims. The dashboard is an evidence-screening tool, not a street-level exposure sensor or a source-responsibility finding.

## Design and verification

Anti-slop rules 1–7 reviewed independently at 1440/1024/390. Initial hits: full-width export button, bright empty bar tracks, phone orphan link arrow. Fixed with content-fit controls, muted tracks/gold values, separate aligned source links, and 18 px main count. Map/compact chrome, CTAN Universa/Source Sans and Palette267 preserved. Phone evidence remains user-opened and closable. Screenshots: `haze-2026-10-19/`.

Typecheck, 12/12 local verification, full npm test and targeted controlled-clock/source tests pass. New smoke-haze is part of the canonical release, checking real healthy feeds or explicit no-store 503 outages. Independent reviewer approved code and responsive composition. ## Live receipt

Canonical release completed: `jakarta-atlas-20261019-1792419539-f086199`; implementation `f086199`, stamp `d7aea80`, Worker version `6185d7b1-fa8e-4bb1-b93d-cbd9967cc0aa`. Typecheck, 12/12 local checks, 39 test commands, three consecutive exact-byte probes on both hosts, atlas/network/water-context/API/dashboard smokes passed. The existing API smoke reported 37/37; new haze probes independently passed five NEA regions and both ASMC raster products. Source-ledger JSON/CSV bytes also match production.

Live browser verified EN/ID, mapped all five measured regions (43/62/46/89/77 µg/m³, observed 19 October 21:00 WIB at check time), and rendered the 595×564 forecast GIF with publisher-printed dates. Snapshot values are verification evidence, not an enduring availability claim. Local browser export contained 5,564 features, histogram sum 5,564, five receptor regions and 25 wind cells; six-hour window showed a truthful zero. Cell selection moved to 114.0–114.5°E / 2.5–2.0°S. Phone document width and scrollWidth both 390; no captured production console errors. Responsive/live screenshots and measured pixel dimensions are retained in `haze-2026-10-19/`. Viewport override reset and own local dev process stopped.

Independent reviewer approved code, lifecycle tests and all seven visual rules. No calibrated dispersion, causality or automatic transboundary attribution claim was added. Verified ASMC integration lesson: `Scars/Debug-Logs/2026-10-19-asmc-wis-item-endpoints-return-raster-bytes-with-octet-stream-mime.md`.

