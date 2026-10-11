# Native Indonesian / English interface · 11 October 2026

Source: `1109475` (main interface `1851546`, research wording `d26259b`).
Build: `jakarta-atlas-20261011-1791713840-1109475`.
Worker: `e151a25e-b79a-4f72-9cdd-907833d87ede`.

## Delivered

- Compact masthead language action, plus a language action inside every native popup. Native modal inertness does not force readers to close their research to change language.
- Riset / Research menu, localized research headings, planning-document display titles, proposed-cost/start/area/location vocabulary and Indonesian number formats. Example `IDR 7.80 Trillion` → `Rp 7,80 triliun`; English uses `IDR 7.80 trillion`. Source snapshots are untouched.
- Natural `Rencana mulai` / `Planned start` and `proyek dalam katalog` / `listed projects` labels; feasibility-study acronym expanded in both languages.
- Public facility category display in both languages; weather-location administration labels, CAP status enums, input placeholders and accessibility names follow the selected language. Proper project/place/source names and original publisher documents remain intact.
- Research query, topic, sector and expanded project rows retained through switches. Bilingual search aliases accept `air limbah` in either UI language.
- Host and atlas language preferences synchronized, same-origin embedded atlas initialized from the host, acknowledgement loop guarded, and language carried on full-atlas / dashboard links. No iframe replacement on switching.
- Indonesian tour actions use `Mulai tur kota`, `Hentikan tur kota`, `Putar peta otomatis`, `Jeda putaran`.

## Concrete checks

Canonical `npm run deploy:live` passed typecheck, 12 local checks, all 11 behavioral suites, atlas asset/Range checks and exact-byte checks for the dashboard, reference-language helper, research client, i18n, translation catalogue, CSS, font and prepared data. Atlas API smoke: 13/14 successes, no hard failures; upstream rainfall returned a bounded 503 and retained the browser fallback. All four Jakarta provider envelopes passed.

Live browser on the custom domain:

- Riset → reports: all six displayed titles switched Indonesian → English → Indonesian, alongside the embedded atlas `html.lang`.
- Research query `air limbah`: three matching projects. Zone 7 remained expanded; query unchanged; dialog remained open; exactly one map iframe after switching.
- Sportainment Tendean publisher point selected, then language switched both ways. Its selection caption changed correctly, embedded language followed, and the existing 2D selection remained active.
- Standalone `/atlas?lang=en`: English menus and dropdown. Changed to Indonesian, opened Alat dan tampilan, verified Dasbor kota / Lompat cepat / Hujan dan air / Data dan sumber / Tampilan; returned through `/?lang=id` to native dashboard menus.
- Desktop 1280×720 document/scroll dimensions 1280/1280 and 720/720; header 50 px. Tablet 768×900: 768/768 and 900/900; header 94 px. Phone 375×812: 375/375 and 812/812; popup 339/339, expanded project and query retained in English.
- Viewport override reset and default Indonesian city overview restored after checks.

Screenshots:
- `NATIVE-RESEARCH-ID-2026-10-11.jpg`
- `NATIVE-RESEARCH-EN-2026-10-11.jpg`
- `NATIVE-RESEARCH-PHONE-2026-10-11.jpg`

Publisher-hosted CRM reports and original PDFs retain their original language. UI localization does not translate or modify external documents, source JSON, source identifiers, units, dates, coordinates or licenses.
