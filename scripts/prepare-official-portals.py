#!/usr/bin/env python3
"""Refresh anonymous JIC project fields and Jakarta Satu green-space geometry.
Requires beautifulsoup4 for HTML; retains raw evidence outside public assets.
No resident records, staff identities, certificates or inferred coordinates.
"""
import json,re,hashlib,datetime,subprocess,concurrent.futures
from pathlib import Path
from urllib.parse import urlencode,urljoin
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parent.parent
RAW=ROOT/'data/source-evidence/official-2026-10-11'
OUT=ROOT/'public/data/jakarta-v1'
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat()
def download(url,path):
 subprocess.run(['curl','--fail','--max-time','50','-sS',url,'-o',str(path)],check=True)
 return path.read_bytes()
def save(name,d): (OUT/name).write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n')
def coordinates(text):
 # Only explicit coordinates in the publisher's Location field; DMS or decimal.
 dms=re.search(r'(\d+)°\s*(\d+)[\'′]\s*([\d.]+)[\"″]\s*S\s*[,;]?\s*(\d+)°\s*(\d+)[\'′]\s*([\d.]+)[\"″]\s*E',text)
 if dms:
  a,b,c,x,y,z=map(float,dms.groups());lat=-(a+b/60+c/3600);lng=x+y/60+z/3600
 else:
  dec=re.search(r'([\d.]+)°?\s*S\s*[,;]?\s*([\d.]+)°?\s*E',text)
  signed=re.search(r'(-6\.\d+)\s*[,;]\s*(106\.\d+)',text)
  if dec:lat,lng=-float(dec[1]),float(dec[2])
  elif signed:lat,lng=map(float,signed.groups())
  else:return None
 return [round(lng,6),round(lat,6)] if 106<lng<108 and -7<lat<-5 else None

def projects():
 source='https://invest.jakarta.go.id/potential-projects'
 raw=download(source,RAW/'investment.html');s=BeautifulSoup(raw,'html.parser');links={}
 for a in s.select('h3 a[href]'):
  u=urljoin(source,a['href']);m=re.search(r'/potential-projects/\d+/([^/]+)/(\d+)/',u)
  if m:links[u]={'id':m[2],'sector':m[1],'name':a.get_text(' ',strip=True),'sourceUrl':u}
 def detail(item):
  u,p=item;path=RAW/('project-'+p['id']+'.html')
  try:
   raw=download(u,path);s=BeautifulSoup(raw,'html.parser');p['sha256']=hashlib.sha256(raw).hexdigest();p['available']=True
   for title,key in [('Investment Cost','proposedCost'),('Expected Started Date','expectedStart'),('Land Area','landArea'),('Location','location')]:
    h=next((x for x in s.select('h5') if x.get_text(' ',strip=True)==title),None)
    if h:
     value=h.parent.get_text(' ',strip=True)[len(title):].strip();p[key]=value[:600]
   p['coordinates']=coordinates(p.get('location',''));p['coordinateSource']='publisher-location' if p['coordinates'] else None
  except Exception as e:p.update(available=False,error='Publisher detail unavailable',coordinates=None)
  print(p['id'],p['name'],p.get('coordinates'),flush=True);return p
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:rows=list(ex.map(detail,links.items()))
 assert len(rows)>20
 locations={}
 for row in rows:
  if row.get('coordinates'):locations.setdefault(tuple(row['coordinates']),[]).append(row)
 for group in locations.values():
  if len(group)>1:
   for row in group:row['publisherCoordinates']=row['coordinates'];row['coordinates']=None;row['coordinateWarning']='Duplicate publisher coordinate across distinct projects; mapping withheld'
 save('projects.json',{'publisher':'Jakarta Investment Centre · DPMPTSP','sourceUrl':source,'retrievedAt':NOW,'observedAt':None,'tier':'publisher-proposal','license':'Public reference; no dataset-specific open license stated','sha256':hashlib.sha256(raw).hexdigest(),'count':len(rows),'projects':rows})

def green():
 source='https://jakartasatu.jakarta.go.id/server/rest/services/JakartaSatu/model_gab_rth/MapServer/0/query'
 metadata=json.loads(download(source.removesuffix('/query')+'?f=pjson',RAW/'rth.html'))
 kinds={c['code']:c['name'] for f in metadata['fields'] if f['name']=='JENIS_OBJECT' for c in f['domain']['codedValues']}
 features=[];excluded=0;sourceCount=0;missing=0
 for offset in range(0,10000,1000):
  params={'where':'1=1','outFields':'NAMA,JENIS_OBJECT,KELURAHAN,KECAMATAN,KOTA','outSR':4326,'f':'geojson','resultRecordCount':1000,'resultOffset':offset,'orderByFields':'OBJECTID'}
  raw=download(source+'?'+urlencode(params),RAW/('rth-'+str(offset)+'.json'));d=json.loads(raw)
  if d.get('type')!='FeatureCollection':raise ValueError('ArcGIS error or invalid geometry response')
  sourceCount+=len(d['features'])
  for f in d['features']:
   g=f.get('geometry');p=f.get('properties',{})
   if not g or g['type'] not in ['Polygon','MultiPolygon']:missing+=1;continue
   rings=g['coordinates'] if g['type']=='Polygon' else [r for poly in g['coordinates'] for r in poly]
   if not rings or any(len(r)<4 or r[0]!=r[-1] for r in rings):missing+=1;continue
   if not all(105<pt[0]<108 and -8<pt[1]<-5 for ring in rings for pt in ring):excluded+=1;continue
   for ring in rings:
    for pt in ring:pt[:]=[round(pt[0],6),round(pt[1],6)]
   features.append({'type':'Feature','properties':{'name':p.get('NAMA') or 'RTH','kind':kinds.get(p.get('JENIS_OBJECT'),'Belum Diketahui'), 'kelurahan':p.get('KELURAHAN') or '', 'kecamatan':p.get('KECAMATAN') or '', 'kota':p.get('KOTA') or ''},'geometry':g})
  if len(d['features'])<1000:break
 else:raise ValueError('Pagination cap exceeded')
 save('green.geojson',{'type':'FeatureCollection','features':features,'publisher':'Pemprov DKI Jakarta · Jakarta Satu','source':source,'retrievedAt':NOW,'observedAt':None,'tier':'public-reference','count':len(features),'sourceRecordCount':sourceCount,'excludedOutOfRegion':excluded,'excludedMissingGeometry':missing,'crs':'EPSG:4326','precisionDecimals':6,'license':'Publisher attribution; dataset-specific open license not stated'})
 print('GREEN',len(features),flush=True)
if __name__=='__main__':
 import sys
 if '--green-only' not in sys.argv:projects()
 green()
