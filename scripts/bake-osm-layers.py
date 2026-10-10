#!/usr/bin/env python3
"""
bake-osm-layers.py — OpenStreetMap rail and waterways for the Jakarta atlas.

  rail       public/jakarta-rail.geojson    MRT, LRT and KRL route relations:
                                            the mapped track ways plus the
                                            stations each route stops at.
  waterways  out/jakarta-waterways.pmtiles  rivers and canals (the two Banjir
                                            Kanal, Ciliwung, Pesanggrahan...)

Geometry is OSM as mapped, not a schematic. Upload the waterways archive with
  npx wrangler r2 object put jakarta-tiles/buildings/jakarta-waterways.pmtiles \
      --file out/jakarta-waterways.pmtiles --remote

Data © OpenStreetMap contributors, ODbL.
"""
import json
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BBOX = (106.65, -6.40, 107.00, -6.08)  # same as scripts/bake-buildings.py
S, W, N, E = BBOX[1], BBOX[0], BBOX[3], BBOX[2]
OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
UA = "jakarta-3d-atlas/0.1 (https://jakarta.nonarkara.org; OSM layer bake)"


def overpass(query):
    body = urllib.parse.urlencode({"data": query}).encode()
    for attempt in range(2):
        for url in OVERPASS:
            try:
                req = urllib.request.Request(url, data=body, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=300) as r:
                    return json.load(r)["elements"]
            except Exception as e:
                print("   overpass", url.split("/")[2], "failed:", e, flush=True)
                time.sleep(5)
    sys.exit("all Overpass mirrors failed")


def line_coords(geometry):
    return [[round(g["lon"], 6), round(g["lat"], 6)] for g in geometry]


def rail():
    els = overpass(
        f"[out:json][timeout:240];"
        f'relation["type"="route"]["route"~"^(subway|light_rail|train|monorail)$"]({S},{W},{N},{E});'
        f"out geom;"
    )
    lines, stations, seen_ways, seen_stops = [], [], set(), set()
    for rel in els:
        t = rel.get("tags", {})
        network = t.get("network") or t.get("operator") or ""
        mode = t.get("route")
        # KRL Commuter Line is "train"; long-distance intercity trains share the
        # track, so keep only commuter/urban networks.
        if mode == "train" and not any(k in (network + " " + t.get("name", "")).lower()
                                       for k in ("commuter", "krl", "airport", "bandara")):
            continue
        name = t.get("ref") or t.get("name") or network
        colour = t.get("colour")
        for m in rel.get("members", []):
            if m["type"] == "way" and m.get("role", "") in ("", "forward", "backward") and "geometry" in m:
                key = (m["ref"], name)
                if key in seen_ways:
                    continue
                seen_ways.add(key)
                lines.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": line_coords(m["geometry"])},
                              "properties": {"line": name, "network": network, "mode": mode, "colour": colour, "osm": f"way/{m['ref']}"}})
            elif m["type"] == "node" and m.get("role", "").startswith(("stop", "platform")) and "lat" in m:
                if m["ref"] in seen_stops:
                    continue
                seen_stops.add(m["ref"])
                stations.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(m["lon"], 6), round(m["lat"], 6)]},
                                 "properties": {"ref": m["ref"], "line": name, "network": network, "mode": mode}})
    # Stop nodes carry no name in relation output; fetch names in one query.
    if stations:
        ids = ",".join(str(f["properties"]["ref"]) for f in stations)
        names = {e["id"]: e.get("tags", {}) for e in overpass(f"[out:json][timeout:120];node(id:{ids});out tags;")}
        for f in stations:
            tags = names.get(f["properties"].pop("ref"), {})
            f["properties"]["name"] = tags.get("name") or tags.get("name:id") or tags.get("name:en") or ""
        # One point per station name and line: platforms and stop positions repeat.
        dedup = {}
        for f in stations:
            k = (f["properties"]["name"], f["properties"]["line"])
            if f["properties"]["name"] and k not in dedup:
                dedup[k] = f
        stations = list(dedup.values())
    doc = {"type": "FeatureCollection", "name": "jakarta-rail",
           "description": "MRT, LRT and KRL route ways and stops from OpenStreetMap route relations (ODbL). As mapped; not an operator network map.",
           "features": lines + stations}
    out = ROOT / "public" / "jakarta-rail.geojson"
    out.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
    nets = sorted({f["properties"]["line"] for f in lines})
    print(f"rail: {len(lines)} ways, {len(stations)} stations, lines: {nets}")


def waterways():
    els = overpass(
        f"[out:json][timeout:240];"
        f'way["waterway"~"^(river|canal)$"]({S},{W},{N},{E});'
        f"out geom tags;"
    )
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    gj = out / "jakarta-waterways.geojsonl"
    with gj.open("w") as fh:
        for el in els:
            if "geometry" not in el:
                continue
            t = el.get("tags", {})
            props = {"kind": t.get("waterway"), "name": t.get("name", "")}
            fh.write(json.dumps({"type": "Feature", "geometry": {"type": "LineString", "coordinates": line_coords(el["geometry"])},
                                 "properties": props}, ensure_ascii=False) + "\n")
    pm = out / "jakarta-waterways.pmtiles"
    subprocess.run(["tippecanoe", "-o", str(pm), "--force", "--layer=waterways", "--minimum-zoom=9", "--maximum-zoom=15",
                    "--drop-densest-as-needed", "--attribution=© OpenStreetMap contributors", str(gj)], check=True)
    print(f"waterways: {len(els)} ways → {pm} ({pm.stat().st_size // 1000} kB)")


if __name__ == "__main__":
    {"rail": rail, "waterways": waterways}[sys.argv[1]]()
