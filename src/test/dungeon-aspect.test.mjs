import test from 'node:test';
import assert from 'node:assert/strict';
import {dungeonCamera,fittedDungeonFrame} from '../dashboard-interior-model.mjs';
import {visibleMapPoint} from '../dashboard-map-model.mjs';
const points=[{x:-35,y:0,z:-70},{x:35,y:14,z:70},{x:5,y:60,z:-5}],position={x:0,y:0,z:0};
test('dungeon projection and fitting use the full tall, square and wide viewport',()=>{
 for(const aspect of [2,393/650,375/300,1,3])for(const [yaw,pitch]of [[0,.85],[.65,.35],[2,Math.PI/2]]){
  const fitted=fittedDungeonFrame(points,position,yaw,pitch,aspect),camera=dungeonCamera(fitted.center,fitted.span,yaw,pitch,aspect);
  assert.equal(camera.viewHeight,320/aspect);const center=camera.project(fitted.center);
  assert(Math.abs(center.x-160)<1e-8);assert(Math.abs(center.y-camera.viewHeight/2)<1e-8);
  for(const p of [...points,position]){const q=camera.project(p);assert(q.x>=0&&q.x<=320);assert(q.y>=0&&q.y<=camera.viewHeight);}
  // Equal world distances retain equal screen scale in a north-up plan view.
  const plan=dungeonCamera(position,100,0,Math.PI/2,aspect),c=plan.project(position),x=plan.project({x:10,y:0,z:0}),z=plan.project({x:0,y:0,z:10});
  assert(Math.abs((x.x-c.x)-(z.y-c.y))<1e-8);
 }
});
test('offscreen dungeon labels clamp to the actual tall viewport instead of a 160-unit strip',()=>{
 const q=visibleMapPoint({x:160,y:410},500);assert.equal(q.y,410);assert.equal(q.offscreen,false);
 assert.equal(visibleMapPoint({x:160,y:700},500).y,492);
});
