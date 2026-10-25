#!/usr/bin/env python3
"""Reproducible selected-polder facility membership. Uses acquired references, no network."""
import argparse,gzip,hashlib,json,math
from pathlib import Path
from shapely.geometry import shape,Point
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'public/data/jakarta-v1'

def digest(data):return hashlib.sha256(data).hexdigest()
def memberships(point,polygons):return [identity for identity,g in polygons if g.covers(point)]
def cook():
 raw=gzip.decompress((ROOT/'data/source-evidence/coverage-audit-2026-10-15/polders.geojson.gz').read_bytes())
 manifest=json.loads((BASE/'official-polders-manifest.json').read_text())
 if digest(raw)!=manifest['rawSha256']:raise ValueError('Original boundary SHA256 mismatch')
 polygons=[];excluded=[];boundaries=[]
 for f in json.loads(raw)['features']:
  identity=f['properties']['OBJECTID'];g=shape(f['geometry'])
  if not g.is_valid or g.is_empty or g.geom_type not in ('Polygon','MultiPolygon'):excluded.append(identity);continue
  polygons.append((identity,g));boundaries.append({'id':identity,'name':f['properties']['NAMOBJ'],'memberKeys':[],'counts':{'health':0,'schools':0}})
 by_id={b['id']:b for b in boundaries};sources=[];features=[]
 for source_id in ['health','schools']:
  body=(BASE/(source_id+'.geojson')).read_bytes();data=json.loads(body)
  if data['crs']!='EPSG:4326' or data['count']!=len(data['features']):raise ValueError('Reference CRS/count mismatch')
  source={key:data.get(key) for key in ['source','publisher','retrievedAt','observedAt','tier','license','precisionDecimals']}
  source.update({'id':source_id,'asset':source_id+'.geojson','sha256':digest(body),'inputRows':len(data['features']),'invalidRows':[],'duplicates':0,'validUniqueRows':0,'outsideAllBoundaries':0,'insideAnyBoundary':0})
  seen={}
  for index,f in enumerate(data['features']):
   g=f.get('geometry') or {};p=f.get('properties') or {};c=g.get('coordinates')
   if g.get('type')!='Point' or not isinstance(c,list) or len(c)!=2 or not all(isinstance(x,(float,int)) and not isinstance(x,bool) and math.isfinite(x) for x in c) or not(106<c[0]<108 and -7<c[1]<-5):source['invalidRows'].append(index);continue
   public_props={field:p.get(field,'') if isinstance(p.get(field,''),str) else '' for field in ['name','kind','kelurahan','kecamatan','kota']}
   key=json.dumps([public_props,c],ensure_ascii=False,sort_keys=True)
   if key in seen:
    source['duplicates']+=1;seen[key]['properties']['sourceRows'].append(index);continue
   source['validUniqueRows']+=1;ids=memberships(Point(c),polygons)
   props=public_props.copy()
   props.update({'key':source_id+':'+str(index),'sourceId':source_id,'sourceRows':[index],'boundaryIds':ids,'onBoundaryIds':[identity for identity,g in polygons if identity in ids and g.touches(Point(c))]})
   row={'type':'Feature','properties':props,'geometry':{'type':'Point','coordinates':c}};seen[key]=row
   if not ids:source['outsideAllBoundaries']+=1;continue
   source['insideAnyBoundary']+=1;features.append(row)
   for identity in ids:by_id[identity]['memberKeys'].append(props['key']);by_id[identity]['counts'][source_id]+=1
  if source['inputRows']!=len(source['invalidRows'])+source['duplicates']+source['validUniqueRows']:raise ValueError('Reference rows do not reconcile')
  if source['validUniqueRows']!=source['outsideAllBoundaries']+source['insideAnyBoundary']:raise ValueError('Membership counts do not reconcile')
  sources.append(source)
 return {'contract':'polder-facilities-v1','type':'FeatureCollection','crs':'EPSG:4326','tier':'derived-public-reference','boundarySource':{key:manifest.get(key) for key in ['sourceUrl','retrievedAt','license']},'boundaryObservedAt':None,'rawBoundarySha256':digest(raw),'excludedBoundaryIds':excluded,'sources':sources,'boundaries':boundaries,'features':features,'method':'Original valid DSDA polygons cover the published facility point; exact boundary points included; holes retained. Exact public-property/coordinate duplicates merged within source, source row indexes retained.','limitations':'Reference membership only. Unknown observation dates and rounded coordinates. Not flood impact, service availability, occupancy or shelter designation. Overlapping boundary lists must not be summed.'}
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();result=cook();path=BASE/'polder-facilities.json'
 if args.check:
  if json.loads(path.read_text())!=result:raise SystemExit('FAIL cooked product differs from raw inputs or method')
  print('PASS recomputed original-boundary facility membership')
 else:path.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n');print(json.dumps({'features':len(result['features']),'boundaries':len(result['boundaries']),'sources':result['sources'],'bytes':path.stat().st_size}))
