# Waterways, inflow evidence and traffic cameras

Two lazy-loaded bilingual lenses preserve the compact workbench. Main map layers remain unchanged when these views are left.

Waterways: 3,885 OSM ways, including mapped surface-water polygons, river/canal/stream/drain/ditch lines; 1.92 MB uncompressed, loaded only on selection. Manifest records bbox, snapshot date (1 June 2026), CRS, rounding, simplification and license. Rebuild with `npm run prepare:networks` from compressed raw evidence. Clicking a mapped line reports its name/type and computed original-geometry length. Way order is not presented as measured flow direction.

Incoming water: public EWS Sodetan Ciliwung adapter retrieves local-datum gauge levels, rejects invalid/future observation times and retains valid zero. The separate homepage predictions provide m³/s and their own valid times. Exact name matches attach published station coordinates and geographic sectors; unmatched stations stay unlocated. These sectors are positions relative to Monas, not measured flow vectors. The volume tool uses V = Q × duration at one section; constant flow is an assumption. Serial stations are never summed as tributaries. This does not establish total measured city inflow, depth or inundation propagation.

NASA/JAXA: comparison selector overlays dated NASA MODIS three-day flood classification or JAXA TE-Global discharge/flood-fraction model. NASA is observation-derived at 250m; clouds and narrow channels limit detection. JAXA is a satellite-informed model at approximately 10km; its run time and modeled units/range are explicit. Source tiles are probed; JAXA TMS y is flipped to XYZ through a fixed, bounded provider proxy. No provider is presented as volumetric confirmation from a surface-water image alone.

Traffic: 4,340 dated public camera references, clustered on the map and searchable by road/district. Link availability is explicitly unverified, with on-demand provider player and fallback link. Provider coordinates remain exact to the published catalog's five decimals, and the edit date remains 23 April 2025. No measured congestion/speed layer is fabricated.

Toll streams: Bina Marga publishes 26 Dalam Kota cards / 21 distinct Jasa Marga HLS links. Anonymous playlists and sample MPEG-TS segments respond successfully, with an advancing media sequence. Stream selection loads the player only on request; leaving the lens destroys the HLS instance and stops video. Fixed catalogue-allowlisted proxy compensates for missing upstream CORS, rejects arbitrary hosts, path traversal, encrypted/unsupported playlists and unknown cameras, and sets no-store to avoid stale sequence reuse. No private/authenticated cameras or credential-bearing URLs are used. Kilometre labels lack coordinates and remain in an unmapped corridor list.

YouTube channel players are wired on demand. Checked search results included ended/replay broadcasts; channel availability is labelled, with no invented point for multi-city video. Full provider source links and notices remain accessible.

Validation: numerical volume, future-time quarantine, exact source counts/coordinates, null versus zero, forecast tier, cleanup order and proxy allowlist tests. Browser verification covers water evidence, NASA/JAXA comparison, camera search and provider playback. Final live release receipts below.
