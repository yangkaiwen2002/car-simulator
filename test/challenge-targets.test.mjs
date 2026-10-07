import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS} from '../public/driving/circuit-data.js';
import {targetsFor,resolveTarget,assessLap,earnedTargets,BENCHMARKS} from '../public/driving/challenge-targets.js';
test('every circuit has progressive game goals and sourced historical driver benchmarks',()=>{
 for(const track of CIRCUITS){const list=targetsFor(track.id);assert.ok(list.length>=5);assert.equal(new Set(list.map(x=>x.id)).size,list.length);const game=list.filter(x=>x.kind==='game');assert.ok(game[0].time>game[1].time&&game[1].time>game[2].time);for(const b of BENCHMARKS[track.id]){assert.ok(b.time>0);assert.match(b.source,/^https:\/\/(www.formula1.com|www.fia.com|newsroom.porsche.com)\//);assert.match(b.session,/\d{4}/);}}
 assert.equal(CIRCUITS.find(x=>x.id==='redbullring').halfWidth,8);assert.equal(resolveTarget('redbullring','missing').id,'bronze');assert.equal(resolveTarget('city'),null);
});
test('only valid complete laps achieve a target; equal time counts and slower laps report exact deficit',()=>{
 const target=resolveTarget('monza','ver-2025');assert.equal(assessLap({valid:false,time:20},target).achieved,false);assert.equal(assessLap({valid:true,time:NaN},target).achieved,false);assert.equal(assessLap({valid:true,time:target.time},target).achieved,true);assert.equal(assessLap({valid:true,time:target.time+2},target).delta,2);assert.equal(assessLap(null,target).delta,null);assert.equal(earnedTargets('monza',0).length,0);assert.equal(earnedTargets('monza',140).length,1);
});
test('benchmarks distinguish historical sessions from non-F1 Nordschleife records',()=>{
 assert.equal(resolveTarget('redbullring','ver-2020').time,63.477);assert.equal(resolveTarget('silverstone','ham-2020').time,84.303);assert.ok(BENCHMARKS.nordschleife.every(x=>!x.name.includes('维斯塔潘')));assert.match(BENCHMARKS.nordschleife[0].session,/历史布局/);
});
