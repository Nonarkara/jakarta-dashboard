#!/usr/bin/env python3
"""Bake anonymous DSDA drainage geometry. --fetch refreshes bounded source pages; default is offline."""
import concurrent.futures,datetime,gzip,hashlib,json,math,pathlib,sys,time,urllib.parse,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
EVIDENCE=ROOT/'data/source-evidence/coverage-audit-2026-10-15'
OUT=ROOT/'public/data/jakarta-v1'
URL='https://jakartasatu.jakarta.go.id/server/rest/services/Saluran_Mikro_DSDA_View/MapServer/0/query'
FIELDS='OBJECTID,ID,TOPONIMI,KELURAHAN,KECAMATAN,KOTA,PANJANG'
COUNT=60718
PAGE=1000
BBOX=[106.65,-6.4,107,-6.05]
def save(obj,path):path.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n')
def fetch(offset):
 params={'where':'1=1','outFields':FIELDS,'returnGeometry':'true','outSR':4326,'orderByFields':'OBJECTID ASC','resultOffset':offset,'resultRecordCount':PAGE,'f':'geojson'}
 for attempt in range(3):
  try:
   req=urllib.request.Request(URL+'?'+urllib.parse.urlencode(params),headers={'User-Agent':'JakartaCivicDashboard/1.0 (public drainage reference)'})
   with urllib.request.urlopen(req,timeout=45)as r:b=r.read(12000000)
   d=json.loads(b)
   if d.get('type')!='FeatureCollection' or len(d.get('features',[]))!=min(PAGE,COUNT-offset):raise ValueError('unexpected source page')
   (EVIDENCE/f'drainage-{offset:05d}.json.gz').write_bytes(gzip.compress(b,mtime=0));return offset
  except Exception:
   if attempt==2:raise
   time.sleep(1+attempt)
if '--fetch' in sys.argv:
 EVIDENCE.mkdir(parents=True,exist_ok=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
  for n in pool.map(fetch,range(0,COUNT,PAGE)):print('Fetched',n,flush=True)
 save({'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'count':COUNT,'sourceUrl':URL,'fields':FIELDS,'pageSize':PAGE,'orderBy':'OBJECTID ASC','outSR':4326},EVIDENCE/'drainage-fetch.json')
receipt=json.loads((EVIDENCE/'drainage-fetch.json').read_text())
features=[];seen=set();rejected=0;before=0;after=0;digest=hashlib.sha256()
def distance(a,b):
 return math.hypot((b[0]-a[0])*111320*math.cos(math.radians((a[1]+b[1])/2)),(b[1]-a[1])*111320)
def simplify(points):
 # Radial simplification, not topology repair; preserve endpoints, retain vertices >=1m apart.
 result=[points[0]]
 for p in points[1:-1]:
  if distance(result[-1],p)>=1:result.append(p)
 if points[-1]!=result[-1]:result.append(points[-1])
 return [[round(x,6),round(y,6)]for x,y in result]
for offset in range(0,COUNT,PAGE):
 b=gzip.decompress((EVIDENCE/f'drainage-{offset:05d}.json.gz').read_bytes());digest.update(b)
 for f in json.loads(b)['features']:
  oid=f['properties']['OBJECTID']
  if oid in seen:raise SystemExit('duplicate OBJECTID')
  seen.add(oid);g=f.get('geometry')or{};kind=g.get('type');lines=[g.get('coordinates',[])]if kind=='LineString'else g.get('coordinates',[])if kind=='MultiLineString'else []
  if not lines or any(len(line)<2 or any(len(p)<2 or not all(isinstance(v,(int,float)) and math.isfinite(v)for v in p[:2]) or not(BBOX[0]<=p[0]<=BBOX[2] and BBOX[1]<=p[1]<=BBOX[3])for p in line)for line in lines):rejected+=1;continue
  length=sum(distance(a,b)for line in lines for a,b in zip(line,line[1:]));processed=[simplify(line)for line in lines]
  if any(len(line)<2 for line in processed):rejected+=1;continue
  before+=sum(map(len,lines));after+=sum(map(len,processed));p=f['properties'];name=str(p.get('TOPONIMI')or'').strip();p.update({'name':name if name not in ['0','-']else'','computedLengthM':round(length,1),'flowDirection':'not-measured','tier':'official-reference-geometry'})
  features.append({'type':'Feature','id':oid,'properties':p,'geometry':{'type':kind,'coordinates':processed[0]if kind=='LineString'else processed}})
if len(seen)!=COUNT:raise SystemExit('source count drift')
manifest={'schemaVersion':1,'count':len(features),'sourceRecordCount':COUNT,'excluded':rejected,'retrievedAt':receipt['retrievedAt'],'dataAsOf':None,'sourceUrl':URL,'publisher':'Pemprov DKI Jakarta / DSDA / Jakarta Satu','tier':'official-reference-geometry','license':'Dataset-specific open license not stated; publisher attribution required; permission to redistribute remains unconfirmed.','bbox':BBOX,'sourceCRS':'EPSG:32748','outputCRS':'EPSG:4326 (publisher outSR conversion)','sourceFields':FIELDS.split(','),'simplification':'Radial 1 metre; endpoints retained; 6 decimal coordinates. No topology reconstruction.','verticesBefore':before,'verticesAfter':after,'rawSha256':digest.hexdigest(),'limitations':'Reference geometry only; no publication epoch, capacity, operating state, measured direction or hydraulic connectivity. PANJANG=0 and TOPONIMI=0 can be source placeholders. Named administrative fields are retained without spatial reconciliation.'}
(ROOT/'out').mkdir(exist_ok=True)
save({'type':'FeatureCollection','features':features,'count':len(features),'sourceUrl':URL,'dataAsOf':None,'retrievedAt':receipt['retrievedAt']},ROOT/'out/official-drainage.geojson');save(manifest,OUT/'official-drainage-manifest.json')
print(json.dumps(manifest,ensure_ascii=False))
# Optional local archive bake; the public application consumes range-requested tiles.
import shutil,subprocess,struct
archive=ROOT/'data/tiles/jakarta-official-drainage-v1.pmtiles'
if '--tiles' in sys.argv:
 executable=shutil.which('tippecanoe')
 if not executable:raise SystemExit('tippecanoe required for --tiles')
 archive.parent.mkdir(parents=True,exist_ok=True)
 subprocess.run([executable,'--force','--minimum-zoom=11','--maximum-zoom=16','--drop-densest-as-needed','--layer=official_drains','--output='+str(archive),str(ROOT/'out/official-drainage.geojson')],check=True)
if archive.exists():
 b=archive.read_bytes()
 manifest['tiles']={'path':'/jakarta-official-drainage.pmtiles','r2Key':'networks/jakarta-official-drainage-v1.pmtiles','sourceLayer':'official_drains','minzoom':b[100],'maxzoom':b[101],'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'format':'PMTiles v3 / MVT','lowZoomPolicy':'Tippecanoe drop-densest-as-needed; tiled simplification means not every admitted feature visible at each zoom.'}
 manifest['archiveSha256']=manifest['tiles']['sha256']
 manifest['excludedReasons']={'missingGeometry':2,'degenerateLineAfterSimplification':2}
 manifest['clipping']='No geometry cropped. Features required wholly within declared bbox; no out-of-bbox exclusions in this snapshot.'
 save(manifest,OUT/'official-drainage-manifest.json')
