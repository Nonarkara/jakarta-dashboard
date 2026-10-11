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
