#!/usr/bin/env python3
"""Prepare selected public aggregates and bibliographic records from saved evidence."""
import json,collections,datetime,hashlib
from pathlib import Path
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parent.parent;RAW=ROOT/'data/source-evidence/official-2026-10-11';OUT=ROOT/'public/data/jakarta-v1'
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat()
def retrieved(name):return datetime.datetime.fromtimestamp((RAW/name).stat().st_mtime,datetime.timezone.utc).isoformat()
def save(name,d):(OUT/name).write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n')
raw=(RAW/'flood-prone.json').read_bytes();d=json.loads(raw.decode('utf-8-sig'));rows=d['data']
assert len(rows)==d['total_file'] and d['message']=='success'
counts=collections.Counter((r['periode_data'],r['wilayah'],r['kecamatan'],r['kelurahan']) for r in rows)
source='https://satudata.jakarta.go.id/open-data/detail?kategori=dataset&page_url=data-titik-rawan-bencanabanjir&data_no=1'
save('flood-reference.json',{'publisher':'Satuan Polisi Pamong Praja · Satu Data Jakarta','sourceUrl':source,'apiUrl':'https://ws.jakarta.go.id/gateway/DataPortalSatuDataJakarta/1.0/satudata?kategori=dataset&tipe=detail&url=data-titik-rawan-bencanabanjir','tier':'annual-reference','retrievedAt':retrieved('flood-prone.json'),'preparedAt':NOW,'metadataUpdatedAt':'2026-06-05','fileUpdatedAt':'2026-04-07','periods':sorted(set(r['periode_data'] for r in rows)),'count':len(rows),'sha256':hashlib.sha256(raw).hexdigest(),'license':'Terbuka; attribution; dataset-specific reuse license not stated','coordinateStatus':'withheld-undeclared-scale','rows':[{'year':y,'kota':k,'kecamatan':c,'kelurahan':l,'records':n} for (y,k,c,l),n in sorted(counts.items())]})
s=BeautifulSoup((RAW/'smartcity.html').read_text(),'html.parser');docs=[]
for tr in s.select('tr'):
 cells=tr.select('td');a=tr.find('a',href=True)
 if len(cells)>=3 and a and 'drive.google.com' in a['href']:
  docs.append({'year':cells[0].get_text(' ',strip=True),'title':cells[1].get_text(' ',strip=True),'url':a['href'],'tier':'planning-document'})
assert len(docs)==5
annual='https://smartcity.jakarta.go.id/docs/Laporan-Tahunan-Jakarta-Smart-City-2023.pdf'
docs.append({'year':'2023','title':'Annual Report Jakarta Smart City 2023','url':annual,'tier':'annual-report','pages':48,'sha256':hashlib.sha256((RAW/'annual-2023.pdf').read_bytes()).hexdigest()})
save('city-context.json',{'retrievedAt':retrieved('smartcity.html'),'preparedAt':NOW,'documentsSource':'https://smartcity.jakarta.go.id/en/dokumen/','documents':docs,'facts':[{'id':'flood-network','value':178,'unitId':'titik pemantauan','unitEn':'monitoring points','labelId':'Jaringan Pantau Banjir dalam laporan 2023','labelEn':'Pantau Banjir network in the 2023 report','period':'2023','page':9,'sourceUrl':annual+'#page=9','tier':'annual-report'},{'id':'jaki-services','value':60,'qualifier':'>','unitId':'layanan digital','unitEn':'digital services','labelId':'Integrasi JAKI dalam laporan 2023','labelEn':'JAKI integration in the 2023 report','period':'2023','page':10,'sourceUrl':annual+'#page=10','tier':'annual-report'}],'vision':{'targetRank':20,'targetYear':2045,'tier':'planning-target','sourceUrl':'https://bappeda.jakarta.go.id/kota-global','documentUrl':'https://bappeda.jakarta.go.id/kota-global/188','instrument':'Kepgub 294 Tahun 2025','summaryId':'Sasaran 20 besar kota global pada 2045; arah pembangunan menuju beberapa pusat ekonomi. Sasaran kebijakan, bukan peringkat yang telah dicapai.','summaryEn':'Target: top 20 global cities by 2045; development toward multiple economic hubs. A policy target, not an achieved ranking.'},'floodAccess':{'sourceUrl':'https://pantaubanjir.jakarta.go.id','checkedAt':'2026-10-11T08:57:00Z','state':'unavailable','reasonId':'Portal tidak merespons saat diperiksa. Tinggi muka air dan operasi pompa terkini belum diimpor.','reasonEn':'Portal did not respond when checked. Current water levels and pump operations have not been imported.'}})
print('flood',len(rows),'records',len(counts),'kelurahan-period rows; documents',len(docs))
