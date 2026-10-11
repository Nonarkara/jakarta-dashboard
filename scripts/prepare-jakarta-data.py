#!/usr/bin/env python3
"""Bake official scheduled transit and selected public civic records. No live vehicles."""
import csv,io,json,zipfile,urllib.request,hashlib,datetime,collections,math
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public'/'data'/'jakarta-v1';OUT.mkdir(parents=True,exist_ok=True)
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat()
def get(url):
 return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'JakartaDashboard/1.0 source preparation'}),timeout=60).read()
def save(name,data):
 (OUT/name).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
def rows(z,n):return list(csv.DictReader(io.StringIO(z.read(n).decode('utf-8-sig'))))
def simplify(p,epsilon=0.0001):
 if len(p)<3:return p
 a,b=p[0],p[-1];dx,dy=b[0]-a[0],b[1]-a[1];den=dx*dx+dy*dy
 def dist(v):
  t=max(0,min(1,((v[0]-a[0])*dx+(v[1]-a[1])*dy)/den)) if den else 0
  return math.hypot(v[0]-a[0]-t*dx,v[1]-a[1]-t*dy)
 ds=[dist(v) for v in p];i=max(range(len(ds)),key=ds.__getitem__)
 return simplify(p[:i+1],epsilon)[:-1]+simplify(p[i:],epsilon) if ds[i]>epsilon else [a,b]
url='https://gtfs.transjakarta.co.id/files/file_gtfs.zip';raw=get(url);z=zipfile.ZipFile(io.BytesIO(raw))
stops={r['stop_id']:r for r in rows(z,'stops.txt')};trips=rows(z,'trips.txt');routes=rows(z,'routes.txt');cal=rows(z,'calendar.txt')
shapes=collections.defaultdict(list)
for r in rows(z,'shapes.txt'):shapes[r['shape_id']].append((int(r['shape_pt_sequence']),[round(float(r['shape_pt_lon']),5),round(float(r['shape_pt_lat']),5)]))
freq=collections.defaultdict(list)
for r in rows(z,'frequencies.txt'):freq[r['trip_id']].append({'start':r['start_time'],'end':r['end_time'],'seconds':int(r['headway_secs'])})
byroute=collections.defaultdict(list)
for t in trips:byroute[t['route_id']].append(t)
chosen={}
for r in routes:
 groups=collections.defaultdict(list)
 for t in byroute[r['route_id']]:groups[t.get('direction_id','0')].append(t)
 chosen[r['route_id']]=[max(g,key=lambda t:sum(x.get('shape_id')==t.get('shape_id') for x in g)) for g in groups.values()]
tripids={t['trip_id'] for g in chosen.values() for t in g};times=collections.defaultdict(list)
for r in rows(z,'stop_times.txt'):
 if r['trip_id'] in tripids:times[r['trip_id']].append(r)
result=[]
for i,r in enumerate(routes):
 rid=r['route_id'];features=[];directions=[]
 for t in chosen[rid]:
  coords=simplify([p for _,p in sorted(shapes.get(t.get('shape_id'),[]))])
  if len(coords)>1:features.append({'type':'Feature','properties':{'name':r['route_long_name'],'route':r['route_short_name']},'geometry':{'type':'LineString','coordinates':coords}})
  seq=[]
  for st in sorted(times[t['trip_id']],key=lambda x:int(x['stop_sequence'])):
   s=stops.get(st['stop_id']);
   if not s:continue
   lon,lat=float(s['stop_lon']),float(s['stop_lat'])
   if not (105<lon<108 and -8<lat<-5):raise ValueError('GTFS coordinate out of region')
   seq.append({'id':s['stop_id'],'name':s['stop_name'],'lng':round(lon,5),'lat':round(lat,5),'scheduledTime':st.get('departure_time')})
  directions.append({'headsign':t.get('trip_headsign'), 'stops':seq,'frequencies':freq[t['trip_id']]})
 detail={'id':rid,'name':r['route_long_name'],'short':r['route_short_name'],'directions':directions,'geometry':{'type':'FeatureCollection','features':features}}
 filename=f'route-{i}.json';save(filename,detail)
 result.append({'id':rid,'short':r['route_short_name'],'name':r['route_long_name'],'detail':f'/data/jakarta-v1/{filename}','stopCount':len({s['id'] for d in directions for s in d['stops']})})
manifest={'retrievedAt':NOW,'source':url,'publisher':'PT Transportasi Jakarta','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','tier':'scheduled-static','sha256':hashlib.sha256(raw).hexdigest(),'crs':'EPSG:4326','precisionDecimals':5,'simplificationDegrees':0.0001,'changes':'Selected representative trips per direction; geometry simplified; normalized JSON','routeCount':len(routes),'stopRecordCount':len(stops),'calendarFrom':min(r['start_date'] for r in cal),'calendarTo':max(r['end_date'] for r in cal),'timezone':'Asia/Jakarta','routes':sorted(result,key=lambda r:r['short'])}
save('transit.json',manifest)
print('GTFS',len(routes),'routes',len(stops),'stop records',manifest['calendarFrom'],manifest['calendarTo'])
# Public infrastructure only; no staff names, editor identities or resident records.
civic=[]
for name,service in [('health','Fasilitas_Kesehatan'),('schools','Sekolah')]:
 base=f'https://jakartasatu.jakarta.go.id/server/rest/services/JakartaSatu/{service}/MapServer/0/query'
 params='?where=1%3D1&outFields=NAMA,JENIS,KELURAHAN,KECAMATAN,KOTA_ADMIN&outSR=4326&f=geojson&resultRecordCount=1000&resultOffset='
 features=[];offset=0
 while True:
  d=json.loads(get(base+params+str(offset)))
  if 'error' in d or d.get('type')!='FeatureCollection':raise ValueError(str(d.get('error',d))[:200])
  f=d['features'];features.extend(f)
  if not f or len(f)<1000:break
  offset+=len(f)
  if offset>10000:raise ValueError('Civic pagination limit')
 clean=[]
 for f in features:
  g=f.get('geometry');p=f.get('properties',{})
  if not g or g.get('type')!='Point':continue
  lon,lat=g['coordinates'][:2]
  if not (105<lon<108 and -8<lat<-5):continue
  clean.append({'type':'Feature','properties':{'name':p.get('NAMA',''),'kind':p.get('JENIS',''),'kelurahan':p.get('KELURAHAN',''),'kecamatan':p.get('KECAMATAN',''),'kota':p.get('KOTA_ADMIN','')},'geometry':{'type':'Point','coordinates':[round(lon,5),round(lat,5)]}})
 doc={'type':'FeatureCollection','features':clean,'source':base,'publisher':'Pemprov DKI Jakarta · Jakarta Satu','retrievedAt':NOW,'observedAt':None,'tier':'public-reference','crs':'EPSG:4326','precisionDecimals':5,'license':'Publisher attribution; dataset-specific open license not stated in service metadata','count':len(clean)}
 save(name+'.geojson',doc);civic.append({'id':name,'count':len(clean),'url':f'/data/jakarta-v1/{name}.geojson','source':base,'retrievedAt':NOW,'tier':doc['tier']});print(name,len(clean))
save('civic.json',{'retrievedAt':NOW,'layers':civic})
