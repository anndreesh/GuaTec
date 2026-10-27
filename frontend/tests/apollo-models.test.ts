import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildStandModel, standCollisionProxies, type StandModelKind } from '../src/apollo/ApolloStandModels';
import { buildCar, CAR_SPECS } from '../src/apollo/ApolloVehicles';

test('every stand builds finite human-scale geometry with bounded shared material batches', () => {
  const atlas = new THREE.Texture(), materials = new Map<string,THREE.MeshStandardMaterial>();
  const factory = (name:string,color:number,roughness=.8,metalness=0) => {
    if(!materials.has(name))materials.set(name,new THREE.MeshStandardMaterial({color,roughness,metalness}));
    return materials.get(name)!;
  };
  const kinds:StandModelKind[]=['sequence','flight-plan','telemetry','cables','crew-manifest','weather','beacons','orientation','survey','records','radio','crew','tracking'];
  for(const kind of kinds){
    const model=buildStandModel(kind,factory,atlas,0),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
    assert.ok(size.x>=5&&size.x<7,`${kind}: width is in metres`);assert.ok(size.y>2.5&&size.y<5,`${kind}: height is in metres`);
    assert.ok(model.children.length<=9,`${kind}: material batches stay bounded`);
    model.traverse(node=>{if(node instanceof THREE.Mesh){const position=node.geometry.getAttribute('position');for(let i=0;i<position.array.length;i++)assert.ok(Number.isFinite(position.array[i]),`${kind}: finite vertices`);node.geometry.dispose();}});
  }
  assert.ok(materials.size<=9);materials.forEach(material=>material.dispose());atlas.dispose();
});

test('stand proxies cover side equipment while leaving the approach open',()=>{
  const cabinet=standCollisionProxies('telemetry',40,290);
  assert.ok(cabinet.some(c=>Math.abs(c.x-42.02)<.01));
  const tripod=standCollisionProxies('survey',-70,165);
  assert.ok(tripod.some(c=>Math.abs(c.x+72.13)<.01));
  for(const c of [...cabinet,...tripod]){
    assert.ok([c.x,c.z,c.w,c.d].every(Number.isFinite));assert.ok(c.w>0&&c.d>0);
    assert.ok(!(Math.abs(c.x-40)<=c.w&&Math.abs(c.z-295)<=c.d),'front approach is clear');
  }
});

test('period support vehicles retain their wheelbase and fit their collision dimensions',()=>{
  const materials=new Map<string,THREE.MeshStandardMaterial>();
  const factory=(name:string,color:number,roughness=.8,metalness=0)=>{if(!materials.has(name))materials.set(name,new THREE.MeshStandardMaterial({color,roughness,metalness}));return materials.get(name)!;};
  for(const kind of ['sedan','van'] as const){
    const spec=CAR_SPECS[kind],car=buildCar(spec,{kind,paint:0xd9d6bd,periodStyle:true},factory),bounds=new THREE.Box3().setFromObject(car),size=bounds.getSize(new THREE.Vector3());
    assert.ok(size.z<spec.length+.5);assert.ok(size.x<spec.width+.6);assert.ok(size.y<spec.height+.4);
    assert.equal(spec.lightBar,false);
    car.traverse(node=>{if(node instanceof THREE.Mesh)node.geometry.dispose();});
  }materials.forEach(material=>material.dispose());
});
