#!/usr/bin/env python3
"""Bake Jakarta Satu's public flood-telemetry network, flood-risk reference and
official population denominators into dated public assets.

Anonymous ArcGIS REST reads only; bounded pagination, fixed field allowlists,
no editor/staff/certificate fields, no inferred coordinates. Station geometry
comes from the published SHAPE (or the layer's own LAT/LONG_ attributes for
Pintu Air). Upstream catchment stations outside the DKI map bbox are kept in
the desk summary and excluded from the map overlays, mirroring the green-space
exclusion contract. Raw query evidence is stored under data/source-evidence/.
"""
import json,re,datetime,hashlib
from pathlib import Path
from urllib.request import urlopen,Request

ROOT=Path(__file__).resolve().parent.parent
RAW=ROOT/'data/source-evidence/flood-network-2026-10-11'
OUT=ROOT/'public/data/jakarta-v1'
RAW.mkdir(parents=True,exist_ok=True)
NOW=datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
UA='JakartaDashboard/1.0 (jakarta.nonarkara.org)'
BASE='https://jakartasatu.jakarta.go.id/server/rest/services'
PUBLISHER='Pemprov DKI Jakarta · Jakarta Satu'
LICENSE='Publisher attribution; dataset-specific open license not stated'
# DKI mainland map bbox (atlas bbox); wider catchment bound keeps Bogor/Depok/Tangerang stations in the desk.
DKI=(106.65,-6.40,107.00,-6.08)
CATCHMENT=(106.4,-7.0,107.3,-5.9)

def fetch(url,name):
    req=Request(url,headers={'User-Agent':UA})
    with urlopen(req,timeout=60) as r: body=r.read()
    (RAW/name).write_bytes(body)
    return hashlib.sha256(body).hexdigest()

def query(service,order='OBJECTID',limit=10000):
    """Paged geojson query. outFields=* is requested because ARR rejects
    explicit field lists; imports below copy only allowlisted fields."""
    out=[];sha=None;offset=0
    while len(out)<limit:
        url=f'{BASE}/{service}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson&orderByFields={order}&resultRecordCount=1000&resultOffset={offset}'
        sha=fetch(url,f'{service.replace("/","_")}-{offset}.geojson')
        page=json.loads((RAW/f'{service.replace("/","_")}-{offset}.geojson').read_text())
        feats=page.get('features',[])
        if page.get('error'): raise SystemExit(f'ArcGIS error on {service}: {page["error"]}')
        out+=feats
        if len(feats)<1000: break
        offset+=1000
    return out,sha

def pt_lnglat(f):
    g=f.get('geometry') or {}
    if g.get('type')=='Point' and isinstance(g.get('coordinates'),list) and len(g['coordinates'])>=2:
        lng,lat=g['coordinates']
        if -180<=lng<=180 and -90<=lat<=90: return [round(lng,6),round(lat,6)]
    return None

def in_box(lnglat,box):
    if not lnglat: return False
    return box[0]<=lnglat[0]<=box[2] and box[1]<=lnglat[1]<=box[3]

SIAGA_RE=re.compile(r'^\s*(<=?|>=?)?\s*(-?\d+(?:\.\d+)?)\s*(?:[-–]\s*(-?\d+(?:\.\d+)?)\s*)?cm',re.I)
def siaga(value,level):
    """Parse official band text like '> 350 cm', '250 - 350 cm', '-50 - 0 cm', '< -50 cm'. Original text is always kept."""
    text=str(value or '').strip()
    m=SIAGA_RE.match(text)
    lo=hi=None
    if m:
        op=m.group(1) or ''
        a=float(m.group(2)); b=m.group(3)
        if b is not None: lo,hi=min(a,float(b)),max(a,float(b))
        elif op.startswith('>'): lo=a
        elif op.startswith('<'): hi=a
        else: lo=hi=a
    return {'level':level,'original':text,'unit':'cm','minCm':lo,'maxCm':hi}

def round_poly(geom):
    if not geom or geom.get('type') not in ('Polygon','MultiPolygon'): return None
    def ring(r): return [[round(c[0],6),round(c[1],6)] for c in r]
    if geom['type']=='Polygon':
        rings=[ring(r) for r in geom['coordinates']]
        rings=[r for r in rings if len(r)>=3]
        if not rings or rings[0][0]!=rings[0][-1]: return None
        return {'type':'Polygon','coordinates':rings}
    polys=[]
    for rings in geom['coordinates']:
        fixed=[ring(r) for r in rings]
        fixed=[r for r in fixed if len(r)>=3]
        if fixed and fixed[0][0]==fixed[0][-1]: polys.append(fixed)
    return {'type':'MultiPolygon','coordinates':polys} if polys else None

# ── 1. AWLR water-level stations with official SIAGA bands ─────────────────
awlr_raw,awlr_sha=query('Automatic_Water_Level_Recorder_AWLR/MapServer/0')
awlr=[];awlr_out=0
for f in awlr_raw:
    p=f['properties']; ll=pt_lnglat(f) or ([round(float(p['LONG_']),6),round(float(p['LAT']),6)] if p.get('LAT') is not None and p.get('LONG_') is not None else None)
    if not ll or not in_box(ll,CATCHMENT): awlr_out+=1; continue
    row={'kind':'Pos Pantau Air (AWLR)','name':str(p.get('LOK_AWAL') or '').strip() or 'Pos pantau air','river':str(p.get('ALIRAN_KALI') or '').strip() or None,
         'city':str(p.get('WADMKK') or '').strip() or None,'address':str(p.get('ALAMAT') or '').strip() or None,
         'siaga':[siaga(p.get(f'SIAGA_{i}'),i) for i in (1,2,3,4)],'coordinates':ll}
    awlr.append(row)
assert 20<=len(awlr)<=40 and awlr_out<10, f'AWLR count unexpected: {len(awlr)} in, {awlr_out} out'

# ── 2. ARR rain-gauge stations ──────────────────────────────────────────────
arr_raw,arr_sha=query('Automatic_Rainfall_Recorder_ARR/MapServer/0')
arr=[];arr_out=0
for f in arr_raw:
    p=f['properties']; ll=pt_lnglat(f) or ([round(float(p['LONG_']),6),round(float(p['LAT']),6)] if p.get('LAT') is not None and p.get('LONG_') is not None else None)
    if not ll or not in_box(ll,CATCHMENT): arr_out+=1; continue
    arr.append({'kind':'Pos Curah Hujan (ARR)','name':str(p.get('NAMAOBJ') or '').strip() or 'Pos curah hujan','basin':str(p.get('DAS') or '').strip() or None,
                'city':str(p.get('WADMKK') or '').strip() or None,'address':str(p.get('ALAMAT') or '').strip() or None,
                'installedYear':int(p['TAHUN']) if isinstance(p.get('TAHUN'),(int,float)) else None,'coordinates':ll})
assert 40<=len(arr)<=70, f'ARR count unexpected: {len(arr)}'

# ── 3. Flood infrastructure: pumps, floodgates, reservoirs ────────────────
pumps_raw,_=query('Peta_Kerja_BPAD/FeatureServer/1')  # FeatureServer carries geometry; MapServer layer 1 is attribute-only
gates_raw,_=query('Peta_Kerja_BPAD/MapServer/2')
waduk_raw,_=query('Peta_Kerja_BPAD/FeatureServer/3')  # geometry only on FeatureServer
infra=[];infra_out=0
for f in pumps_raw:
    p=f['properties']; ll=pt_lnglat(f)
    if not ll or not in_box(ll,DKI): infra_out+=1; continue
    infra.append({'kind':'Pompa','name':str(p.get('LOKPOMPA') or '').strip() or 'Pompa','kota':str(p.get('WADMKK') or '').strip() or None,
                  'kecamatan':str(p.get('WADMKC') or '').strip() or None,'kelurahan':str(p.get('WADMKD') or '').strip() or None,'coordinates':ll})
for f in gates_raw:
    p=f['properties']; ll=pt_lnglat(f)
    if ll is None and isinstance(p.get('LONGITUDE'),(int,float)) and isinstance(p.get('LATITUDE'),(int,float)):
        ll=[round(float(p['LONGITUDE']),6),round(float(p['LATITUDE']),6)]
    if not ll or not in_box(ll,DKI): infra_out+=1; continue
    infra.append({'kind':'Pintu Air','name':str(p.get('NAMAOBJ') or '').strip() or 'Pintu air','coordinates':ll})
for f in waduk_raw:
    p=f['properties']; ll=pt_lnglat(f)
    if not ll or not in_box(ll,DKI): infra_out+=1; continue
    infra.append({'kind':'Waduk & Embung','name':str(p.get('NAMAOBJ') or '').strip() or 'Waduk','kota':str(p.get('WADMKK') or '').strip() or None,
                  'kecamatan':str(p.get('WADMKC') or '').strip() or None,'kelurahan':str(p.get('WADMKD') or '').strip() or None,'coordinates':ll})
assert 700<=len(infra)<=1200 and sum(1 for i in infra if i['kind']=='Pompa')>=200 and sum(1 for i in infra if i['kind']=='Pintu Air')>=450, f'infra counts: {len(infra)}'

# ── 4. Situ lakes ──────────────────────────────────────────────────────────
situ_raw,_=query('PETA_SITU/MapServer/0')
situ=[];situ_kept=0
for f in situ_raw:
    p=f['properties']; geom=round_poly(f.get('geometry'))
    if not geom: continue
    situ_kept+=1
    situ.append({'kind':'Situ / Rawa','name':str(p.get('NAMA_SITU') or '').strip() or 'Situ','kelurahan':str(p.get('KELURAHAN') or '').strip() or None,
                 'kecamatan':str(p.get('KECAMATAN') or '').strip() or None,'kota':str(p.get('KOTA') or '').strip() or None,
                 'areaHa':round(float(p['LUAS_HA']),4) if isinstance(p.get('LUAS_HA'),(int,float)) else None,
                 'condition':str(p.get('KONDISI') or '').strip() or None,'geometry':geom})
assert 20<=len(situ)<=40, f'situ count: {len(situ)}'

# ── 5. Flood-risk polygons with official KELAS classes ──────────────────────
risk_raw,risk_sha=query('Resiko_Bencana/MapServer/3',order='OBJECTID')
risk=[];risk_dropped=0
for f in risk_raw:
    p=f['properties']; geom=round_poly(f.get('geometry'))
    if not geom: risk_dropped+=1; continue
    kelas=str(p.get('KELAS') or '').strip()
    if kelas not in ('Ringan','Sedang','Berat'): risk_dropped+=1; continue
    risk.append({'kelas':kelas,'kelurahan':str(p.get('WADMKD') or '').strip() or None,'kecamatan':str(p.get('WADMKC') or '').strip() or None,
                 'kota':str(p.get('WADMKK') or '').strip() or None,'kelurahanCode':str(p.get('KDEPUM') or '').strip() or None,'geometry':geom})
assert 1500<=len(risk)<=2200 and risk_dropped<60, f'risk: {len(risk)} kept, {risk_dropped} dropped'

# ── 6. Official population denominators (Kependudukan 2023 semester 2) ─────
def pop_layer(layer_id,label):
    rows_raw,sha=query(f'Kependudukan_Tahun_2023_Semester_2/MapServer/{layer_id}')
    rows=[]
    for f in rows_raw:
        p=f['properties']
        rows.append({'name':str(p.get('WADMKD') or p.get('WADMKC') or p.get('WADMKK') or '').strip(),
                     'kecamatan':str(p.get('WADMKC') or '').strip() or None,'kota':str(p.get('WADMKK') or '').strip() or None,
                     'code':str(p.get('KDEPUM') or p.get('KDCPUM') or p.get('KDPKAB') or '').strip() or None,
                     'wni':int(p['WNI_LP']) if isinstance(p.get('WNI_LP'),(int,float)) else None,
                     'households':int(p['KK_LP']) if isinstance(p.get('KK_LP'),(int,float)) else None,
                     'children':int(p['ANAK_LP']) if isinstance(p.get('ANAK_LP'),(int,float)) else None,
                     'elderly60':int(p['LANSIA60_LP']) if isinstance(p.get('LANSIA60_LP'),(int,float)) else None,
                     'areaKm2':round(float(p['LUAS']),3) if isinstance(p.get('LUAS'),(int,float)) else None,
                     'density':round(float(p['KEPADATANWNI']),2) if isinstance(p.get('KEPADATANWNI'),(int,float)) else None})
    return rows,sha
pop_kd,pop_kd_sha=pop_layer(1,'kelurahan'); pop_kc,_=pop_layer(2,'kecamatan'); pop_kt,_=pop_layer(0,'kota')
assert 250<=len(pop_kd)<=280 and 40<=len(pop_kc)<=50 and 5<=len(pop_kt)<=7, f'pop counts {len(pop_kd)}/{len(pop_kc)}/{len(pop_kt)}'
for kt in pop_kt:
    s=sum(r['wni'] for r in pop_kd if r['kota']==kt['name'] and r['wni'])
    assert abs(s-kt['wni'])<=1, f'kelurahan sum {s} != kota {kt["name"]} {kt["wni"]}'

# ── 7. Risk × population join, aggregated per kelurahan ─────────────────────
digits=lambda c:re.sub(r'\D','',str(c or ''))
pop_by_code={digits(r['code']):r for r in pop_kd if r['code']}
risk_by_code={}
for r in risk:
    code=digits(r['kelurahanCode'])
    if not code: continue
    e=risk_by_code.setdefault(code,{'kelurahan':r['kelurahan'],'kota':r['kota'],'polygons':0,'classes':{}})
    e['polygons']+=1
    e['classes'][r['kelas']]=e['classes'].get(r['kelas'],0)+1
joined=0;risk_summary=[]
for code,e in sorted(risk_by_code.items()):
    p=pop_by_code.get(code)
    if p: joined+=1
    dominant=max(e['classes'],key=lambda k:(e['classes'][k],{'Ringan':1,'Sedang':2,'Berat':3}[k]))
    risk_summary.append({'kelurahanCode':code,'kelurahan':e['kelurahan'],'kota':e['kota'],'polygons':e['polygons'],
        'classes':e['classes'],'dominantClass':dominant,'beratPolygons':e['classes'].get('Berat',0),
        'worstClass':max(e['classes'],key=lambda k:{'Ringan':1,'Sedang':2,'Berat':3}[k]),
        'wni':p['wni'] if p else None,'households':p['households'] if p else None,
        'children':p['children'] if p else None,'elderly60':p['elderly60'] if p else None})
assert joined>=0.8*len(risk_by_code), f'population join below 80%: {joined}/{len(risk_by_code)}'

def fc(features,kind_key,source,total,excluded,extra=None):
    doc={'type':'FeatureCollection','publisher':PUBLISHER,'source':source,'sourceUrl':source,'retrievedAt':NOW,'observedAt':None,
         'tier':'public-reference','license':LICENSE,'sourceRecordCount':total,'excludedOutOfRegion':excluded,'crs':'EPSG:4326','precisionDecimals':6}
    if extra: doc.update(extra)
    doc['count']=len(features)
    doc['features']=[{'type':'Feature','properties':({k:v for k,v in row.items() if k not in ('coordinates','geometry')}),
                      'geometry':{'type':'Point','coordinates':row['coordinates']} if 'coordinates' in row else row['geometry']} for row in features]
    return doc

def save(name,d): (OUT/name).write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n')

def region_only(rows):
    return [r for r in rows if in_box(r['coordinates'],DKI)]

awlr_src=f'{BASE}/Automatic_Water_Level_Recorder_AWLR/MapServer/0'
arr_src=f'{BASE}/Automatic_Rainfall_Recorder_ARR/MapServer/0'
save('awlr.geojson',fc(region_only(awlr),'kind',awlr_src,len(awlr_raw),len(awlr_raw)-len(region_only(awlr)),
    extra={'note':'Official SIAGA 1–4 water-level alert bands in cm as published per station; no live readings.'}))
save('arr.geojson',fc(region_only(arr),'kind',arr_src,len(arr_raw),len(arr_raw)-len(region_only(arr)),
    extra={'note':'Automatic rain-gauge reference points incl. river basin; no live rainfall values.'}))
save('pumps.geojson',fc(region_only(infra),'kind',f'{BASE}/Peta_Kerja_BPAD/MapServer',len(pumps_raw)+len(gates_raw)+len(waduk_raw),
    len(pumps_raw)+len(gates_raw)+len(waduk_raw)-len(region_only(infra)),
    extra={'note':'Flood-control infrastructure reference: pumps, floodgates (pintu air) and reservoirs (waduk/embung).'}))
save('situ.geojson',fc(situ,'kind',f'{BASE}/PETA_SITU/MapServer/0',len(situ_raw),len(situ_raw)-len(situ),
    extra={'note':'Retention lakes with published condition; silted (pendangkalan) states are publisher records.'}))
save('risk.geojson',{'type':'FeatureCollection','publisher':PUBLISHER,'source':f'{BASE}/Resiko_Bencana/MapServer/3',
    'sourceUrl':f'{BASE}/Resiko_Bencana/MapServer/3','retrievedAt':NOW,'observedAt':None,'tier':'public-reference',
    'license':LICENSE,'count':len(risk),'sourceRecordCount':len(risk_raw),'excludedInvalid':risk_dropped,
    'kelasDomain':['Ringan','Sedang','Berat'],'crs':'EPSG:4326','precisionDecimals':6,
    'note':'Official flood-risk reference classes (Kelas) per polygon; observation date not published by the service.',
    'features':[{'type':'Feature','properties':{'kelas':r['kelas'],'kelurahan':r['kelurahan'],'kecamatan':r['kecamatan'],
        'kota':r['kota'],'kelurahanCode':r['kelurahanCode']},'geometry':r['geometry']} for r in risk]})
save('population.json',{'publisher':'Pemprov DKI Jakarta (Dukcapil-based) · Jakarta Satu','source':f'{BASE}/Kependudukan_Tahun_2023_Semester_2/MapServer',
    'sourceUrl':f'{BASE}/Kependudukan_Tahun_2023_Semester_2/MapServer?f=pjson','retrievedAt':NOW,'observedAt':'2023 semester 2 (official reference period)',
    'tier':'official-census-reference','license':LICENSE,'period':'Semester 2 2023','units':{'wni':'WNI residents','households':'family cards (KK)','areaKm2':'km²'},
    'note':'WNI residents only; density is WNI per km². Codes are PUM administrative codes (KDEPUM).',
    'kota':pop_kt,'kecamatan':pop_kc,'kelurahan':pop_kd})
save('flood-network.json',{'publisher':PUBLISHER,'retrievedAt':NOW,'tier':'public-reference','license':LICENSE,
    'sourceUrls':{'awlr':awlr_src,'arr':arr_src,'infrastructure':f'{BASE}/Peta_Kerja_BPAD/MapServer','situ':f'{BASE}/PETA_SITU/MapServer/0',
        'risk':f'{BASE}/Resiko_Bencana/MapServer/3','population':f'{BASE}/Kependudukan_Tahun_2023_Semester_2/MapServer'},
    'counts':{'awlrTotal':len(awlr_raw),'awlrInRegion':len(region_only(awlr)),'arrTotal':len(arr_raw),'arrInRegion':len(region_only(arr)),
              'pumps':sum(1 for i in infra if i['kind']=='Pompa'),'gates':sum(1 for i in infra if i['kind']=='Pintu Air'),
              'reservoirs':sum(1 for i in infra if i['kind']=='Waduk & Embung'),'situ':len(situ),'riskPolygons':len(risk)},
    'stations':[{**r,'inRegion':in_box(r['coordinates'],DKI)} for r in awlr+arr],
    'situ':[{k:s[k] for k in ('name','kelurahan','kecamatan','kota','areaHa','condition')} for s in situ],
    'riskSummary':risk_summary,'populationJoin':{'riskKelurahan':len(risk_by_code),'joined':joined},
    'accessStates':{
      'pantauBanjir':{'checkedAt':NOW,'state':'unreachable','sourceUrl':'https://pantaubanjir.jakarta.go.id',
        'reasonId':'Portal tidak merespons pada pemeriksaan 11 Oktober 2026 (HTTP dan HTTPS, batas 45 detik). Pembacaan tinggi air langsung tidak diimpor; bukan petunjuk tidak ada banjir.',
        'reasonEn':'Portal did not respond on 11 October 2026 (HTTP and HTTPS, 45 s limit). Live water-level readings are not imported; this is not a no-flood reading.'},
      'petaBencanaGauges':{'checkedAt':NOW,'state':'empty','sourceUrl':'https://data.petabencana.id/floodgauges?admin=ID-JK',
        'reasonId':'Endpoint gauge PetaBencana mengembalikan topologi kosong pada pemeriksaan; tidak ada data pamantauan.',
        'reasonEn':'The PetaBencana floodgauges endpoint returned an empty topology when checked; no gauge observations.'},
      'tide':{'checkedAt':NOW,'state':'link-only','sourceUrl':'https://srgi.big.go.id/tides/panj',
        'reasonId':'Halaman pasut resmi BIG untuk stasiun Indonesia; umpan mesin belum terverifikasi, hanya tautan.',
        'reasonEn':'Official BIG tide page for Indonesian stations; no machine feed verified, link only.'}},
    'note':'Monitoring network is a dated reference of stations and official alert thresholds, never presented as live readings.'})
print(f'AWLR {len(awlr)}/{len(awlr_raw)} in region · ARR {len(arr)}/{len(arr_raw)} · infra {len(region_only(infra))}/{len(pumps_raw)+len(gates_raw)+len(waduk_raw)} · situ {len(situ)}/{len(situ_raw)} · risk {len(risk)}/{len(risk_raw)} · pop {len(pop_kd)}/{len(pop_kc)}/{len(pop_kt)} · riskSummary {len(risk_summary)} kelurahan, joined {joined}')
print('sizes:',{p.name:round(p.stat().st_size/1048576,2) for p in sorted(OUT.glob('*.geojson'))+sorted(OUT.glob('flood-network.json'))+sorted(OUT.glob('population.json')) if p.name in {'awlr.geojson','arr.geojson','pumps.geojson','situ.geojson','risk.geojson','flood-network.json','population.json'}})
