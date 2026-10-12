#!/usr/bin/env python3
"""Bake Satu Data Jakarta's official ISPU (Indeks Standar Pencemar Udara)
CSV export into a dated monthly reference per SPKU station.

Anonymous publisher export only (satudata.jakarta.go.id backend, link taken
from the data.go.id resource listing). Station spelling variants normalize
to the publisher's DKI1–DKI5 codes; no rows are invented; no-data days are
counted, never interpolated. The latest publisher batch is labelled with its
own period — this is a dated reference, never a live feed.
"""
import csv,json,datetime,hashlib,re
from pathlib import Path
from urllib.request import urlopen,Request

ROOT=Path(__file__).resolve().parent.parent
RAW=ROOT/'data/source-evidence/ispu-2026-10-12'
OUT=ROOT/'public/data/jakarta-v1'
RAW.mkdir(parents=True,exist_ok=True)
NOW=datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
UA='JakartaDashboard/1.0 (jakarta.nonarkara.org)'
DATASET_ID='4a01bb54c2ab6ed3270b9e2b0950d584'
SLUG='data-indeks-standar-pencemar-udara-ispu-di-provinsi-dki-jakarta'
EXPORT=f'https://satudata.jakarta.go.id/backend/restapi/v1/datasets/export/{DATASET_ID}/{SLUG}.csv'
PAGE=f'https://satudata.jakarta.go.id/open-data/detail/{SLUG}'
STATIONS={'DKI1':'Bundaran Hotel Indonesia (HI)','DKI2':'Kelapa Gading','DKI3':'Jagakarsa','DKI4':'Lubang Buaya','DKI5':'Kebon Jeruk'}
CATEGORIES=['BAIK','SEDANG','TIDAK SEHAT','SANGAT TIDAK SEHAT','BERBAHAYA']
BOUNDS={'BAIK':[1,50],'SEDANG':[51,100],'TIDAK SEHAT':[101,200],'SANGAT TIDAK SEHAT':[201,300],'BERBAHAYA':[301,500]}

req=Request(EXPORT,headers={'User-Agent':UA})
with urlopen(req,timeout=90) as r: body=r.read()
(RAW/'ispu-export.csv').write_bytes(body)
sha=hashlib.sha256(body).hexdigest()

def num(v):
    try:
        f=float(v)
        return f if f==f else None
    except (TypeError,ValueError):
        return None

rows=[]
skipped=0
for r in csv.DictReader(body.decode('utf-8-sig').splitlines()):
    r={(k or '').lstrip('﻿'):v for k,v in r.items()}
    m=re.match(r'^(DKI[1-5])\b',str(r.get('stasiun') or ''))
    try:
        date=f"{r['periode_data'][:4]}-{int(r['bulan']):02d}-{int(r['tanggal']):02d}"
    except (KeyError,ValueError,TypeError):
        skipped+=1; continue
    if not m or len(date)!=10:
        skipped+=1; continue
    rows.append({'code':m.group(1),'date':date,'period':str(r.get('periode_data') or '')[:6],
        'maxIspu':num(r.get('max')),'kategori':str(r.get('kategori') or '').strip(),
        'critical':str(r.get('parameter_pencemar_kritis') or '').strip()})
assert len(rows)>3000, f'too few rows: {len(rows)}'
assert skipped<=40, f'too many skipped rows: {skipped}'

stations=[]
for code,name in STATIONS.items():
    mine=[r for r in rows if r['code']==code]
    mine.sort(key=lambda r:r['date'])
    measured=[r for r in mine if r['maxIspu'] is not None]
    assert measured, f'no measured rows for {code}'
    latest_period=measured[-1]['period']
    latest=[r for r in measured if r['period']==latest_period]
    worst=max(latest,key=lambda r:r['maxIspu'])
    stations.append({'code':code,'name':name,
        'coverage':{'start':mine[0]['date'],'end':mine[-1]['date'],
            'periods':sorted({r['period'] for r in mine}),
            'daysReported':len(measured),'daysNoData':len(mine)-len(measured)},
        'latest':{'period':f"{latest_period[:4]}-{latest_period[4:]}",
            'meanDailyMax':round(sum(r['maxIspu'] for r in latest)/len(latest),1),
            'worstDay':{'date':worst['date'],'ispu':worst['maxIspu'],'kategori':worst['kategori'] or None,
                'criticalPollutant':worst['critical'] if worst['critical'] not in ('','N/A') else None},
            'daysReported':len(latest),
            'daysNoData':len([r for r in mine if r['period']==latest_period and r['maxIspu'] is None])}})

obs_start=min(s['coverage']['start'] for s in stations)
obs_end=max(s['coverage']['end'] for s in stations)
latest_periods=sorted({s['latest']['period'] for s in stations})
assert len(latest_periods)==1, f'stations disagree on latest period: {latest_periods}'
OUT.mkdir(parents=True,exist_ok=True)
payload={'publisher':'Dinas Lingkungan Hidup DKI Jakarta · Satu Data Jakarta','sourceUrl':PAGE,'exportUrl':EXPORT,
    'retrievedAt':NOW,'observedAt':{'start':obs_start,'end':obs_end,'latestPeriod':latest_periods[0]},
    'tier':'official-monitoring-reference',
    'license':'Publisher attribution; explicit dataset license not stated in inspected metadata',
    'sha256':sha,'rowsImported':len(rows),'rowsSkipped':skipped,
    'units':{'ispu':'ISPU index (unitless, Permen LHK 14/2020)'},
    'categories':[{'name':c,'range':BOUNDS[c]} for c in CATEGORIES],
    'stations':stations,
    'note':'Daily SPKU measurements republished by the publisher in monthly batches; the latest batch is dated, not live. No values are interpolated for no-data days.'}
(OUT/'ispu-reference.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
print(f"rows {len(rows)} skipped {skipped} · coverage {obs_start}→{obs_end} · latest {latest_periods[0]}")
for s in stations: print(f"  {s['code']} {s['name']}: mean {s['latest']['meanDailyMax']} · worst {s['latest']['worstDay']['ispu']} ({s['latest']['worstDay']['date']})")
print('sizes:',{'ispu-reference.json':round((OUT/'ispu-reference.json').stat().st_size/1024,1),'raw csv':round((RAW/'ispu-export.csv').stat().st_size/1024,1)})
