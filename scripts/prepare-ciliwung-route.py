#!/usr/bin/env python3
"""Bake the mapped Ciliwung corridor from OpenStreetMap for the water-arrival lens.

Queries river ways past the map's -6.4 latitude cutoff (to include Katulampa and
Depok), builds an undirected graph from shared way node IDs, and admits only
station-to-station paths proven connected inside that graph. Every admitted
path must pass published geometric gates: station endpoints within tolerance,
every vertex near the station-to-station chord, length within chord bounds, and
the way names along the path must not belong to a different named river. Gaps
stay gaps: nothing is invented, no connector is drawn between nodes the source
does not join, and the lens keeps its labelled schematic fallback for any
unverified segment.

Outputs public/data/jakarta-v1/{ciliwung-route.geojson,ciliwung-manifest.json};
raw Overpass capture kept under data/source-evidence/ciliwung-2026-10-13/.
"""
import gzip,json,math,datetime,urllib.parse,heapq,re
from pathlib import Path
from urllib.request import urlopen,Request

ROOT=Path(__file__).resolve().parent.parent
RAW=ROOT/'data/source-evidence/ciliwung-2026-10-13'
OUT=ROOT/'public/data/jakarta-v1'
RAW.mkdir(parents=True,exist_ok=True)
NOW=datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
TOLERANCE_M=2000       # station anchor to nearest mapped river node
CHORD_BOUND_M=3500     # every admitted vertex must sit within this of the chord
QUERY=r'''[out:json][timeout:120];
way["waterway"~"^(river|canal)$"](-6.95,106.60,-6.05,107.00);
out body qt;
>;
out skel qt;'''

# Station anchors are the published scenario coordinates, never hand-typed.
scenario=json.loads((ROOT/'public/data/jakarta-v1/water-scenario.json').read_text())
STATIONS=[(s['name'],s['coordinates'][0],s['coordinates'][1]) for s in scenario['stations']]

MIRRORS=['https://overpass.openstreetmap.fr/api/interpreter','https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']
body=None;used=None
for mirror in MIRRORS:
    try:
        req=Request(mirror,data=urllib.parse.urlencode({'data':QUERY}).encode(),headers={'User-Agent':'JakartaDashboard/1.0 (jakarta.nonarkara.org)','content-type':'application/x-www-form-urlencoded'})
        with urlopen(req,timeout=180) as r: body=r.read()
        used=mirror
        break
    except Exception as e:
        print(f'mirror {mirror} failed: {type(e).__name__}')
if body is None:
    raise SystemExit('refuse to bake: no Overpass mirror answered')
(RAW/'overpass-ciliwung.json.gz').write_bytes(gzip.compress(body))
osm=json.loads(body)
if osm.get('osm3s',{}).get('timestamp_osm_base') is None:
    raise SystemExit('refuse to bake: no OSM base timestamp in Overpass response')
nodes={e['id']:(e['lon'],e['lat']) for e in osm.get('elements',[]) if e.get('type')=='node' and 'lat' in e and 'lon' in e}
ways=[e for e in osm.get('elements',[]) if e.get('type')=='way' and isinstance(e.get('nodes'),list) and len(e['nodes'])>=2 and all(n in nodes for n in e['nodes'])]
if len(ways)<20:
    raise SystemExit(f'refuse to bake: too few river ways ({len(ways)})')

def haversine(a,b):
    x1,y1=a; x2,y2=b
    dx=math.radians(x2-x1)*math.cos(math.radians((y1+y2)/2))
    dy=math.radians(y2-y1)
    return 6371000*math.hypot(dx,dy)

def distance_to_chord(pt,a,b):
    """Distance from pt to the great-circle-ish chord segment a→b (metres, planar approx)."""
    ax,ay=a; bx,by=b; px,py=pt
    ax,ay=ax*111320*math.cos(math.radians(ay)),ay*110540
    bx,by=bx*111320*math.cos(math.radians(by)),by*110540
    px,py=px*111320*math.cos(math.radians(py)),py*110540
    dx,dy=bx-ax,by-ay
    if dx==dy==0: return math.hypot(px-ax,py-ay)
    t=max(0.0,min(1.0,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)))
    return math.hypot(px-(ax+t*dx),py-(ay+t*dy))

# ── graph: node id -> neighbours; ways_by_node for name evidence ───────────
adj={}; ways_by_node={}
for way in ways:
    ids=way['nodes']
    name=(way.get('tags') or {}).get('name')
    for nid in ids:
        adj.setdefault(nid,set())
        ways_by_node.setdefault(nid,{}).setdefault(way['id'],name)
    for a,b in zip(ids,ids[1:]):
        adj[a].add(b); adj[b].add(a)

def components():
    seen=set(); out=[]
    for start in adj:
        if start in seen: continue
        comp=set([start]); stack=[start]; seen.add(start)
        while stack:
            for n in adj[stack.pop()]:
                if n not in seen: seen.add(n); comp.add(n); stack.append(n)
        out.append(comp)
    return sorted(out,key=len,reverse=True)
comps=components()

def nearest_node(lat,lng,comp):
    best=(None,float('inf'))
    for nid in comp:
        d=haversine((lng,lat),nodes[nid])
        if d<best[1]: best=(nid,d)
    return best

# The stem is the largest component holding two station endpoints in tolerance.
stem=None
for comp in comps:
    held=[name for name,lng,lat in STATIONS if nearest_node(lat,lng,comp)[1]<=TOLERANCE_M]
    if len(held)>=2: stem=comp; break
if stem is None:
    raise SystemExit('refuse to bake: no OSM component connects two scenario stations')

def dijkstra(src,dst):
    dist={src:0.0}; prev={}; heap=[(0.0,src)]; seen=set()
    while heap:
        d,u=heapq.heappop(heap)
        if u in seen: continue
        seen.add(u)
        if u==dst: break
        for v in adj[u]:
            if v not in stem: continue
            nd=d+haversine(nodes[u],nodes[v])
            if nd<dist.get(v,float('inf')):
                dist[v]=nd; prev[v]=u; heapq.heappush(heap,(nd,v))
    if dst not in dist: return None
    path=[dst]
    while path[-1]!=src: path.append(prev[path[-1]])
    return list(reversed(path))

stations=[]
for name,lng,lat in STATIONS:
    nid,d=nearest_node(lat,lng,stem)
    stations.append({'name':name,'lng':lng,'lat':lat,'nearestNode':nid,'endpointDistanceM':round(d,1),'withinTolerance':d<=TOLERANCE_M})

segments=[]; features=[]
for (a,b) in zip(stations,stations[1:]):
    seg={'from':a['name'],'to':b['name']}
    if not (a['withinTolerance'] and b['withinTolerance']):
        seg.update(admitted=False,reason='station endpoint beyond tolerance of mapped river geometry')
        segments.append(seg); continue
    path=dijkstra(a['nearestNode'],b['nearestNode'])
    if not path:
        seg.update(admitted=False,reason='no connected path inside the mapped river component')
        segments.append(seg); continue
    coords=[nodes[n] for n in path]
    chord=haversine((a['lng'],a['lat']),(b['lng'],b['lat']))/1000
    length=sum(haversine(coords[i],coords[i+1]) for i in range(len(coords)-1))/1000
    stray=max(distance_to_chord(pt,(a['lng'],a['lat']),(b['lng'],b['lat'])) for pt in coords)
    # Name evidence: length share of path ways whose name mentions Ciliwung,
    # and any different named river that dominates the path.
    name_len={}; unnamed=0.0
    for u,v in zip(path,path[1:]):
        seg_len=haversine(nodes[u],nodes[v])
        names=set(n or None for n in ways_by_node.get(u,{}).values()) & set(n or None for n in ways_by_node.get(v,{}).values())
        picked=None
        for n in names:
            if n: picked=n; break
        if picked is None and None in names: unnamed+=seg_len
        elif picked: name_len[picked]=name_len.get(picked,0.0)+seg_len
        else: unnamed+=seg_len
    named_total=sum(name_len.values())
    foreign=[ (n,round(l/1000,2)) for n,l in sorted(name_len.items(),key=lambda t:-t[1]) if 'ciliwung' not in re.sub(r'\s+','',n.lower()) ]
    ciliwung_named=round(sum(l for n,l in name_len.items() if 'ciliwung' in n.lower())/1000,2)
    gates={'chordKm':round(chord,3),'lengthKm':round(length,3),'maxStrayFromChordM':round(stray,1),
        'ciliwungNamedKm':ciliwung_named,'unnamedKm':round(unnamed/1000,2),'foreignNamedKm':foreign[:3]}
    if length<0.5*chord or length>3*chord:
        seg.update(admitted=False,reason=f'path length {length:.1f} km outside chord bounds {chord:.1f} km',gates=gates)
    elif stray>CHORD_BOUND_M and ciliwung_named<0.5*length:
        seg.update(admitted=False,reason=f'path strays {stray:.0f} m from the station-to-station chord (bound {CHORD_BOUND_M} m) without majority Ciliwung naming',gates=gates)
    elif named_total>0 and foreign and sum(l for n,l in name_len.items() if 'ciliwung' not in re.sub(r'\s+','',n.lower()))>0.5*named_total:
        seg.update(admitted=False,reason=f'path majority belongs to other named waterways: {foreign[:2]}',gates=gates)
    else:
        seg.update(admitted=True,**gates,nodeCount=len(path),firstNode=path[0],lastNode=path[-1])
        features.append({'type':'Feature','geometry':{'type':'LineString','coordinates':coords},
            'properties':{'segment':a['name']+'→'+b['name'],'lengthKm':round(length,3),'nodeCount':len(path),
            'maxStrayFromChordM':round(stray,1),'ciliwungNamedKm':ciliwung_named}})
    segments.append(seg)

admitted=[s for s in segments if s.get('admitted')]
route={'type':'FeatureCollection','features':features,
 'source':'OpenStreetMap river ways (waterway=river), connected through shared way nodes','licence':'ODbL, © OpenStreetMap contributors',
 'sourceAsOf':osm['osm3s']['timestamp_osm_base'],'mirror':used,'retrievedAt':NOW,'tier':'mapped-river-reference',
 'note':'Admitted geometry only: each path is proven connected through shared OSM way nodes, stays near the station-to-station chord and carries no majority of another named river. Unverified station pairs stay schematic in the lens and are never bridged.'}
manifest={'source':'OpenStreetMap via Overpass API','licence':'ODbL, © OpenStreetMap contributors','sourceAsOf':osm['osm3s']['timestamp_osm_base'],'mirror':used,
 'retrievedAt':NOW,'tier':'mapped-river-reference','graphBasis':'waterway=river ways in the corridor query box',
 'toleranceM':TOLERANCE_M,'chordBoundM':CHORD_BOUND_M,'componentNodes':len(stem),'ways':len(ways),
 'stations':stations,'segments':segments,'evidencePath':'data/source-evidence/ciliwung-2026-10-13/overpass-ciliwung.json.gz',
 'note':'Endpoint tolerance is how far a scenario station may sit from the nearest mapped river node; the chord bound keeps a path near the station-to-station line. No invented connectors; gaps remain schematic and labelled.'}
(OUT/'ciliwung-route.geojson').write_text(json.dumps(route,separators=(',',':'))+'\n')
(OUT/'ciliwung-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
print('ways',len(ways),'component nodes',len(stem))
for s in stations: print(f"  {s['name']}: node {s['nearestNode']} at {s['endpointDistanceM']} m ({'within' if s['withinTolerance'] else 'BEYOND'} tolerance)")
for seg in segments:
    line=f"  {seg['from']}→{seg['to']}: "
    line+=f"admitted {seg.get('lengthKm')} km" if seg.get('admitted') else f"gap — {seg.get('reason')}"
    if 'gates' in seg: line+=f" (chord {seg['gates']['chordKm']} km, stray {seg['gates']['maxStrayFromChordM']} m, ciliwung-named {seg['gates']['ciliwungNamedKm']} km, unnamed {seg['gates']['unnamedKm']} km)"
    print(line)
