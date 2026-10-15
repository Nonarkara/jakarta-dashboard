#!/usr/bin/env python3
"""Offline bake of recorded DSDA polder polygons; requires Shapely. No network call."""
import datetime,gzip,hashlib,json,pathlib
from shapely.geometry import shape,mapping
root=pathlib.Path(__file__).resolve().parents[1];out=root/'public/data/jakarta-v1'
raw=gzip.decompress((root/'data/source-evidence/coverage-audit-2026-10-15/polders.geojson.gz').read_bytes());d=json.loads(raw)
if d.get('type')!='FeatureCollection' or len(d['features'])!=65:raise SystemExit('source contract drift')
invalid=0
for f in d['features']:
 g=shape(f['geometry'])
 if g.geom_type not in ['Polygon','MultiPolygon']:raise SystemExit('invalid geometry type')
 f['properties']['geometryValid']=g.is_valid
 if not g.is_valid:invalid+=1
 f['geometry']=mapping(g.simplify(0.00001,preserve_topology=True));f['properties']['tier']='official-reference-geometry'
text=json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n';(out/'official-polders.geojson').write_text(text)
m={'count':65,'sourceRecordCount':65,'excluded':0,'sourceInvalidPolygonCount':invalid,'invalidObjectIds':[f['properties'].get('OBJECTID') for f in d['features'] if not f['properties']['geometryValid']],'retrievedAt':datetime.datetime.fromtimestamp((root/'data/source-evidence/coverage-audit-2026-10-15/polders.geojson.gz').stat().st_mtime,datetime.timezone.utc).isoformat(),'dataAsOf':None,'sourceUrl':'https://jakartasatu.jakarta.go.id/server/rest/services/DSDA/Polder_Jakarta/FeatureServer/0/query','sourceCRS':'EPSG:32748','outputCRS':'EPSG:4326 via publisher outSR','tier':'official-reference-geometry','simplification':'Shapely Douglas-Peucker 0.00001 degrees, topology preserved; not metre-exact.','license':'Dataset-specific open license not stated; publisher attribution retained.','assetSha256':hashlib.sha256(text.encode()).hexdigest(),'rawSha256':hashlib.sha256(raw).hexdigest(),'limitations':'65 publisher polygons, not live pump operation or verified hydraulic capacity. Coded fields retained without interpreting unpublished domains. Source invalid polygon count reported; simplification does not repair them. No date or datum assumed.'}
(out/'official-polders-manifest.json').write_text(json.dumps(m,indent=1)+'\n');print('65 polders prepared')
