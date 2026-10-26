# Daily monitoring pilot · Jakarta Smart City

**Goal:** a person at Jakarta Smart City opens this every morning on a phone. In one minute they know whether anything needs attention: water, rain, air, warnings, traffic. Every number tells them its source and its age. The public site stays public, and agency data never goes on it.

**Tier today: T0 demo** (Production Doctrine §16.2). It is built on public data with honest limits, and it has strong code gates. It reaches **T1 pilot** when the four gaps below are closed and one administrator has run the walkthrough.

## The bar, and where the site stands

| A daily monitor must… | Now | Gap |
|---|---|---|
| Be up, and say so when it is not | `/api/health` checks the tile archive only. Releases are gated and verified live | **Nobody is told about an outage.** A watcher must run *outside* the Worker, on a schedule, and alert a named person |
| Show whether each source is fresh | Each lens shows its own source, tier and age, and stale gauges are kept as dated evidence, not counted as current | **No single "are my sources fresh" view.** A morning check should not need eight lenses |
| Hold up when an office shares one address | Native rate limit bound at 600/min per IP. A page load makes 4–9 API calls and does not poll | None. Revisit if the agency puts a wall screen on auto-refresh |
| Read on a phone in Bahasa Indonesia | Indonesian first. The geometry audit covers 5 screen sizes and 11 lenses | Not yet seen by an administrator |
| Keep agency data off the public site | Public sources only | **No private path, by design.** It is built only when there is data and written terms (below) |
| Be proved by a real user | Automated gates only | **The walkthrough below has not been run** |

## Order of work

1. **Your friend runs the walkthrough** (below) and returns the five answers. Everything after this is shaped by what they say. Building first would be guessing.
2. **Source-status view:** one line per source (name, last observation, age, inside or outside its own freshness rule). It comes from the same admission rules the lenses already use, not a new judgement.
3. **Outage watcher:** a scheduled check from outside Cloudflare covering the site, `/api/health` and the source-status view, alerting by Telegram or LINE. That needs to know who receives it, which is a question for your friend.
4. **Agency data, only with terms.** Before any non-public feed (pumps, gauges, CCTV, reports) is touched:
   - written permission naming the feed and its allowed use;
   - a separate signed-in path (Production Doctrine Law 2), never the public site;
   - validation at ingestion, so a malformed feed fails loudly (Law 5).

   The public site is unchanged throughout.

---

## Walkthrough for the agency (15 minutes)

*Bahasa Indonesia. Send as is. Open the link on the phone you normally use.*

**Pantau Jakarta: uji pemantauan pagi**

Tautan: https://jakarta.nonarkara.org

Bayangkan Anda membuka ini jam 7 pagi sebelum rapat. Kerjakan empat tugas berikut tanpa bantuan. Catat di mana Anda ragu, salah tekan, atau harus mencari.

1. **Dalam satu menit, adakah yang perlu ditindaklanjuti pagi ini?** Lihat cuaca, peringatan, laporan banjir, dan kualitas udara.
2. **Buka peta, pilih lensa "Alur air & air masuk".** Temukan satu pos pantau tinggi air. Kapan angkanya terakhir diperbarui, dan siapa penerbitnya?
3. **Pilih satu kelurahan yang Anda kenal.** Apakah informasinya benar menurut pengetahuan Anda di lapangan?
4. **Cari satu angka yang menurut Anda keliru atau sudah usang.** Di mana angkanya, dan berapa seharusnya?

**Lima pertanyaan, jawab singkat:**

1. Dari semua yang Anda lihat, apa **satu hal** yang benar-benar akan Anda pakai setiap pagi?
2. Apa yang Anda cari tetapi **tidak ada**?
3. Apa yang **salah**, menyesatkan, atau sulit dibaca di ponsel?
4. Data apa milik dinas yang akan membuat ini jauh lebih berguna, dan **boleh dibagikan** dengan syarat apa?
5. Jika sumber data berhenti, **siapa** yang perlu diberi tahu, dan **lewat apa** (Telegram, LINE, WhatsApp, email)?

Terima kasih. Jawaban Anda menentukan apa yang dibangun berikutnya. Situs ini hanya memakai data publik, dan tidak ada data dinas yang dipasang tanpa izin tertulis.
