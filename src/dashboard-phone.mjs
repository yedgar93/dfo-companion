import http from 'node:http';
import {networkInterfaces} from 'node:os';
import {randomBytes,timingSafeEqual} from 'node:crypto';
const secret=()=>randomBytes(32).toString('base64url');
const privateIP=ip=>/^10\./.test(ip)||/^192\.168\./.test(ip)||/^172\.(1[6-9]|2\d|3[01])\./.test(ip);
const ipNumber=ip=>ip.split('.').reduce((n,v)=>(n*256+Number(v))>>>0,0);
export function sameSubnet(ip,address,mask){return /^\d+\.\d+\.\d+\.\d+$/.test(ip)&&(ipNumber(ip)&ipNumber(mask))===(ipNumber(address)&ipNumber(mask));}
export function phoneInterface(){return Object.values(networkInterfaces()).flat().find(n=>n.family==='IPv4'&&!n.internal&&privateIP(n.address)&&n.netmask);}
const equal=(a,b)=>typeof a==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export async function startPhoneServer({backendPort=9234,port=9235,iface=phoneInterface()}={}){
 if(!iface)return {status:()=>({enabled:false,error:'No private network address is available.'}),close(){}};
 const address=iface.address,host=address+':'+port,origin='http://'+host,sessions=new Map,attempts=new Map;
 let token=secret(),expires=Date.now()+600000;
 const status=()=>{if(Date.now()>expires){token=secret();expires=Date.now()+600000;}return {enabled:true,address,port,url:origin+'/pair/'+token,expiresAt:new Date(expires).toISOString()};};
 const server=http.createServer(async(req,res)=>{
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin'};
  const reply=(code,text)=>{res.writeHead(code,{...headers,'Content-Type':'text/plain; charset=utf-8'});res.end(text);};
  const remote=req.socket.remoteAddress?.replace(/^::ffff:/,'');
  if(req.headers.host!==host||!sameSubnet(remote??'',address,iface.netmask))return reply(403,'Private local network only');
  const paired=()=>{const session=secret();for(const [key,until]of sessions)if(until<Date.now())sessions.delete(key);if(sessions.size>=32)sessions.delete(sessions.keys().next().value);sessions.set(session,Date.now()+28800000);res.writeHead(303,{...headers,'Set-Cookie':'dfo_phone='+session+'; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800','Location':'/'});res.end();};
  const login=()=>{res.writeHead(401,{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"});res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pair DFO Companion</title><style>body{margin:32px auto;padding:0 20px;max-width:420px;background:#182017;color:#eee5ca;font:18px system-ui;line-height:1.5}</style></head><body><h1>DFO Companion</h1><p>On your computer, open <b>Connection → Open on your phone</b> and scan its QR code with your phone camera.</p><p>Keep your phone on the same Wi-Fi as your computer.</p></body></html>');};
  if(req.method!=='GET')return reply(405,'Read only');
  const pair=/^\/pair\/([A-Za-z0-9_-]{43})$/.exec(req.url??'');
  if(pair){const count=attempts.get(remote)??{n:0,at:Date.now()};if(Date.now()-count.at>60000){count.n=0;count.at=Date.now();}count.n++;if(attempts.size<128||attempts.has(remote))attempts.set(remote,count);if(count.n>20)return reply(429,'Try again in one minute');if(Date.now()>expires||!equal(pair[1],token))return reply(403,'Pairing link expired. Get the current phone link from Connection on your computer.');return paired();}
  const cookie=/(?:^|;\s*)dfo_phone=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.headers.cookie??'');
  if(!cookie||!(sessions.get(cookie[1])>Date.now()))return req.url==='/'?login():reply(401,'Pair this phone first.');
  if(req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')return reply(403,'Same dashboard only');
  if(/^\/(?:json|devtools)(?:\/|$|\?)/.test(req.url??''))return reply(404,'Not found');
  if(req.url?.startsWith('/api/phone')||req.url?.startsWith('/api/game')||req.url==='/api/identity')return reply(403,'Computer only');
  const upstream=http.request({hostname:'127.0.0.1',port:backendPort,path:req.url,method:'GET',headers:{Host:'127.0.0.1:'+backendPort}},response=>{res.writeHead(response.statusCode,{...response.headers,...headers});response.pipe(res);});
  upstream.on('error',()=>reply(503,'The local dashboard is reconnecting.'));req.on('aborted',()=>upstream.destroy());upstream.end();
 });
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,address,resolve);});}catch(e){return {status:()=>({enabled:false,error:'Phone listener could not start: '+e.message}),close(){server.close();}};}
 return {server,status,close:()=>server.close()};
}
export async function startDynamicPhoneServer({getInterface=phoneInterface,start=startPhoneServer,watchMs=10000}={}){
 let active=null,signature=null,busy=false,closed=false;
 const refresh=async()=>{if(busy||closed)return;const iface=getInterface(),next=iface?iface.address+'|'+iface.netmask:'none';if(next===signature)return;busy=true;try{active?.close();active=await start({iface});signature=next;}finally{busy=false;}};
 await refresh();const timer=setInterval(()=>{void refresh().catch(()=>{});},watchMs);timer.unref();
 return {status:()=>active?.status()??{enabled:false,error:'Phone server is reconnecting.'},refresh,close(){closed=true;clearInterval(timer);active?.close();}};
}
