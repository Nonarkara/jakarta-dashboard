#!/usr/bin/env python3
"""Reproduce the BPBD dated table from its recorded public-page transcription."""
import csv, hashlib, json
from datetime import datetime
from pathlib import Path
root = Path(__file__).resolve().parent.parent
folder = root / 'data/source-evidence/bpbd-2026-10-12'
raw = (folder / 'public-tma-table.tsv').read_bytes()
receipt = json.loads((folder / 'receipt.json').read_text())
assert hashlib.sha256(raw).hexdigest() == receipt['rawSha256']
rows = list(csv.reader(raw.decode().splitlines(), delimiter='\t'))
times = rows[0][1:]
assert len(times) == 7 and len(rows) == 13
assert all((datetime.fromisoformat(a)-datetime.fromisoformat(b)).total_seconds()==3600 for a,b in zip(times,times[1:]))
stations = []
for row in rows[1:]:
    assert len(row)==8 and row[0]
    values = [int(v) for v in row[1:]]
    assert all(-1000<=v<=3000 for v in values)
    stations.append({'name':row[0], 'latestCm':values[0], 'changeCmPerHour':values[0]-values[1], 'series':[{'observedAt':t,'levelCm':v} for t,v in zip(times,values)]})
assert len({s['name'] for s in stations}) == 12
result = {'source':receipt['publisher'], 'sourceUrl':receipt['sourceUrl'], 'tier':'dated-publisher-observation', 'observedAt':times[0], 'checkedAt':receipt['checkedAt'], 'rawSha256':receipt['rawSha256'], 'access':receipt['method'], 'units':{'level':'cm at local gauge datum','change':'cm/h, level change not flow velocity'}, 'stations':stations}
(root/'public/data/jakarta-v1/bpbd-water-reference.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
