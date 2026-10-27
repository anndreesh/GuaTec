import test from 'node:test';
import assert from 'node:assert/strict';
import {BONUS_CHECKPOINTS,CHECKPOINTS} from '@/apollo/ApolloState';
import {SITE_PLOTS,SITE_ROADS,SITE_WALKWAYS,SITE_ZONES,pointOnRoad,zoneBounds} from '@/apollo/ApolloSiteLayout';
import {standCollisionProxies} from '@/apollo/ApolloStandModels';

test('all thirteen physical stations share connected work yards and stay clear of traffic',()=>{
  assert.equal(SITE_PLOTS.length,13);
  const members=SITE_ZONES.flatMap(zone=>zone.members);
  assert.equal(new Set(members).size,13);assert.equal(members.length,13);
  for(const plot of SITE_PLOTS){
    assert.ok(members.includes(plot.id));
    assert.equal(pointOnRoad(plot.target,3),false,plot.id+' needs a working apron outside traffic');
  }
  for(const zone of SITE_ZONES){
    const area=zoneBounds(zone.members);assert.ok([area.x,area.z,area.width,area.depth].every(Number.isFinite));
    for(const plot of SITE_PLOTS.filter(p=>zone.members.includes(p.id))){
      assert.ok(Math.abs(plot.target.x-area.x)+5<=area.width/2);
      assert.ok(Math.abs(plot.target.z-area.z)+4<=area.depth/2);
    }
  }
  assert.equal(SITE_ROADS[0]!.to.z,355,'Vehicle access ends before the observation yard.');
});

test('walkway centre lines avoid work equipment with clearance for the player',()=>{
  const proxies=SITE_PLOTS.flatMap(plot=>standCollisionProxies(plot.kind,plot.target.x,plot.target.z));
  for(const points of SITE_WALKWAYS)for(let i=1;i<points.length;i++){
    const a=points[i-1]!,b=points[i]!,length=Math.hypot(a.x-b.x,a.z-b.z);
    assert.ok(a.x===b.x||a.z===b.z,'Authored walkway turns are orthogonal.');
    for(let d=0;d<=length;d+=.5){
      const x=a.x+(b.x-a.x)*d/length,z=a.z+(b.z-a.z)*d/length;
      assert.ok(!proxies.some(c=>Math.abs(x-c.x)<c.w+.4&&Math.abs(z-c.z)<c.d+.4),`Walkway blocked at ${x},${z}`);
    }
  }
});

test('support operations are close to the historical work area they prepare',()=>{
  const pairs=[['power-bus','orientation'],['flight-record','complex'],['telemetry-rack','documentation'],['umbilical-check','documentation'],['crew-manifest','crew'],['weather-window','observation'],['pad-safety','observation']];
  for(const [standId,checkpointId]of pairs){const stand=BONUS_CHECKPOINTS.find(s=>s.id===standId)!,cp=CHECKPOINTS.find(c=>c.id===checkpointId)!;
    assert.ok(Math.hypot(stand.target.x-cp.target.x,stand.target.z-cp.target.z)<28,standId+' is part of its work yard');
  }
});
