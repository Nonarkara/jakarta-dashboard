#!/usr/bin/env python3
"""Rebuild the network assets from compressed public source evidence. No authenticated streams are harvested."""
import json,gzip,math,collections,datetime
from pathlib import Path
root=Path(__file__).resolve().parents[1];dest=root/'public/data/jakarta-v1';ev=root/'data/source-evidence/networks-2026-10-12';ev.mkdir(parents=True,exist_ok=True)
now=json.loads((ev/'collection.json').read_text())['checkedAt']
def load(name):
 with gzip.open(ev/name,'rt') as f:return f.read()
def save(name,d):
 (dest/name).write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')))
def rdp(p,t=0.00002):
 if len(p)<3:return p
 a,b=p[0],p[-1];dx=b[0]-a[0];dy=b[1]-a[1];den=dx*dx+dy*dy
 distances=[]
 for x,y in p[1:-1]:
  q=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/den)) if den else 0
  distances.append(math.hypot(x-a[0]-q*dx,y-a[1]-q*dy))
 m=max(distances,default=0)
 if m<=t:return [a,b]
 i=distances.index(m)+1;return rdp(p[:i+1],t)[:-1]+rdp(p[i:],t)
def length(p):
 total=0
 for a,b in zip(p,p[1:]):
  lat1,lat2=map(math.radians,[a[1],b[1]]);dl=math.radians(b[0]-a[0]);dd=lat2-lat1
  total+=6371008.8*2*math.asin(min(1,math.sqrt(math.sin(dd/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dl/2)**2)))
 return round(total,1)
d=json.loads(load('osm-waterways.json.gz'));fs=[]
for e in d['elements']:
 p=[[round(g['lon'],5),round(g['lat'],5)] for g in e.get('geometry',[])];tags=e.get('tags',{});kind=tags.get('waterway')
 if len(p)<2:continue
 area=tags.get('natural')=='water' and p[0]==p[-1] and len(p)>=4
 q=rdp(p)
 if area and len(q)<4:q=p
 props={'id':str(e['id']),'name':tags.get('name',''),'kind':'waterbody' if area else kind or 'waterbody-edge','intermittent':tags.get('intermittent','unknown'),'tunnel':tags.get('tunnel','unknown'),'lengthM':None if area else length([[g['lon'],g['lat']] for g in e['geometry']]),'flowDirection':'not-measured'}
 fs.append({'type':'Feature','geometry':{'type':'Polygon','coordinates':[q]} if area else {'type':'LineString','coordinates':q},'properties':props})
meta={'source':'OpenStreetMap contributors / Overpass','sourceUrl':'https://overpass.kumi.systems/api/interpreter','sourceAsOf':d['osm3s']['timestamp_osm_base'],'checkedAt':now,'license':'ODbL','crs':'EPSG:4326','bbox':[106.65,-6.4,107,-6.08],'precisionDecimals':5,'simplificationToleranceDegrees':0.00002,'tier':'mapped-reference','count':len(fs),'kinds':dict(collections.Counter(f['properties']['kind'] for f in fs)),'note':'All returned mapped river/canal/stream/drain/ditch ways and natural-water ways in bbox. Not every physical drain; multipolygon relations and upstream geometry outside bbox are not included. OSM way order is not measured flow direction.'}
save('waterways.geojson',{'type':'FeatureCollection',**meta,'features':fs});save('waterways-manifest.json',meta)
fs=[]
for p in ['/tmp/jkt-cameras','/tmp/jkt-cameras-page2.json','/tmp/jkt-cameras-page2000','/tmp/jkt-cameras-page3000','/tmp/jkt-cameras-page4000']:
 for f in json.loads(load(Path(p).name+'.gz'))['features']:
  a=f['properties'];c=f['geometry']['coordinates'];u=a.get('url','')
  if not(106.55<c[0]<107.1 and -6.5<c[1]<-6.0):continue
  if not u.startswith('http://cctv.balitower.co.id:80/'):continue
  fs.append({'type':'Feature','geometry':{'type':'Point','coordinates':[round(v,5) for v in c]},'properties':{'id':str(a['OBJECTID']),'name':a['site_name'],'address':a.get('location',''),'city':a.get('walikota',''),'district':a.get('kecamatan',''),'sourceUrl':u,'playerUrl':u.replace('http://cctv.balitower.co.id:80/','https://cctv.balitower.co.id/'),'availability':'not-verified','coordinateTier':'publisher-catalog'}})
info=json.loads(load('camera-info.json.gz'))
meta={'source':'Public ArcGIS CCTV Jakarta 2019 catalog / Balitower links','sourceUrl':'https://services2.arcgis.com/LvCBNZuwhTWWbvod/arcgis/rest/services/cctv_jakarta_2019/FeatureServer/0','checkedAt':now,'catalogEditedAt':datetime.datetime.fromtimestamp(info['editingInfo']['dataLastEditDate']/1000,datetime.timezone.utc).isoformat(),'tier':'public-camera-reference','license':'No explicit redistribution license in catalog; publisher attribution and source links. Video remains on provider.','sourceRecordCount':4340,'count':len(fs),'excluded':4340-len(fs),'note':'Coordinates are catalog locations, not verified current camera positions. Links do not establish uptime; HTTPS playback may fail. No congestion/speed measurement.'}
save('traffic-cameras.geojson',{'type':'FeatureCollection',**meta,'features':fs});save('traffic-cameras-manifest.json',meta)
levels=json.loads(load('gauges.json.gz'))['response'];save('hydrology-reference.json',{'source':'BBWS Ciliwung Cisadane / EWS Sodetan Ciliwung','sourceUrl':'https://ewscilicis.id/','checkedAt':now,'stations':[{'id':x['id'],'name':x['name'],'lng':x['longitude'],'lat':x['latitude'],'basin':x['watershed_name']} for x in levels if x.get('longitude') and x.get('latitude')]})
print('camera references',len(fs));print('asset sizes',[(p.name,p.stat().st_size) for p in [dest/'waterways.geojson',dest/'traffic-cameras.geojson']])
