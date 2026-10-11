# Jakarta design and CRM integration · 11 October 2026

## Intent and design read

A resident or researcher opens a phone to read weather, choose a route or facility, and reach the city's reporting system. The map remains dominant. Plain Indonesian task labels and readable source/time details should make the next action predictable.

Design read: a Jakarta civic observation desk with coastal blue structure, a bounded green masthead and warm action colour; the city and its reports are the subjects. Reference: Jakarta's +Jakarta identity and actual TransJakarta/CRM tasks, interpreted through Palette's relational colour, Bauhaus content hierarchy and Bringhurst typography guidance. Console register with a bright daylight mode. Dials: variance 4, motion 2, density 6.

## Selection before CSS

Intent: read the city and act through its official public channels.
Relationship: cool blue/green grounds support warm yellow/orange actions; neutral light ink carries reading.
Chord: Palette/Wada plate 267 — Cream Yellow #fdbf68, Yellow Orange #f99d1b, Benzol Green #00978d, Blue #006eb8.
Roles: blue-derived page/structure; green-derived bounded masthead and CRM introduction; neutral paper/ink for reading; yellow/orange-derived action/focus. Provider semantic map colours keep their existing meanings.
Budget: neutral/blue carrier 80%, bounded green support 15%, warm pointer 5%; real status symbols separate.
Risks: orange text on a pale field needs a darker production value; branding must not recolour rain/AQI categories; long bilingual source labels must remain readable.
Proof: contrast on every actual surface, three reading conditions, 375/768/1280 viewport and enlarged-text checks, font loading/fallback and preserved map interactions.

The plate is verified against Palette's credited `data/colors.json`. Those are digital conversions, not exact printed inks. Our production shades adapt the relationship; they are not official Jakarta brand specifications. Jakarta's published MENOR names include Hijau Betawi, Kuning Gigi Balang, bus orange and coastal blue. This palette interprets that local warm/cool relationship with unequal roles, rather than reproducing all six brand colours.

References: [official +Jakarta colour meanings](https://www.jakarta.go.id/informasi-kolaborasi), [Palette 267](https://colors.nonarkara.org/#plate-267), local Palette guides `PALETTE-FIELD-GUIDE.md`, `DESIGN-FIELD-GUIDE.md`, `TYPOGRAPHY-FIELD-GUIDE.md` and their two skills. No changes to the Palette exhibition itself.

## Type receipt

Body and controls: self-hosted Plus Jakarta Sans, variable weight 200–800. Selected for real Indonesian/English place names, controls and explanations; the font's documented city commission adds appropriate identity. Open counters, tabular figures and actual weights are tested at 14px body / 12px supporting text / 28px main heading. Source and timestamp text stays readable; monospace is reserved for technical identifiers, not every sentence. Long explanations remain at body size where they carry meaning.

Publisher: Tokotype/Gumpita Rahayu, originally commissioned for Jakarta's City of Collaboration program. Upstream commit `18d1cd2f7ea10481919d2f05c1f7064b7307fc26`; SIL OFL 1.1 license saved beside the font. One 61KB variable file avoids third-party font requests. The previous system-font body and tiny mono source paragraphs were rejected because they weakened hierarchy and local identity. No claim of fluent-reader or uninstructed human taste testing is made.

[Font source and license](https://github.com/tokotype/PlusJakartaSans).

## CRM evidence and scope

The requested CRM homepage timed out through browser, web retrieval and an anonymous terminal request. An indexed first-party monthly page exposed its official hosted Looker report:

- [Monthly page](https://crm.jakarta.go.id/data-bulanan)
- [Official embedded monthly viewer](https://datastudio.google.com/embed/reporting/d7d87175-bfa2-4067-bf4d-42e8b996da11/page/27A2C)
- Daily, kelurahan and map destinations were taken from that page's navigation: `/data-harian`, `/data-wilayah-kelurahan`, `/crm-peta`.
- [Jakarta's CRM explanation](https://www.jakarta.go.id/cepat-respon-masyarakat) establishes its non-emergency public-service reporting role.
- [CRM officer documentation](https://crm.jakarta.go.id/crm_petugas) distinguishes private and public reports and protects reporter identity.
- [Satu Data CRM category summary catalog](https://satudata.jakarta.go.id/open-data/detail?data_no=1&kategori=dataset&page_url=cepat-respon-masyarakat-crm) is a future aggregate-export lead; no machine resource was proved here.

Implementation: a citizen-services section with official daily/monthly/kelurahan/map links, a reporting workflow, an on-demand hosted monthly viewer and an always-available external link. The viewer is clearly the publisher's surface and retains its own period/update labels. Opening it does not imply that numbers were retrieved or normalized into this dashboard. No login, report submission, citizen identity, complaint photos or private report records are collected. No invented resolution rate, live report count or local proxy API is introduced.

Conserved: all buildings/heights, satellite layers, rail, transit/civic search, themes, two languages, forecast table/chart and evidence export. Rejected alternative: a six-colour badge/card grid, which would compete with the map and spend semantic status colours on decoration. CRM is a distinct service workflow beside the retained city-data workbench, not another unsupported metric row.

## Prototype evidence

The official embedded monthly report rendered in the local dashboard on 11 October 2026. Visible publisher controls included month, agency, channel, category, status, public/private aggregate grouping and administrative geography. The report labels its monthly update cadence as every fifth day; no 15-minute freshness is inferred from older descriptions. Default totals belong to the report's selected period/filter scope and are not copied into this dashboard. Open/close and language switching were exercised; closing removes the source URL and restores focus to the opening button.

Authored public-asset audit: 11 files, zero errors, 70 advisory warnings (mostly existing literal map colours). Reasoned exceptions cover geographic symbols and optional local preference storage; no data failure is waived. Unmodified vendored MapLibre internals are excluded from the authored style scope. A whole-folder scan including the SDK reports its compiled colour literals/default styles; no claim of a clean unfiltered third-party scan is made. Contrast checks cover the actual shared production tokens, including the green companion fields.

## Production release evidence

Source commit `bfcd3fe` is pushed to the private repository. Cloudflare Worker version `d2a811a2-8150-4c22-bb1e-9beffb2ab9e5` serves build `jakarta-atlas-20261011-1791703908-bfcd3fe` at https://jakarta.nonarkara.org. TypeScript, 12 local verification checks and all eight contract suites passed. Production atlas asset/Range checks, 14 API checks and dashboard smoke passed. Dashboard smoke compares exact JavaScript, shared CSS and licensed font bytes, and checks the narrow CRM frame policy.

Live browser evidence: buildings rendered; Indonesian and English controls worked; the official CRM monthly report rendered with publisher filters and update cadence. Close removed its URL and restored keyboard focus. Page width matched the 375, 768 and 1280 viewport widths without document overflow. All three appearance modes have tested text contrast, including green fields. Enlarged-text and an uninstructed human walkthrough were not independently verified in this release.

Screenshots: `JAKARTA-LOCAL-DESIGN-2026-10-11.jpg` (daylight city view), `JAKARTA-LOCAL-PHONE-2026-10-11.jpg` (Indonesian phone map), and `JAKARTA-CRM-2026-10-11.jpg` (publisher monthly viewer). CRM screenshot totals reflect the publisher's default filters at capture time; they are not dashboard observations.


## Compact header follow-up

Source `f9b6178`, Worker version `ee36b94b-91c4-4bbd-848f-3e62ef9c09c5`, build `jakarta-atlas-20261011-1791704246-f9b6178`. Header measured in the browser at 1280px: 133.79px before, 62px after. At 375px: 309.13px before, 92.59px after. The phone map iframe begins at 263.17px instead of 503.40px, with no document overflow. All three utility controls retain 44px height and accessible labels. Description moved into the existing method disclosure; clock moved to the footer. All eight suites and the canonical production smoke checks passed. Live screenshots: `JAKARTA-COMPACT-HEADER-2026-10-11.jpg` and `JAKARTA-COMPACT-PHONE-2026-10-11.jpg`; buildings rendered, language switching worked, viewport override reset.


## Logo and single-bar follow-up

Source `0280306` (layout `cec387a`), build `jakarta-atlas-20261011-1791704746-0280306`, Worker version `64faad08-6374-4589-a565-286489af17ca`. The owner-supplied logo sheet is stored unmodified; CSS frames the icon and wordmark, with a dark-surface monochrome treatment for wordmark legibility. The favicon frames the supplied app icon. Desktop chrome is one 50px row, with the map iframe beginning at 79.70px. Phone chrome is two rows totaling 94px, with the map iframe beginning at 123.70px instead of 263.17px in the previous release. Feed status and evidence export remain available in Sources; utilities are in a keyboard-operable native Controls disclosure. All live city and data tools are retained.

Verified: exact source logo bytes on production; TypeScript, 12 local checks, all eight test suites, atlas asset/Range smoke, 14 API checks and dashboard exact-asset smoke passed. The bilingual scanner initially rejected the language-independent JKTx brand; the explicit brand allowlist now includes it. Browser proof shows buildings rendered, Controls opened, language/theme switching worked and no phone page overflow. Viewport restored. Screenshots: `JAKARTA-LOGO-DESKTOP-2026-10-11.jpg`, `JAKARTA-LOGO-PHONE-2026-10-11.jpg`.


## Production logo correction

The presentation-sheet cropping was rejected by the owner for its cut-and-paste appearance. This release supersedes that treatment: true-alpha `jktx-symbol-v2.png`, an AI-assisted reconstruction of the supplied Monas/layers symbol, plus a native Plus Jakarta Sans JKTx wordmark. No blend mode, inverted raster lettering or navy icon tile remains on the live header. Original sheet is retained as source evidence. PNG 1289×1221 RGBA, alpha range 0–255, corner alpha 0.

Source `d22c557`; build `jakarta-atlas-20261011-1791705028-d22c557`; Worker `e2153de6-44fe-4c29-8080-a4704f6d83e1`. All eight suites, typecheck, 12 local checks and canonical production smoke passed. Exact production symbol bytes matched local. Browser dark/light proof confirms native wordmark background is none, clean mark without tile corners, and 50px desktop header. Screenshots: `JAKARTA-CLEAN-LOGO-DARK-2026-10-11.jpg`, `JAKARTA-CLEAN-LOGO-LIGHT-2026-10-11.jpg`, `JAKARTA-CLEAN-LOGO-DETAIL-2026-10-11.jpg`.


## Dense workbench and embedded viewport correction

The user rejected excessive footer spacing, nested map scrolling and the type. Source `edf1078`, build `jakarta-atlas-20261011-1791705932-edf1078`, Worker `21a9465a-42f0-4de4-8fd2-6e11db06c796`.

The embedded atlas now has a fixed three-row grid: lens toolbar, evidence entry, and the remaining map. All secondary tools, environmental controls, data tables and attribution are retained in an explicit evidence drawer; the standalone atlas remains a full page. Desktop action strip measured 37px. Adobe Source Sans 3 replaces the previous geometric face, with tighter panel spacing and preserved source/tier/date rows. Coarse-pointer controls retain 44px targets.

Live proof: desktop embedded clientHeight/scrollHeight both 580 and width/scrollWidth both 790; phone both 672 and width/scrollWidth both 375. No inner document scrolling. Evidence drawer opened and data remained accessible; 2D/3D switching and zoom worked. Local 12 checks, all eight suites, typecheck, atlas asset/Range smoke, 14 API checks and dashboard exact-byte smoke passed. Updated client tests require retention of tools, environment, data and attribution. Screenshots `JAKARTA-DENSE-WORKBENCH-2026-10-11.jpg` and `JAKARTA-DENSE-PHONE-2026-10-11.jpg` record the live revision. No human usability study is claimed.


## Bounded hero and on-demand detail popups

Source `e3f6a5a` (layout `3b492d1`), build `jakarta-atlas-20261011-1791706604-e3f6a5a`, Worker `ae014afd-9d0e-4713-9765-d5b03bb290d1`. Sources/method, CRM, weather detail, transit and civic records are retained in native dialogs opened by navigation buttons. The default page is one viewport, with map and desktop readings; phone/tablet observations and warnings move into their accessible dialogs. Close/Escape restore focus. Selecting a transit or civic overlay closes the popup to reveal the map. CRM close unloads the report even before its load event.

Nine contract suites, typecheck, 12 local checks, all production asset/Range checks, 14 API checks and exact-asset dashboard smoke passed. Live browser verified Sources popup and ledger, Escape return focus, CRM src=null after closing while loading, and selecting TransJakarta route 1 returned to the map with its scheduled overlay. Default document client/scroll heights both 720px on desktop and 812px on phone; phone widths both 375px. No outer page overflow. Screenshots: `JAKARTA-SOURCES-POPUP-2026-10-11.jpg`, `JAKARTA-BOUNDED-HERO-2026-10-11.jpg`. Viewport restored.
