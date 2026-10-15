#!/usr/bin/env python3
"""Bounded anonymous WorldCover 2021 crop. --fetch refreshes; default rebakes raw crop.
Requires rasterio, numpy, Pillow, requests. No Earth Engine account or whole tile download.
"""
import argparse, hashlib, json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/source-evidence/terrain-satellite-2026-10-15'
OUT = ROOT / 'public/data/jakarta-v1'
URL = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_S09E105_Map.tif'
BBOX = [106.65, -6.40, 107.00, -6.08]
CLASSES = [
 (10,'Tree cover','Tutupan pohon','#006400'),(20,'Shrubland','Semak','#ffbb22'),
 (30,'Grassland','Padang rumput','#ffff4c'),(40,'Cropland','Lahan pertanian','#f096ff'),
 (50,'Built-up','Area terbangun','#fa0000'),(60,'Bare / sparse vegetation','Tanah terbuka / vegetasi jarang','#b4b4b4'),
 (70,'Snow and ice','Salju dan es','#f0f0f0'),(80,'Permanent water bodies','Perairan permanen','#0064c8'),
 (90,'Herbaceous wetland','Lahan basah herba','#0096a0'),(95,'Mangroves','Mangrove','#00cf75'),
 (100,'Moss and lichen','Lumut dan liken','#fae6a0')]

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def dump(path,obj): path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')

def main():
 p=argparse.ArgumentParser(description=__doc__); p.add_argument('--fetch',action='store_true'); args=p.parse_args()
 RAW.mkdir(parents=True,exist_ok=True); OUT.mkdir(parents=True,exist_ok=True)
 crop=RAW/'worldcover-2021-jakarta-native.tif'; receipt=RAW/'acquisition.json'
 if args.fetch:
  import requests
  response=requests.get(URL,headers={'Range':'bytes=0-16383'},timeout=30)
  response.raise_for_status()
  if response.status_code != 206 or len(response.content) != 16384:
   raise ValueError('COG source must accept bounded Range request')
  (RAW/'source-header-0-16383.bin').write_bytes(response.content)
  with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif',GDAL_HTTP_TIMEOUT='30',GDAL_HTTP_MAX_RETRY='1'):
   with rasterio.open(URL) as src:
    if src.crs.to_epsg()!=4326 or src.count!=1 or src.nodata!=0: raise ValueError('Unexpected WorldCover schema')
    window=from_bounds(*BBOX,src.transform).round_offsets().round_lengths()
    if window.width*window.height > 17000000: raise ValueError('Crop exceeds 17 million native cells')
    data=src.read(1,window=window)
    profile=src.profile.copy(); profile.update(width=data.shape[1],height=data.shape[0],transform=src.window_transform(window))
    with rasterio.open(crop,'w',**profile) as dst: dst.write(data,1); dst.update_tags(**src.tags())
    dump(receipt,{'retrievedAt':datetime.now(timezone.utc).isoformat(),'sourceUrl':URL,'rangeProbe':{'status':response.status_code,'bytes':len(response.content),'contentRange':response.headers.get('Content-Range'),'etag':response.headers.get('ETag')},'sourceWidth':src.width,'sourceHeight':src.height,'sourceBounds':list(src.bounds),'sourceTags':src.tags(),'requestedBounds':BBOX,'cropSha256':sha(crop)})
 if not crop.exists() or not receipt.exists(): raise SystemExit('Raw crop absent: run --fetch explicitly')
 acquisition=json.loads(receipt.read_text())
 if sha(crop)!=acquisition['cropSha256']: raise ValueError('Raw crop hash mismatch')
 with rasterio.open(crop) as src:
  data=src.read(1); bounds=list(src.bounds); tags=src.tags(); transform=list(src.transform)[:6]
 values,counts=np.unique(data,return_counts=True); histogram={int(k):int(v) for k,v in zip(values,counts)}
 if set(histogram)-{0,*[c[0] for c in CLASSES]}: raise ValueError('Unrecognized class')
 # A 2:1 nearest-neighbour display stays below 4096-pixel texture size on phones.
 display=np.asarray(Image.fromarray(data).resize((data.shape[1]//2,data.shape[0]//2),Image.Resampling.NEAREST))
 rgba=np.zeros((*display.shape,4),dtype=np.uint8)
 for code,en,id_,color in CLASSES:
  rgb=tuple(bytes.fromhex(color[1:])); rgba[display==code]=(*rgb,255)
 png=OUT/'worldcover-2021-reference.png'; Image.fromarray(rgba).save(png,optimize=True)
 legend=[{'value':code,'nameEn':en,'nameId':id_,'color':color,'cells':histogram.get(code,0)} for code,en,id_,color in CLASSES]
 manifest={'schema':1,'id':'esa-worldcover-2021-jakarta','name':'ESA WorldCover 2021 v200','tier':'satellite-classification-reference','sourceUrl':URL,'sourceTile':'S09E105','sourceCrs':'EPSG:4326','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','doi':'https://doi.org/10.5281/zenodo.7254221','attribution':'© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium','periodStart':tags['time_start'],'periodEnd':tags['time_end'],'retrievedAt':acquisition['retrievedAt'],'requestedBounds':BBOX,'bounds':bounds,'imageCoordinates':[[bounds[0],bounds[3]],[bounds[2],bounds[3]],[bounds[2],bounds[1]],[bounds[0],bounds[1]]],'scope':'Rectangular mainland Jakarta reference window; not administrative DKI totals; offshore islands excluded.','nativeResolutionMetres':10,'nativePixelDegrees':abs(transform[0]),'nativeWidth':data.shape[1],'nativeHeight':data.shape[0],'nativeCells':int(data.size),'nodataValue':0,'nodataCells':histogram.get(0,0),'validCells':int(data.size)-histogram.get(0,0),'classes':legend,'display':{'path':'/data/jakarta-v1/worldcover-2021-reference.png','width':display.shape[1],'height':display.shape[0],'resampling':'nearest-neighbour 2:1 categorical display only','nominalResolutionMetres':20,'sha256':sha(png),'bytes':png.stat().st_size},'rawCrop':{'evidencePath':str(crop.relative_to(ROOT)),'sha256':sha(crop),'bytes':crop.stat().st_size},'limitationsEn':'Historical 2021 land-cover classification, not current flood extent, ground elevation, measured impermeability or hydraulic capacity. Counts are native cells within a rectangular window, not area estimates or DKI administrative totals. Water class is permanent water, not a dated flood observation. Display uses nearest-neighbour resampling; source classifications can be wrong.','limitationsId':'Klasifikasi tutupan lahan historis 2021, bukan genangan terkini, elevasi tanah, kedap air terukur, atau kapasitas hidraulik. Jumlah sel asli berasal dari jendela persegi panjang, bukan luas atau total administratif DKI. Kelas air menunjukkan perairan permanen, bukan pengamatan banjir bertanggal. Tampilan memakai resampling tetangga terdekat; klasifikasi sumber dapat keliru.'}
 dump(OUT/'worldcover-2021-reference.json',manifest)
 print(json.dumps({'nativeCells':manifest['nativeCells'],'nodataCells':manifest['nodataCells'],'imageBytes':png.stat().st_size,'cropBytes':crop.stat().st_size,'imageSha256':sha(png)}))
if __name__=='__main__': main()
