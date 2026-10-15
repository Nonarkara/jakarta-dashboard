# Jakarta water candidates · 15 October 2026

Checked anonymously at 15:48–15:50 UTC. This is a bounded follow-up to the 56-contract coverage audit, not an exhaustive search or a hydraulic calibration. Existing BBWS EWS river-level/prediction and JAXA modeled-water adapters were read first; neither new source is treated as a replacement for them.

| Priority | Source and result | Usable evidence | Boundary |
|---|---|---|---|
| 1 | [BMKG Maritime API](https://maritim.bmkg.go.id/apidoc), [Tanjung Priok JSON](https://maritim.bmkg.go.id/marine2026-data/pelabuhan/XJ001.json): HTTP 200, 11,387 bytes, anonymous GET, CORS `*` | Official port forecast: issue time, validity interval, tide in metres, waves in metres, wind and sea-current speeds in knots, directions and dated points. Suitable for a separate coastal forecast table. | Forecast, not an observed tide gauge. Vertical datum absent. Cannot set a downstream hydraulic boundary in the river scenario or be joined to river-gauge heights/terrain elevations. Wave height must not be added to tide. No general redistribution licence found in API documentation; retain BMKG attribution and links. |
| 2 | [BBWS Ciliwung Cisadane monitoring table](https://hkabbwscc.higertech.com/Home/TabelMonitoring) and its three anonymous JSON feeds: all HTTP 200 | Six AWLR river references, six ARR rain references and one combined station. Coordinates, local level, device state, timestamps and rain accumulation fields are inspectable. | Active rows claim `readingAt` roughly seven hours in the future while also saying `timeZone: WIB`. Treat as a publisher timestamp contradiction; do not silently strip `Z`, shift the time, or admit these as current observations. Other records are offline, stale or missing readings. |
| 3 | [BIG tides](https://srgi.big.go.id/tides) | Existing audit remains: public metadata, metre units; datum and approved series would support a future coastal calibration. | No new logged-in acquisition attempted. Registration/terms boundary remains. The BMKG discovery does not resolve BIG station datum or observed-series access. |

## The usable acquisition: Tanjung Priok

The [official port GeoJSON](https://maritim.bmkg.go.id/marine2026-data/meta/pelabuhan.json) identifies `XJ001`, `Pelabuhan Tanjung Priok`, at WGS84 `[106.882294878, -6.103879776]`. The forecast was issued **14 October 2026, 12:00 UTC**, valid **15 October 00:00 UTC to 18 October 00:00 UTC**. Keep UTC in the contract; the interface may format WIB. Coordinates locate the port reference, not a surveyed tide sensor.

The recorded response has 24 hourly first-day points and 17 following points at three-hour spacing. Its terminal point equals `valid_to`; the adapter uses a half-open validity interval and admits **40** of the 41 published rows. It does not interpolate intermediate hours or invent a current observation.

`src/coastal.ts` exports `cleanCoastal(input, now)` and `handleCoastal()`. Contract `coastal-v1` includes `station`, `source`, `sourceUrl`, `apiUrl`, `docsUrl`, `checkedAt`, `issuedAt`, `validFrom`, `validTo`, `tier`, `units`, `datum: null`, `datumNote`, `cadence`, `freshnessPolicy`, `available`, `stale`, `error` and `points`.

Each point has `validAt`, `tideM`, `waveHeightM`, `currentSpeedKnots`, `currentTo`, `windSpeedKnots`, `windGustKnots`, `windFrom`. Unknown optional values remain null. Real zero and negative tides survive. Tide is the admission measurement; malformed tide values cannot become zero. Rows are bounded, sorted and deduplicated. Range checks are defensive input limits, not scientific quality assurance.

The fixed publisher request has a 12-second timeout and a 128 KiB streaming size limit, with no arbitrary URL parameter. At most 96 rows are accepted. Forecast validity must contain the check time; issue age cannot exceed 72 hours; issue timestamps beyond five minutes in the future fail. These are display policies, not a BMKG availability promise. The raw cache lasts five minutes and validity is recomputed on every hit. Stale cache, outages and malformed payloads cannot become a fresh response; source failures return structured HTTP 503 with `no-store`. Cache read/write faults do not erase a valid publisher response.

Verification: `node scripts/test-coastal.mjs` passed, covering real fixture admission, terminal-point exclusion, identity and impossible dates, row and byte limits, strict numeric types, zero/negative tide, no invented optional values, sorting/deduplication, unknown datum, future issuance, before/after validity, cache hits and expired-cache revalidation, cache faults, malformed HTTP responses and outages. `npx tsc --noEmit` passed. The parent agent owns route/UI/catalog integration and live verification; this note alone makes no deployment claim.

## River and rain candidate: why not current yet

The publisher's table script explicitly requests:

- `https://hkabbwscc.higertech.com/Home/GetAwlrLastReading`
- `https://hkabbwscc.higertech.com/Home/GetArrLastReading`
- `https://hkabbwscc.higertech.com/Home/GetAwlrArrLastReading`

All returned `code: 200`. At the check time (15:49 UTC), three AWLR rows and three ARR rows were `online` but reported `2026-10-15T22:45:00Z` (one river row at `22:45:01Z`). Their separate `timeZone` field says `WIB`. The observed contradiction is evidence; the apparent seven-hour offset is not permission to repair timestamps. The existing adapter's strict future-date policy should remain.

The other three AWLR rows are missing a timestamp, dated 1 October 2026, or dated June 2025; offline rows do not imply zero flow. One dated offline river record supplies `debit: 0.534`, but the source has `hasCrossSection: false`; neither currency nor rating-curve derivation is verified. The active river records have no discharge.

Three ARR rows are offline with March/June 2026 or December 2025 timestamps. Active rain rows have zero `rainfallLastHour`, but their timestamp contradiction prevents claiming current dry conditions. The table defines rain accumulations in millimetres for the hour ending at the latest reading and for one day. Raw JSON does not provide an explicit hourly interval start or daily reset timezone. The combined inlet station is offline, last reported 18 May 2026. No API CORS header was observed for these feeds, and no dataset open licence was found.

Next acquisition request: ask the publisher to confirm whether `readingAt` is UTC or a local WIB wall clock incorrectly suffixed `Z`, then document daily rainfall reset time, per-station vertical datum and discharge/rating-curve method. The source can become an independent fallback only after those contracts are defensible. No credentials, private endpoints or user/editor identities were collected.

## Recorded evidence

`data/source-evidence/water-candidates-2026-10-15/` contains:

- `receipts.json`: requested URLs, status/error, byte counts, check timestamps and relevant response headers. Cookies are omitted.
- `bmkg-priok.json`: exact public forecast bytes.
- `bmkg-port-meta.json`: exact public location GeoJSON bytes.
- `bmkg-api-doc.html`, `bmkg-tide-page.html`: public documentation/page captures.
- `bbws-monitor.html`: public monitoring-page capture, with its unrelated browser map key redacted.
- `bbws-table.js`: public monitoring table script used to identify its anonymous station feeds.
- `bbws-awlr.json`, `bbws-arr.json`, `bbws-combined.json`: exact public source responses.
- `sha256.json`: integrity checks for the recorded files (redacted HTML hash applies after redaction).

The BBWS official home page probe reset the connection and remains recorded as a failed probe. A reachable monitoring vendor page does not establish an uptime guarantee, an open redistribution licence, a surveyed datum or hydraulic calibration.
