// External navigation stays restricted to the known website and the current,
// locally issued phone link. This never reads game data.
function isPhonePairingUrl(value){
 try{const u=new URL(value),parts=u.hostname.split('.').map(Number);return u.protocol==='http:'&&u.port==='9235'&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/pair\/[A-Za-z0-9_-]{43}$/.test(u.pathname)&&parts.length===4&&parts.every(n=>Number.isInteger(n)&&n>=0&&n<=255)&&(parts[0]===10||parts[0]===172&&parts[1]>=16&&parts[1]<=31||parts[0]===192&&parts[1]===168);}catch{return false;}
}
async function openDashboardLink(url,{origin,openExternal,fetchStatus=async()=>{const r=await fetch(origin+'/api/phone/status',{signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error('Phone status unavailable');return r.json();}}){
 if(url==='https://www.yedgar.ca/'){await openExternal(url);return true;}
 if(!isPhonePairingUrl(url))return false;
 const status=await fetchStatus();if(!status.enabled||status.url!==url)return false;
 await openExternal(url);return true;
}
module.exports={isPhonePairingUrl,openDashboardLink};
