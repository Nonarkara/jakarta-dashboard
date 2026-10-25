#!/usr/bin/env python3
import importlib.util
from pathlib import Path
from shapely.geometry import Polygon,MultiPolygon,Point
spec=importlib.util.spec_from_file_location('prep',Path(__file__).with_name('prepare-polder-facilities.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
outer=Polygon([(0,0),(6,0),(6,6),(0,6)],holes=[[(2,2),(4,2),(4,4),(2,4)]])
parts=MultiPolygon([Polygon([(8,0),(9,0),(9,1),(8,1)]),Polygon([(10,0),(11,0),(11,1),(10,1)])])
assert m.memberships(Point(1,1),[(1,outer)])==[1]
assert m.memberships(Point(3,3),[(1,outer)])==[]
assert m.memberships(Point(0,1),[(1,outer)])==[1]
assert m.memberships(Point(2,3),[(1,outer)])==[1], 'hole edge is polygon boundary, included by covers'
assert m.memberships(Point(10.5,.5),[(2,parts)])==[2]
assert m.memberships(Point(7,7),[(1,outer),(2,parts)])==[]
assert m.memberships(Point(1,1),[(1,outer),(3,Polygon([(0,0),(2,0),(2,2),(0,2)]))])==[1,3]
print('PASS original-geometry join fixtures: holes, outer/hole edges, multipart, overlap and outside')
