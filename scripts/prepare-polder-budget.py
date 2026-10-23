#!/usr/bin/env python3
"""Join published polder polygons to acquired native WorldCover. No network call.
--check recomputes the product and checks its data and input hashes without writing.
"""
import argparse, gzip, hashlib, json
from pathlib import Path
import numpy as np
import rasterio
from rasterio.features import geometry_mask, geometry_window
from shapely.geometry import shape, mapping, box
from shapely.ops import transform
from shapely.validation import explain_validity
from pyproj import Transformer

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'public/data/jakarta-v1'
RAW=ROOT/'data/source-evidence/coverage-audit-2026-10-15/polders.geojson.gz'
WC=ROOT/'data/source-evidence/terrain-satellite-2026-10-15/worldcover-2021-jakarta-native.tif'
sha=lambda b:hashlib.sha256(b).hexdigest()

def cook():
 raw=gzip.decompress(RAW.read_bytes());manifest=json.loads((OUT/'official-polders-manifest.json').read_text());wc=json.loads((OUT/'worldcover-2021-reference.json').read_text());features=json.loads(raw)['features']
 assert sha(raw)==manifest['rawSha256'];assert sha(WC.read_bytes())==wc['rawCrop']['sha256']
 assert sha((OUT/'official-polders.geojson').read_bytes())==manifest['assetSha256']
 project=Transformer.from_crs(4326,32748,always_xy=True).transform
 records=[];excluded=[];valid=[]
 with rasterio.open(WC) as raster:
  assert raster.crs.to_epsg()==4326 and raster.nodata==0
  extent=box(*raster.bounds)
  for feature in features:
   p=feature['properties'];g=shape(feature['geometry']);identity={'id':p['OBJECTID'],'name':p.get('NAMOBJ') or 'Polder '+str(p['OBJECTID'])}
   if g.is_empty or not g.is_valid or g.geom_type not in ('Polygon','MultiPolygon'):
    excluded.append({**identity,'reason':explain_validity(g)});continue
   if not extent.covers(g):
    excluded.append({**identity,'reason':'Outside acquired raster crop; no extrapolation'});continue
   area=transform(project,g).area
   if not np.isfinite(area) or area<=0:raise ValueError('Invalid metre area')
   window=geometry_window(raster,[mapping(g)])
   a=raster.read(1,window=window);mask=geometry_mask([mapping(g)],out_shape=a.shape,transform=raster.window_transform(window),invert=True,all_touched=False)
   values,counts=np.unique(a[mask],return_counts=True);hist={int(v):int(c) for v,c in zip(values,counts)}
   if set(hist)-{0,*[c['value'] for c in wc['classes']]}:raise ValueError('Unknown raster class')
   centre=g.representative_point()
   records.append({**identity,'areaM2':round(area,3),'representativePoint':[centre.x,centre.y],'bounds':list(g.bounds),'nativeCells':int(mask.sum()),'nodataCells':hist.get(0,0),'validCells':int(mask.sum())-hist.get(0,0),'classes':[{'value':c['value'],'nameEn':c['nameEn'],'nameId':c['nameId'],'color':c['color'],'cells':hist.get(c['value'],0)} for c in wc['classes']]})
   valid.append((identity['id'],g))
 overlaps=[]
 for i,(a,g) in enumerate(valid):
  for b,h in valid[i+1:]:
   if g.intersection(h).area>1e-8:overlaps.append([a,b])
 return {'contract':'polder-budget-context-v1','boundaryTier':'official-reference-geometry-derived','landCoverTier':'satellite-classification-reference','boundarySourceUrl':manifest['sourceUrl'],'boundaryRetrievedAt':manifest['retrievedAt'],'boundaryObservedAt':None,'landCoverSourceUrl':wc['sourceUrl'],'landCoverPeriod':['2021-01-01','2021-12-31'],'landCoverLicense':wc['license'],'landCoverAttribution':wc['attribution'],'boundaryLicense':manifest['license'],'inputHashes':{'rawPolders':sha(raw),'displayPolders':manifest['assetSha256'],'nativeWorldCover':wc['rawCrop']['sha256']},'method':{'area':'WGS84 polygon projected to EPSG:32748; square metres; holes retained','landCover':'All native pixel centres inside original valid polygon; all_touched=False; holes and multipolygons retained','invalidGeometry':'Excluded without repair; still visible in existing reference map','aggregation':'Overlapping boundaries are independent scenarios. Never sum to a city total.'},'sourceRecordCount':len(features),'count':len(records),'excluded':excluded,'overlapPairs':overlaps,'records':sorted(records,key=lambda r:r['id'])}

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();product=cook();path=OUT/'polder-budget-context.json'
 if args.check:
  assert json.loads(path.read_text())==product,'Cooked product differs from raw inputs or pipeline';print('PASS recomputed raw→cooked polder context, hashes, exclusions and native pixels')
 else:path.write_text(json.dumps(product,ensure_ascii=False,indent=1)+'\n');print(json.dumps({'count':product['count'],'excluded':product['excluded'],'overlappingPairs':len(product['overlapPairs']),'bytes':path.stat().st_size}))
if __name__=='__main__':main()
