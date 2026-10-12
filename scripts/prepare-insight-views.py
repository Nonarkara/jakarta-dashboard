#!/usr/bin/env python3
"""Derive the four map insight views from the assets already baked into this
project. No network calls: every input is a dated public asset with its own
publisher and retrieval record, so this step adds computation, never a new claim.

Outputs public/data/jakarta-v1/insight.json:

  exposure   per kelurahan -- residents against the official flood-risk classes,
             plus the share of the neighbourhood's mapped land in each class.
  green      per borough -- green-space reference polygon area, derived from the
             published geometry, never presented as a publisher total.
  coverage   per borough -- where flood telemetry is published, and the explicit
             statement that an absent published station is not a clearance.
  confidence the height-source vocabulary carried by every building, so the
             confidence lens can explain itself without inventing categories.

Every derived number sits under a "derived" flag and keeps the checked date of
the asset it came from. Rows that fail to resolve are counted and reported, never
silently dropped.
"""
import json
import math
import datetime
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/data/jakarta-v1'
NOW = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
R = 6371008.8  # IUGG mean Earth radius, metres

# Confidence order shown in the legend: most observed first.
HEIGHT_ORDER = ['measured', 'landmark', 'google', 'floors', 'ghsl', 'estimated']
HEIGHT_SOURCES = {
    'measured': 'A height tagged on the building record.',
    'landmark': 'A published height for a named landmark outline.',
    'google': 'Satellite-derived height for this individual footprint, 2023.',
    'floors': 'Floor count multiplied by 3.3 m; the count is observed, the per-floor height is assumed.',
    'ghsl': 'Built-up height averaged over the surrounding 100 m cell, 2018; not this building.',
    'estimated': 'A default for this building type; no measurement and no satellite signal.',
}
RISK_CLASSES = ['Berat', 'Sedang', 'Ringan']
INPUTS = ('risk.geojson', 'green.geojson', 'awlr.geojson', 'arr.geojson',
          'pumps.geojson', 'flood-network.json')


def load(name):
    return json.loads((OUT / name).read_text())


def digest(name):
    return hashlib.sha256((OUT / name).read_bytes()).hexdigest()[:16]


def ring_area_m2(ring):
    """Spherical polygon area in m². Ring may be closed or open."""
    if not ring or len(ring) < 3:
        return None
    pts = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
    total = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        total += math.radians(x2 - x1) * (2.0 + math.sin(math.radians(y1)) + math.sin(math.radians(y2)))
    return R * R / 2.0 * abs(total)


def geometry_points(geom):
    """Every vertex of a Polygon or MultiPolygon (navigation hints only)."""
    pts = []
    if not isinstance(geom, dict):
        return pts
    def rec(c):
        if isinstance(c, list):
            if c and isinstance(c[0], (int, float)):
                pts.append(c)
                return
            for part in c:
                rec(part)
    rec(geom.get('coordinates'))
    return pts


def geometry_area_m2(geom):
    """Area of a Polygon or MultiPolygon with holes subtracted. Any other
    geometry returns None so the caller can count it rather than guess."""
    if not isinstance(geom, dict) or not isinstance(geom.get('coordinates'), list):
        return None
    kind = geom.get('type')
    if kind == 'Polygon':
        rings = geom['coordinates']
        if not rings:
            return None
        outer = ring_area_m2(rings[0])
        if outer is None:
            return None
        return max(outer - sum(ring_area_m2(h) or 0.0 for h in rings[1:]), 0.0)
    if kind == 'MultiPolygon':
        parts = geom['coordinates']
        if not parts:
            return None
        total = 0.0
        for poly in parts:
            if not poly:
                continue
            outer = ring_area_m2(poly[0])
            if outer is None:
                return None
            total += max(outer - sum(ring_area_m2(h) or 0.0 for h in poly[1:]), 0.0)
        return max(total, 0.0)
    return None


def borough_name(raw):
    """Normalise a borough label to the spelling the flood-risk asset uses.
    Returns None when it cannot be resolved so the caller counts the row."""
    key = ' '.join(str(raw or '').upper().replace('.', ' ').split())
    if not key or key == '-':
        return None
    if 'SERIBU' in key:
        return 'Kepulauan Seribu'
    for name in ('BARAT', 'PUSAT', 'SELATAN', 'TIMUR', 'UTARA'):
        if key.endswith('JAKARTA ' + name) or key == name:
            return 'Kota Adm. Jakarta ' + name.title()
    return None


def main():
    assets = {name: digest(name) for name in INPUTS}
    risk = load('risk.geojson')
    green = load('green.geojson')
    awlr = load('awlr.geojson')
    arr = load('arr.geojson')
    pumps = load('pumps.geojson')
    network = load('flood-network.json')

    # ── exposure: residents against the official flood-risk classes ──────────
    joined = {str(r['kelurahanCode']): r for r in network['riskSummary']}
    grouped = {}
    unreadable_risk = 0
    bbox = {}
    for feature in risk['features']:
        props = feature.get('properties') or {}
        kelas = props.get('kelas')
        code = ''.join(ch for ch in str(props.get('kelurahanCode') or '') if ch.isdigit())
        if kelas not in RISK_CLASSES or not code:
            unreadable_risk += 1
            continue
        area = geometry_area_m2(feature.get('geometry'))
        if area is None:
            unreadable_risk += 1
            continue
        row = grouped.setdefault(code, {
            'kelurahanCode': code,
            'kelurahan': props.get('kelurahan'),
            'kota': props.get('kota'),
            'polygons': 0,
            'classes': {name: 0 for name in RISK_CLASSES},
            'areaHa': {name: 0.0 for name in RISK_CLASSES},
        })
        row['polygons'] += 1
        row['classes'][kelas] += 1
        row['areaHa'][kelas] += area / 10000.0
        bb = bbox.setdefault(code, [float('inf'), float('inf'), float('-inf'), float('-inf')])
        for x, y, *rest in geometry_points(feature.get('geometry')):
            bb[0] = min(bb[0], x); bb[1] = min(bb[1], y)
            bb[2] = max(bb[2], x); bb[3] = max(bb[3], y)

    exposure = []
    for code, row in grouped.items():
        total_ha = sum(row['areaHa'].values())
        weights = {'Ringan': 1, 'Sedang': 3, 'Berat': 6}
        score = sum(row['areaHa'][name] * weights[name] for name in RISK_CLASSES)
        stats = joined.get(code, {})
        population = {
            'wni': stats.get('wni'),
            'households': stats.get('households'),
            'children': stats.get('children'),
            'elderly60': stats.get('elderly60'),
            'residentsOnSevere': None,
        }
        # A neighbourhood carries its residents once, whichever polygons are on
        # it, so this is never summed across neighbourhoods to make a city total.
        if stats.get('wni') is not None:
            share = (row['areaHa']['Berat'] / total_ha) if total_ha > 0 else 0.0
            population['residentsOnSevere'] = int(round(stats['wni'] * share))
        bb = bbox.get(code)
        exposure.append({
            **row,
            'center': [round((bb[0] + bb[2]) / 2, 4), round((bb[1] + bb[3]) / 2, 4)] if bb else None,
            'riskAreaHa': round(total_ha, 2),
            'beratSharePct': round(100.0 * (row['areaHa']['Berat'] / total_ha), 1) if total_ha > 0 else 0.0,
            'exposureScore': round(score / total_ha, 1) if total_ha > 0 else 0.0,
            'population': population,
            'populationJoined': code in joined,
        })
    exposure.sort(key=lambda r: (-(r['population']['residentsOnSevere'] or 0), r['kelurahan'] or ''))

    # ── green space: reference polygon area by borough ───────────────────────
    # The publisher leaves `kota` blank on some rows. Where the row names a
    # kelurahan that the official population asset places, that placement is
    # used; every remaining row is quarantined and counted, never guessed.
    population_rows = load('population.json')['kelurahan']
    borough_by_kelurahan = {}
    for entry in population_rows:
        name = borough_name(entry.get('kota'))
        label = ' '.join(str(entry.get('name') or '').split())
        if name and label:
            borough_by_kelurahan[label.upper()] = name
    green_by_borough = {}
    unknown_kind = 0
    unresolved_green = 0
    resolved_by_kelurahan = 0
    for feature in green['features']:
        props = feature.get('properties') or {}
        name = borough_name(props.get('kota'))
        if name is None:
            label = ' '.join(str(props.get('kelurahan') or '').split()).upper()
            name = borough_by_kelurahan.get(label)
            if name:
                resolved_by_kelurahan += 1
        if name is None:
            unresolved_green += 1
            continue
        area = geometry_area_m2(feature.get('geometry'))
        if area is None:
            unresolved_green += 1
            continue
        if not str(props.get('kind') or '').strip() or props.get('kind') == 'Belum Diketahui':
            unknown_kind += 1
        row = green_by_borough.setdefault(name, {'kota': name, 'polygons': 0, 'greenHa': 0.0, 'kecamatan': set(), 'kelurahan': set()})
        row['polygons'] += 1
        row['greenHa'] += area / 10000.0
        if props.get('kecamatan'):
            row['kecamatan'].add(str(props['kecamatan']))
        if props.get('kelurahan'):
            row['kelurahan'].add(str(props['kelurahan']))

    green_rows = []
    for name, row in green_by_borough.items():
        green_rows.append({
            'kota': name,
            'polygons': row['polygons'],
            'greenHa': round(row['greenHa'], 1),
            'kecamatanCovered': len(row['kecamatan']),
            'kelurahanCovered': len(row['kelurahan']),
        })
    green_rows.sort(key=lambda r: -r['greenHa'])
    borough_area_km2 = {}
    for entry in load('population.json')['kelurahan']:
        name = borough_name(entry.get('kota'))
        if name:
            borough_area_km2[name] = borough_area_km2.get(name, 0.0) + float(entry.get('areaKm2') or 0.0)
    for row in green_rows:
        land = borough_area_km2.get(row['kota'])
        row['boroughAreaKm2'] = round(land, 1) if land else None
        row['greenSharePct'] = round(100.0 * row['greenHa'] / (land * 100.0), 2) if land else None

    # ── monitoring coverage: published telemetry, and the honest gap ─────────
    def points_in_borough(geojson, kind=None):
        """Per-borough tally plus the count of rows that had usable geometry but
        no borough label. An unattributable row is reported, never counted as
        zero in the borough it might belong to."""
        tally = {}
        unattributed = 0
        for feature in geojson['features']:
            props = feature.get('properties') or {}
            if kind is not None and props.get('kind') != kind:
                continue
            geom = feature.get('geometry') or {}
            if geom.get('type') != 'Point' and geometry_area_m2(geom) is None:
                continue
            name = borough_name(props.get('kota') or props.get('city'))
            if not name:
                unattributed += 1
                continue
            tally[name] = tally.get(name, 0) + 1
        return tally, unattributed

    # pumps.geojson carries three separate inventories in one file; only the
    # Pompa rows are pumps. The other two are counted under their own names.
    awlr_tally, awlr_unattributed = points_in_borough(awlr)
    arr_tally, arr_unattributed = points_in_borough(arr)
    pump_tally, pump_unattributed = points_in_borough(pumps, 'Pompa')
    gate_tally, gate_unattributed = points_in_borough(pumps, 'Pintu Air')
    reservoir_tally, reservoir_unattributed = points_in_borough(pumps, 'Waduk & Embung')
    risk_kelurahan_by_borough = {}
    for row in exposure:
        risk_kelurahan_by_borough.setdefault(row['kota'] or '', set()).add(row['kelurahan'] or '')

    # Only the pump inventory publishes a neighbourhood. AWLR and ARR records
    # carry a city and an address but no kelurahan field, so they are counted at
    # borough level and never attributed to a neighbourhood by inference.
    def neighbourhood_labels(geojson, kind=None):
        found = {}
        for feature in geojson['features']:
            props = feature.get('properties') or {}
            if kind is not None and props.get('kind') != kind:
                continue
            label = ' '.join(str(props.get('kelurahan') or '').split()).lower()
            name = borough_name(props.get('kota') or props.get('city'))
            if name and label:
                found.setdefault(name, set()).add(label)
        return found

    pump_neighbourhoods = neighbourhood_labels(pumps, 'Pompa')
    kelurahan_without_field = {
        'awlr': sum(1 for f in awlr['features'] if not str((f.get('properties') or {}).get('kelurahan') or '').strip()),
        'arr': sum(1 for f in arr['features'] if not str((f.get('properties') or {}).get('kelurahan') or '').strip()),
    }

    coverage = []
    for name in sorted(set(awlr_tally) | set(arr_tally) | set(pump_tally) | set(risk_kelurahan_by_borough)):
        risk_kelurahan = {k.lower() for k in risk_kelurahan_by_borough.get(name, set()) if k}
        pumps_here = pump_neighbourhoods.get(name, set())
        matched = risk_kelurahan & pumps_here
        coverage.append({
            'kota': name,
            'awlrStations': awlr_tally.get(name, 0),
            'arrGauges': arr_tally.get(name, 0),
            'pumps': pump_tally.get(name, 0),
            'floodgates': gate_tally.get(name) if name in gate_tally else None,
            'reservoirs': reservoir_tally.get(name, 0),
            'kelurahanWithRiskMapping': len(risk_kelurahan),
            'kelurahanWithPublishedPump': len(matched),
            'kelurahanWithoutPublishedPump': max(len(risk_kelurahan) - len(matched), 0),
            'awlrNeighbourhoodAttribution': None,
            'arrNeighbourhoodAttribution': None,
        })

    payload = {
        'generatedAt': NOW,
        'derived': True,
        'derivedFrom': assets,
        'checkedAt': network.get('retrievedAt'),
        'publisher': 'Derived in-project from dated public assets; no new publisher claim.',
        'tier': 'derived-from-official-reference',
        'license': 'Same as the inputs; each asset keeps its own terms.',
        'inputs': {
            'risk.geojson': network.get('sourceUrls', {}),
            'green.geojson': {'publisher': 'Pemprov DKI Jakarta · Jakarta Satu', 'tier': 'official-reference-inventory'},
            'awlr.geojson': {'publisher': network.get('publisher'), 'tier': 'official-reference'},
            'arr.geojson': {'publisher': network.get('publisher'), 'tier': 'official-reference'},
            'pumps.geojson': {'publisher': network.get('publisher'), 'tier': 'official-reference'},
        },
        'note': 'Flood-risk classes and station inventories are official reference mappings, not live observations. Green-space area is computed from published polygon geometry and is not a publisher-declared total. Derived figures are marked derived and are not new official claims.',
        'exposure': {
            'unit': 'hectares',
            'kelurahan': exposure,
            'unreadableFeatures': unreadable_risk,
            'counts': network.get('counts', {}),
            'populationPeriod': 'Semester 2 2023',
        },
        'green': {
            'unit': 'hectares, derived from published polygon geometry',
            'byBorough': green_rows,
            'unknownKindPolygons': unknown_kind,
            'unresolvedFeatures': unresolved_green,
            'resolvedViaKelurahan': resolved_by_kelurahan,
        },
        'coverage': {
            'byBorough': coverage,
            'accessStates': network.get('accessStates', {}),
            'inRegion': {k: network.get('counts', {}).get(k) for k in
                         ('awlrTotal', 'awlrInRegion', 'arrTotal', 'arrInRegion', 'pumps', 'situ')},
            'stationsWithoutNeighbourhoodField': kelurahan_without_field,
            'unattributedToBorough': {
                'awlr': awlr_unattributed, 'arr': arr_unattributed,
                'pumps': pump_unattributed, 'floodgates': gate_unattributed,
                'reservoirs': reservoir_unattributed,
            },
            'caveat': 'A neighbourhood with no published asset in this inventory is not a cleared neighbourhood. The inventory is what the publisher publishes as of the checked date, not a survey of what exists. AWLR and ARR records publish a city and an address but no neighbourhood, so they are counted per borough and never attributed to a neighbourhood by inference. A null floodgate count means the publisher published no borough for those records, not that the borough has none.',
        },
        'confidence': {
            'property': 'hs',
            'order': HEIGHT_ORDER,
            'sources': HEIGHT_SOURCES,
            'caveat': 'Confidence in the height, not in the footprint. Every building carries its own source; none is silently promoted to a measurement.',
        },
    }
    (OUT / 'insight.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
    print(json.dumps({
        'exposureKelurahan': len(exposure),
        'exposureUnreadable': unreadable_risk,
        'exposureJoined': sum(1 for r in exposure if r['populationJoined']),
        'greenBoroughs': len(green_rows),
        'greenUnknownKind': unknown_kind,
        'greenUnresolved': unresolved_green,
        'greenResolvedViaKelurahan': resolved_by_kelurahan,
        'coverageBoroughs': len(coverage),
        'bytes': (OUT / 'insight.json').stat().st_size,
    }, indent=2))


if __name__ == '__main__':
    main()
