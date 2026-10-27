import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildCar, CAR_SPECS, poseVehicle, type VehicleRig} from '../src/apollo/ApolloVehicles';

const materials = new Map<string, THREE.MeshStandardMaterial>();
const paint = (name:string,color:number,roughness=.8,metalness=0) => {
  if (!materials.has(name)) materials.set(name,new THREE.MeshStandardMaterial({color,roughness,metalness}));
  return materials.get(name)!;
};
const car = () => buildCar(CAR_SPECS.van,{kind:'van',paint:0xd9d6bd,periodStyle:true},paint);

test('cinematic wheels use travelled distance, survive batching and support replay',()=>{
  const root=car(),rig=root.userData.vehicleRig as VehicleRig;
  assert.equal(rig.wheels.length,4);
  assert.ok(rig.wheels.every(wheel=>wheel.parent===root&&wheel.children.length>0));
  let meshes=0;root.traverse(node=>{if(node instanceof THREE.Mesh)meshes++;});
  assert.ok(meshes<36,`rig has ${meshes} material batches rather than a draw per detail`);
  poseVehicle(root,4,2,2);
  assert.equal(rig.wheels[0].rotation.x,-4/CAR_SPECS.van.wheelRadius);
  const angle=rig.wheels[0].rotation.x;
  poseVehicle(root,4,2,2);assert.equal(rig.wheels[0].rotation.x,angle);
  poseVehicle(root,0,0,0);assert.equal(Math.abs(rig.wheels[0].rotation.x),0);
});

test('each vehicle owns its lamp state and reduced motion preserves mechanical rotation',()=>{
  const a=car(),b=car(),ar=a.userData.vehicleRig as VehicleRig,br=b.userData.vehicleRig as VehicleRig;
  assert.notEqual(ar.headlamp,br.headlamp);assert.notEqual(ar.taillamp,br.taillamp);
  const parked=br.headlamp.emissiveIntensity;
  poseVehicle(a,10,2,3,true);
  assert.equal(a.position.y,0);assert.equal(a.rotation.z,0);
  assert.notEqual(ar.wheels[0].rotation.x,0);
  assert.equal(br.headlamp.emissiveIntensity,parked);
});
