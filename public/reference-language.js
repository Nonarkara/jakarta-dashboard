// Reviewed presentation vocabulary. Source payloads, identities and coordinates stay unchanged.
(function(){
 'use strict';
 const terms={
 'Jakarta Sewerage System':'Sistem air limbah Jakarta','Intermediate Treatment Facility':'Fasilitas pengolahan antara',
 'Year 0 (Immediate): Quick-win activation of the apartment development site':'Tahun 0 (segera): aktivasi awal lokasi pengembangan apartemen',
 'Upon completion of FS':'Setelah studi kelayakan selesai','Open for Discussion':'Terbuka untuk pembahasan',
 'JAKI Development Plan 2026-2029':'Arah pengembangan JAKI 2026–2029',
 'Masterplan Book 1: An Overview of Jakarta City Towards a Smart City Global City':'Buku 1: Potret Jakarta menuju kota cerdas berskala global',
 'Masterplan Book 2: Jakarta Development Plan as a Global Smart City 2025-2029':'Buku 2: Rencana pembangunan Jakarta sebagai kota cerdas berskala global 2025–2029',
 'Masterplan Book 3: Executive Summary':'Buku 3: Ringkasan eksekutif',
 'Masterplan Book 4: The Fast Win Initiative Towards Jakarta a Global Smart City by 2025–2029':'Buku 4: Program prioritas Jakarta sebagai kota cerdas berskala global 2025–2029',
 'Annual Report Jakarta Smart City 2023':'Laporan tahunan Jakarta Smart City 2023',
 'WWTP, including pumping station':'Instalasi pengolahan air limbah, termasuk stasiun pompa','Wastewater Treatment Technology':'Teknologi pengolahan air limbah',
 'Completely Mixed Activated Sludge (CMAS)':'Lumpur aktif tercampur sempurna (CMAS)','Pipe Installation Method':'Metode pemasangan pipa',
 'Pipe Jacking and Mechanical Boring':'Pendorongan pipa dan pengeboran mekanis','Waste Processing Capacity':'Kapasitas pengolahan sampah',
 'Station Advertisement Assets':'Ruang iklan stasiun','Train Advertisement Assets':'Ruang iklan kereta','Naming Rights':'Hak penamaan',
 'Grade A Office NLA':'Luas sewa kantor kelas A (NLA)','Office Park (2 clusters) NLA':'Luas sewa kawasan perkantoran (2 klaster; NLA)',
 'Low-Rise Residential NLA':'Luas sewa hunian bertingkat rendah (NLA)','Plaza & Landscape NLA':'Luas plaza dan lanskap (NLA)',
 'MICE & Museum NLA':'Luas sewa MICE dan museum (NLA)','MICE NLA':'Luas sewa MICE (NLA)','F&B NLA':'Luas sewa kuliner (NLA)',
 'Sudirman Station NLA':'Luas sewa Stasiun Sudirman (NLA)','BNI City Station NLA':'Luas sewa Stasiun BNI City (NLA)',
 'Apartment NLA':'Luas sewa apartemen (NLA)','Apartment GFA':'Luas lantai apartemen (GFA)','Hotel NLA':'Luas sewa hotel (NLA)',
 'Mall NLA':'Luas sewa pusat belanja (NLA)','Mall GFA':'Luas lantai pusat belanja (GFA)','Retail NLA':'Luas sewa ritel (NLA)',
 'Development Area':'Luas pengembangan','Warehouse Area':'Luas gudang','Gross Site Area':'Luas tapak bruto','Saleable Area':'Luas yang dapat dijual',
 'Total Pipe Length':'Panjang pipa keseluruhan','Pipe Diameter':'Diameter pipa','Trunk sewer':'Saluran induk air limbah',
 'WWTP Capacity':'Kapasitas pengolahan air limbah','WWTP Location':'Lokasi pengolahan air limbah','Registered GFA':'Luas lantai terdaftar (GFA)',
 'Service Coverage':'Cakupan layanan','Total NLA':'Luas sewa bersih (NLA)','Total GFA':'Luas lantai bruto (GFA)','Route Length':'Panjang rute',
 'retail space per station':'ruang ritel per stasiun','Unit Based':'Unit komersial','units/station':'unit/stasiun','sqm/station':'m²/stasiun',
 'South Sunter Lake':'Danau Sunter Selatan','Sunter Sports Center':'Gelanggang Olahraga Sunter','Phase 2A':'Tahap 2A','Up to':'Hingga','Approximately':'Sekitar',
 'million liters/day':'juta liter/hari','per day':'per hari','tpd':'ton/hari',
 'Central Jakarta':'Jakarta Pusat','North Jakarta':'Jakarta Utara','South Jakarta':'Jakarta Selatan','East Jakarta':'Jakarta Timur','West Jakarta':'Jakarta Barat',
 'Coordinates':'Koordinat','Industrial Estate':'Kawasan Industri','Industrial Area':'Kawasan Industri',
 'West Ancol':'Ancol Barat','East Extension of Phase I / 20 Ha zone':'Perluasan timur tahap I / kawasan 20 ha',
 'Sudirman Commuter Line Station and BNI City Airport Train Station':'Stasiun KRL Sudirman dan Stasiun Kereta Bandara BNI City',
 'within':'di dalam','across':'di','spanning':'mencakup','subdistricts':'kelurahan','districts':'kecamatan','District':'Kecamatan',
 'street':'jalan','Street':'Jalan','Boulevard':'Bulevar','and':'dan'
 };
 const types={ 'Hutan Kota':'Urban forest','Lapangan Olahraga':'Sports field','Pemakaman':'Cemetery','Taman Interaktif':'Interactive park','Taman Kota':'City park','Taman Lingkungan':'Neighborhood park','Taman Rekreasi':'Recreation park','Belum Diketahui':'Unspecified','RTH':'Green space','Jalur Hijau':'Green strip','Hutan Produksi':'Production forest','Hutan Lindung':'Protected forest','Kebun Bibit':'Plant nursery','FASILITAS KESEHATAN':'Health facility','SEKOLAH / BANGUNAN PENDIDIKAN':'School / education building','Rumah Sakit':'Hospital','Puskesmas':'Community health centre','Klinik':'Clinic','Negeri':'Public','Swasta':'Private'};
 const alerts={Moderate:['Sedang','Moderate'],Severe:['Berat','Severe'],Extreme:['Ekstrem','Extreme'],Minor:['Ringan','Minor'],Immediate:['Segera','Immediate'],Expected:['Diperkirakan','Expected'],Future:['Mendatang','Future'],Observed:['Teramati','Observed'],Likely:['Kemungkinan besar','Likely'],Possible:['Mungkin','Possible'],Unlikely:['Kemungkinan kecil','Unlikely'],Unknown:['Tidak diketahui','Unknown']};
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const pattern=new RegExp('(?<![\\p{L}\\p{N}])(?:'+Object.keys(terms).sort((a,b)=>b.length-a.length).map(escape).join('|')+')(?![\\p{L}\\p{N}])','gu');
 function text(value,language){const s=String(value??'');if(language!=='id')return ({'Upon completion of FS':'After the feasibility study is complete','Open for Discussion':'Open for discussion'}[s]||s).replace(/\bm 2\b/g,'m²');return (terms[s]||s.replace(pattern,m=>terms[m])).replace(/\bm 2\b/g,'m²').replace(/(?<![\p{L}\p{N}])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+)(?![\p{L}\p{N}])/gu,m=>{const n=Number(m.replaceAll(',',''));const digits=(m.split('.')[1]||'').length;return Number.isFinite(n)?n.toLocaleString('id-ID',{minimumFractionDigits:Math.min(digits,10),maximumFractionDigits:Math.min(digits,10)}):m;});}
 function cost(value,language){const s=String(value??'');const m=s.match(/^IDR\s+([\d,.]+)\s+(Billion|Trillion)$/i);if(!m)return text(s,language);const n=Number(m[1].replaceAll(',',''));if(!Number.isFinite(n))return s;return (language==='id'?'Rp ':'IDR ')+n.toLocaleString(language==='id'?'id-ID':'en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+(language==='id'?(m[2].toLowerCase()==='billion'?'miliar':'triliun'):m[2].toLowerCase());}
 function kind(value,language){return language==='en'?(types[value]||value):({'FASILITAS KESEHATAN':'Fasilitas kesehatan','SEKOLAH / BANGUNAN PENDIDIKAN':'Sekolah / gedung pendidikan'}[value]||value);}
 function alert(value,language){return alerts[value]?.[language==='id'?0:1]||value;}
 function admin(value,language){if(language!=='en')return value;const names={'Jakarta Pusat':'Central Jakarta','Jakarta Utara':'North Jakarta','Jakarta Barat':'West Jakarta','Jakarta Selatan':'South Jakarta','Jakarta Timur':'East Jakarta'};return String(value??'').replace('Kota Adm. ','').replace(/Jakarta (Pusat|Utara|Barat|Selatan|Timur)/g,m=>names[m]);}
 const statusPairs={'referensi ruang hijau':'green-space reference','usulan · titik lokasi penerbit':'proposal · publisher location point','titik referensi':'reference point','jalur terjadwal':'scheduled alignment','Lapisan pilihan dihapus.':'Selected overlay cleared.','Okt':'Oct','Agu':'Aug','Des':'Dec','Mei':'May'};
 function status(value,language){let s=String(value??'');for(const [id,en]of Object.entries(statusPairs))s=s.replace(new RegExp('(?<![\\p{L}\\p{N}])'+escape(language==='id'?en:id)+'(?![\\p{L}\\p{N}])','gu'),language==='id'?id:en);return s;}
 window.CivicLanguage={text,cost,kind,alert,admin,status};
})();
