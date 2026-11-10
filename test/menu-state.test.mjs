import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchCars,parseMenuPreferences} from '../public/driving/menu-state.js';
import {CARS,carsInCollection} from '../public/driving/catalog.js';

test('garage search accepts case, whitespace, full-width input and multiple terms',()=>{
 assert.equal(searchCars(CARS,'  bMw   m4 ')[0]?.id,'M4');
 assert.equal(searchCars(CARS,'ＭＣＬ３９')[0]?.id,'MCL39');
 assert.ok(searchCars(CARS,'方程式').length>=3);
 assert.deepEqual(searchCars(CARS,'missing-car'),[]);
 assert.equal(searchCars(CARS,'   ').length,14);
 assert.equal(searchCars(carsInCollection('classic'),'MCL39').length,0);
});

test('menu preferences reject stale cars, circuits and malformed storage',()=>{
 const cars=CARS.map(c=>c.id),destinations=['city','monza'];
 for(const raw of ['{','null','false','42'])assert.deepEqual(parseMenuPreferences(raw,cars,destinations),{});
 assert.deepEqual(parseMenuPreferences('{"car":"gone","destination":"missing","compactHud":"false"}',cars,destinations),{car:undefined,destination:undefined,compactHud:false});
 assert.deepEqual(parseMenuPreferences('{"car":"MCL39","destination":"monza","compactHud":true}',cars,destinations),{car:'MCL39',destination:'monza',compactHud:true});
});
