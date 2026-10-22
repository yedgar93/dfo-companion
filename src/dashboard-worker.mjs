import {buildItemIcons} from './item-icon-assets.mjs';
import {projectInteriorMap,assetSceneKey} from './dashboard-interior-model.mjs';
import {buildDashboardMap,cachedTownKeys,prepareTownMap,cachedTownDetails,cachedMapLocation} from './dashboard-map-assets.mjs';
import {buildAppearance} from './paperdoll-assets.mjs';
import {readOnce,configuration} from './transport.mjs';
import {connectionDiagnosis,inspectWindowsConnection} from './health.mjs';
import {projectDetails} from './dashboard-model.mjs';
import {pathToFileURL} from 'node:url';
export const ENABLE_INTERIOR_MAP=false;
const inspectionSession={};let lastAssetScene=null,initialAssetsAttempted=false,lastMapArtwork=null,lastMapUpdate=null,lastProjectedAt=null,lastProjectedDetails=null,lastAssetsKey=null,lastAssets=null;
let manualRefreshRequested=false;export function requestDashboardRefresh(){manualRefreshRequested=true;}
export function closeDashboardReader(){inspectionSession.connection?.close();inspectionSession.connection=null;inspectionSession.sources=null;inspectionSession.lowImpact=null;}
const config=configuration({DFO_OBSERVER_ALLOW_ATTACH:'1',DFO_OBSERVER_CACHED_MODULE:'1',DFO_OBSERVER_SAMPLE_MS:'0'});
export async function sampleDashboard({detailsDue=false,townKey=null}={}){
let result;const started=Date.now();if(manualRefreshRequested){manualRefreshRequested=false;initialAssetsAttempted=false;inspectionSession.lowImpact=null;}
try{
 // One own-player transaction feeds vitals, pose, inventory and current quests.
 // Static map/service/art assets use their own slower, cached lane.
 const player=await readOnce({...config,dashboardLive:true,inspectionSession});
 result={available:player?.available===true,player:{identity:player.identity,vitals:player.vitals,resources:{goldPieces:player.resources?.goldPieces}},pose:player.dashboardPose??null,capturedAt:player.dashboardCapturedAt??new Date().toISOString(),reason:player?.reason??null};
 if(result.available){
  result.timings={ownReadMs:Date.now()-started,rendererCopyMs:player.dashboardPerformance?.copyMs??player.dashboardCopyMs??null,guard:player.dashboardPerformance??null,dungeonCopyMs:player.dashboardDungeonCost??null,deferred:player.dashboardDeferred??null,lanes:player.dashboardLaneMs??null,journalReused:player.dashboardJournalReused===true};
  result.dungeonReader={needsReference:player.dashboardDungeonNeedsReference===true,status:player.dashboardDungeonStatus??null,resetScene:player.dashboardDungeonResetScene??null};
  if(process.env.DFO_DEBUG_LANES==='1'&&player.dashboardLaneMs)console.error('[dfo lanes]',Object.entries(player.dashboardLaneMs).map(([k,v])=>k+'='+Number(v).toFixed(2)+'ms').join(' '),player.dashboardJournalReused?'journal=reused':'',player.dashboardDeferred?'deferred':'');
  const ownLocation=player.dashboardPose?.location??null;
  const detailsAt=player.dashboardDetailsAt??result.capturedAt;if(lastProjectedAt===detailsAt&&lastProjectedDetails){result.details={...lastProjectedDetails,location:ownLocation};}else {result.details=projectDetails(player,ownLocation);try{const icons=await buildItemIcons(player);for(let i=0;i<result.details.items.length;i++)result.details.items[i].iconUrl=icons[i]??null;}catch{}
  try{result.details.appearance=await buildAppearance(player);}catch{}lastProjectedAt=detailsAt;lastProjectedDetails=result.details;}
  const pixel=ownLocation?.mapPixel;
  const scene=assetSceneKey(ownLocation),changedScene=ENABLE_INTERIOR_MAP&&scene!==null&&scene!==lastAssetScene;
  const changedTown=pixel&&ownLocation?.mode==='exterior'&&ownLocation?.place?.name&&townKey!==pixel.x+','+pixel.y;
  if(!initialAssetsAttempted){
   initialAssetsAttempted=true;
   lastAssetScene=scene;
   try{
    const nav=await readOnce({...config,inspectionSession,navigationOnly:true,navigationCommand:ENABLE_INTERIOR_MAP&&ownLocation?.mode!=='exterior'?'map':'town',townGeometryKeys:cachedTownKeys()});
    if(ENABLE_INTERIOR_MAP)result.details.interiorMap=projectInteriorMap(nav);
    if(nav.location?.available){result.details.location=projectDetails(player,nav.location).location;result.details.locationAvailable=true;}
    try{result.details.map=await buildDashboardMap(nav.location);lastMapArtwork=result.details.map;}catch{}
    try{const town=await prepareTownMap(nav);if(town)result.details.townMap=town;}catch{}
    result.assetsRefreshed=true;result.assetsKey=pixel?pixel.x+','+pixel.y:null;
   }catch{result.detailError='MAP_DETAIL_READ_FAILED';}
  }
  if(initialAssetsAttempted&&!result.assetsRefreshed){const assetKey=[pixel?.x,pixel?.y,ownLocation?.mode,player.dashboardMapUpdate?.revision,ownLocation?.place?.regionIndex].join('|');if(assetKey===lastAssetsKey&&lastAssets){Object.assign(result.details,lastAssets);}else {const update=player.dashboardMapUpdate;if(update&&update!==lastMapUpdate){const sameGeometry=lastMapUpdate?.townMap===update.townMap;lastMapUpdate=update;const prior=cachedTownDetails(ownLocation),known=new Map((prior?.shops??[]).map(b=>[b.mapKey,b]));const shops=update.shops?{...update.shops,shops:update.shops.shops.map(b=>({...b,name:b.name??known.get(b.mapKey)?.name??null,questSites:b.questSites?.length?b.questSites:known.get(b.mapKey)?.questSites??[]}))}:null;const map=await prepareTownMap({...update,townMap:sameGeometry?null:update.townMap,shops,location:ownLocation});if(map)result.details.townMap=map;}else {const cached=cachedTownDetails(ownLocation);if(cached)result.details.townMap=cached;}const mapLoc=cachedMapLocation(ownLocation);const artwork=await buildDashboardMap(mapLoc,{cacheOnly:true});if(artwork?.available)lastMapArtwork=artwork;if(lastMapArtwork)result.details.map=lastMapArtwork;lastAssetsKey=assetKey;lastAssets={map:result.details.map??null,townMap:result.details.townMap??null};}result.assetsRefreshed=true;result.assetsKey=pixel?pixel.x+','+pixel.y:null;}
  const dm=player.dashboardDungeonMap;if(ownLocation?.mode==='dungeon'){result.details.interiorMap=dm?{available:true,sceneKey:dm.sceneKey,mode:'dungeon',name:ownLocation.place?.name??'Dungeon',capturedAt:dm.capturedAt,geometry:{available:true,parts:dm.parts,truncated:dm.truncated??false},trail:[],notes:[],objectives:dm.objectives??[],exit:dm.exit??null,objectivesAt:dm.objectivesAt??null,scope:'Already explored geometry only; no inferred routes or hidden rooms.'}:null;}else result.details.interiorMap=null;
  result.detailsAt=detailsAt;result.detailsVersion=(dm?.objectivesVersion??'')+'|'+(dm?.revision??'')+'|'+detailsAt+'|'+(lastAssetsKey??player.dashboardMapUpdate?.revision??'')+'|'+(pixel?pixel.x+','+pixel.y:'');result.timings.totalMs=Date.now()-started;
 }
}catch(e){
 const reason=e.code??'READ_FAILED';result={available:false,reason};
 if(['DEBUG_ENDPOINT_UNAVAILABLE','DEBUG_CONNECTION_FAILED','INSPECTION_CONNECT_FAILED'].includes(reason)&&process.platform==='win32'){const diagnosis=connectionDiagnosis(inspectWindowsConnection());if(diagnosis.reason!=='CONNECTION_PRESENT')result={available:false,...diagnosis};}
}
if(result.timings)result.timings.inspection={...inspectionSession.stats,...inspectionSession.connection?.traffic};return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){sampleDashboard({detailsDue:process.argv.includes('details'),townKey:process.argv.find(v=>v.startsWith('--town-key='))?.slice(11)}).then(r=>{closeDashboardReader();process.stdout.write(JSON.stringify(r));});}
