#!/usr/bin/env python3
"""
curate-landmarks.py — real OSM footprints for the Jakarta hero landmarks.

Writes public/jakarta-landmarks.geojson from the actual OSM building outline (and its building:part stack when OSM
has one). Heights stay the published figure; each feature cites its source.
A landmark OSM can't find is reported and left out — never a rectangle.

Usage: python3 scripts/curate-landmarks.py        (rewrites the geojson)
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from shapely.geometry import Point, Polygon, shape, mapping

OUT = Path(__file__).resolve().parent.parent / "public" / "jakarta-landmarks.geojson"
OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
CBD = "(-6.24,106.78,-6.12,106.86)"  # name search box: Kota Tua to Kuningan, Senayan to Gambir
UA = "jakarta-3d-atlas/0.1 (https://jakarta.nonarkara.org; landmark curation)"

# name, OSM name regex, anchor (lat, lon), height m, category, height source.
# Only towers with a published figure carry one; civic heights are labelled
# curated estimates, as in the HCMC atlas.
LANDMARKS = [
    ("Autograph Tower", "Autograph|Thamrin Nine", (-6.1972, 106.8207), 382.9, "tower", "CTBUH Skyscraper Center"),
    ("Monumen Nasional", "Monumen Nasional|Monas", (-6.1754, 106.8272), 132.0, "civic", "published monument height"),
    ("Wisma 46", "Wisma 46", (-6.2045, 106.8226), 261.9, "tower", "OSM tag (height=261.9 m) / CTBUH Skyscraper Center"),
    ("Treasury Tower", "Treasury Tower", (-6.2272, 106.8080), 280.0, "tower", "OSM tag (height=280 m) / CTBUH Skyscraper Center"),
    # Civic monuments stay out, per the 2026-10-10 landmark decision: Istiqlal's
    # published 60 m is the dome and the Cathedral's is a spire — neither is the
    # height of the whole footprint, and a published height over a whole outline
    # was wrong for Gama Tower too (its outline is the 22 m podium). They stay
    # out of this curated set; the general Overture bake is a separate asset.
]


def overpass(query):
    body = urllib.parse.urlencode({"data": query}).encode()
    for url in OVERPASS:
        try:
            req = urllib.request.Request(url, data=body, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=12) as r:
                return json.load(r)["elements"]
        except Exception as e:  # try the next mirror
            print("   overpass", url.split("/")[2], "failed:", e)
            time.sleep(1)
    return []


def ring(el):
    """Outer ring of a way, or the first outer member of a relation."""
    if el["type"] == "way" and "geometry" in el:
        pts = [(g["lon"], g["lat"]) for g in el["geometry"]]
    elif el["type"] == "relation":
        outers = [m for m in el.get("members", []) if m.get("role") == "outer" and "geometry" in m]
        if not outers:
            return None
        pts = [(g["lon"], g["lat"]) for g in outers[0]["geometry"]]
    else:
        return None
    if len(pts) < 4:
        return None
    poly = Polygon(pts)
    return poly if poly.is_valid and poly.area > 0 else poly.buffer(0)


def num(v):
    try:
        return float(str(v).lower().replace("m", "").strip())
    except (TypeError, ValueError):
        return None


# Name search is ambiguous inside one complex; pin the exact OSM element.
# Pinned elements come directly from the OSM API, not Overpass.
PINNED = {
    "Autograph Tower": ("way", 851599141),
    "Wisma 46": ("way", 334982528),
    "Treasury Tower": ("way", 513330873),
}


def osm_api_polygon(kind, osm_id):
    """Outer ring of a way, or the largest outer way of a multipolygon relation."""
    url = f"https://api.openstreetmap.org/api/0.6/{kind}/{osm_id}/full.json"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        els = json.load(r)["elements"]
    nodes = {e["id"]: (e["lon"], e["lat"]) for e in els if e["type"] == "node"}
    ways = {e["id"]: e for e in els if e["type"] == "way"}
    if kind == "way":
        rings = [ways[osm_id]["nodes"]]
    else:
        rel = next(e for e in els if e["type"] == kind and e["id"] == osm_id)
        rings = [ways[m["ref"]]["nodes"] for m in rel["members"] if m["type"] == "way" and m.get("role") == "outer" and m["ref"] in ways]
    polys = [Polygon([nodes[n] for n in ring]) for ring in rings if len(ring) >= 4]
    polys = [p if p.is_valid else p.buffer(0) for p in polys]
    return max(polys, key=lambda p: p.area) if polys else None


def curate(name, pattern, anchor, height, category, source):
    lat, lon = anchor
    if name in PINNED:
        kind, osm_id = PINNED[name]
        poly = osm_api_polygon(kind, osm_id)
        if poly is None:
            return None, f"pinned {kind}/{osm_id} has no outline"
        return [feature(poly, name, category, height, 0, source, f"{kind}/{osm_id}")], f"pinned {kind}/{osm_id} ({len(poly.exterior.coords)} vertices)"
    q = (
        "[out:json][timeout:60];("
        f'nwr{CBD}["building"]["name"~"{pattern}",i];'
        f'nwr{CBD}["building"]["name:en"~"{pattern}",i];'
        # Monas is a man_made tower, not a building, in OSM.
        f'nwr{CBD}["man_made"~"^(tower|monument)$"]["name"~"{pattern}",i];'
        f"way(around:120,{lat},{lon})[\"building\"];"
        f"way(around:350,{lat},{lon})[\"building:part\"];"
        f"relation(around:120,{lat},{lon})[\"building\"];"
        ");out geom tags;"
    )
    els = overpass(q)
    buildings, parts = [], []
    for el in els:
        poly = ring(el)
        if poly is None:
            continue
        tags = el.get("tags", {})
        rec = (el, poly, tags)
        (parts if "building:part" in tags and "building" not in tags else buildings).append(rec)

    import re
    rx = re.compile(pattern, re.I)
    named = [b for b in buildings if rx.search(b[2].get("name", "") + " " + b[2].get("name:en", ""))]
    pool = named or buildings
    if not pool:
        return None, "no OSM building near anchor"
    here = Point(lon, lat)
    # Prefer a named match; among candidates the one containing / nearest the anchor.
    el, poly, tags = min(pool, key=lambda b: (0 if b[1].contains(here) else 1, b[1].distance(here)))
    if not named and not poly.contains(here) and poly.distance(here) > 0.0004:
        return None, "nearest OSM building is >40 m from anchor and unnamed"

    osm = f"{el['type']}/{el['id']}"
    inside = [p for p in parts if poly.buffer(0.00002).contains(p[1].representative_point())]
    feats = []
    tall_parts = [p for p in inside if num(p[2].get("height"))]
    if tall_parts:
        top = max(num(p[2]["height"]) for p in tall_parts)
        scale = height / top if top else 1  # keep the published total height
        for pel, ppoly, ptags in tall_parts:
            h = num(ptags["height"]) * scale
            base = (num(ptags.get("min_height")) or 0) * scale
            feats.append(feature(ppoly, name, category, round(h, 1), round(base, 1), source,
                                 f"{pel['type']}/{pel['id']}", part=True))
        # Label anchor: the outline itself as a flat (0 m) feature is not needed;
        # mark the tallest part as the labelled one.
        max(feats, key=lambda f: f["properties"]["height"])["properties"].pop("part")
    else:
        feats.append(feature(poly, name, category, height, 0, source, osm))
    return feats, f"{osm} ({len(poly.exterior.coords)} vertices, {len(feats)} part(s), named={bool(named)})"


def feature(poly, name, category, height, base, source, osm, part=False):
    props = {"name": name, "category": category, "height": height, "base_height": base,
             "source": source, "osm": osm}
    if part:
        props["part"] = True
    g = mapping(poly.simplify(0.000003, preserve_topology=True))
    return {"type": "Feature", "geometry": g, "properties": props}


def main():
    # `curate-landmarks.py "Name" ...` re-curates only those, keeping the rest.
    only = set(sys.argv[1:])
    feats, missing = [], []
    old_features = []
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text())
            old_features = old.get("features", [])
        except Exception:
            pass
    if only and old_features:
        feats = [f for f in old_features if f["properties"]["name"] not in only]
    for spec in LANDMARKS:
        if only and spec[0] not in only:
            continue
        print(spec[0])
        got, note = curate(*spec)
        print("  ", note)
        if got:
            feats.extend(got)
        elif old_features:
            retained = [f for f in old_features if f["properties"].get("name") == spec[0]]
            if retained:
                feats.extend(retained)
                print(f"   retained {len(retained)} existing feature(s) from {OUT.name}")
            else:
                missing.append({"name": spec[0], "reason": note})
        else:
            missing.append({"name": spec[0], "reason": note})
        time.sleep(1.0)
    doc = {
        "type": "FeatureCollection",
        "name": "jakarta-landmarks",
        "description": "Jakarta hero landmarks. Footprints: OpenStreetMap (ODbL). Heights: published figures, cited per feature. Built by scripts/curate-landmarks.py.",
        "features": feats,
        "missing": missing,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1))
    print(f"{len(feats)} features, {len(missing)} missing → {OUT}")


if __name__ == "__main__":
    main()
