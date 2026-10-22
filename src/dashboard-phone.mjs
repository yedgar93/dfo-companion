import http from 'node:http';
import {networkInterfaces} from 'node:os';
import {randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
const secret=()=>randomBytes(32).toString('base64url');
const privateIP=ip=>/^10\./.test(ip)||/^192\.168\./.test(ip)||/^172\.(1[6-9]|2\d|3[01])\./.test(ip);
const ipNumber=ip=>ip.split('.').reduce((n,v)=>(n*256+Number(v))>>>0,0);
export function sameSubnet(ip,address,mask){return /^\d+\.\d+\.\d+\.\d+$/.test(ip)&&(ipNumber(ip)&ipNumber(mask))===(ipNumber(address)&ipNumber(mask));}
export function phoneInterface(){return Object.values(networkInterfaces()).flat().find(n=>n.family==='IPv4'&&!n.internal&&privateIP(n.address)&&n.netmask);}
const equal=(a,b)=>typeof a==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export async function startPhoneServer({backendPort=9234,port=9235,iface=phoneInterface()}={}){
 if(!iface)return {status:()=>({enabled:false,error:'No private network address is available.'}),close(){}};
 const address=iface.address,host=address+':'+port,origin='http://'+host,sessions=new Map,attempts=new Map;
 let token=secret(),pairCode=String(randomInt(10000000,100000000)),expires=Date.now()+600000,codeAttempts=0,codeWindow=Date.now();
 const status=()=>{if(Date.now()>expires){token=secret();pairCode=String(randomInt(10000000,100000000));expires=Date.now()+600000;}return {enabled:true,address,port,url:origin+'/pair/'+token,baseUrl:origin+'/',pairCode,expiresAt:new Date(expires).toISOString()};};
 const server=http.createServer(async(req,res)=>{
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin'};
  const reply=(code,text)=>{res.writeHead(code,{...headers,'Content-Type':'text/plain; charset=utf-8'});res.end(text);};
  const remote=req.socket.remoteAddress?.replace(/^::ffff:/,'');
  if(req.headers.host!==host||!sameSubnet(remote??'',address,iface.netmask))return reply(403,'Private local network only');
  const paired=()=>{const session=secret();for(const [key,until]of sessions)if(until<Date.now())sessions.delete(key);if(sessions.size>=32)sessions.delete(sessions.keys().next().value);sessions.set(session,Date.now()+28800000);res.writeHead(303,{...headers,'Set-Cookie':'dfo_phone='+session+'; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800','Location':'/'});res.end();};
  const login=(message='')=>{res.writeHead(401,{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pair DFO Companion</title><style>body{margin:32px auto;padding:0 20px;max-width:420px;background:#182017;color:#eee5ca;font:18px system-ui;line-height:1.5}input,button{box-sizing:border-box;width:100%;padding:14px;font:inherit;margin:8px 0;background:#293428;color:#fff;border:1px solid #baaa70}input{font-size:28px;letter-spacing:.15em}button{cursor:pointer}</style></head><body><h1>DFO Companion</h1><p>On your computer, open <b>Connection → Open on your phone</b>. Scan its QR code, or enter the eight-digit pairing code here.</p><p>'+message+'</p><form method="post" action="/pair"><label for="code">Pairing code</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="1234 5678" maxlength="9" required><button>Connect</button></form><p>Keep your phone on the same Wi-Fi as your computer.</p></body></html>');};
  if(req.method==='POST'&&req.url==='/pair'){if(req.headers.origin!==origin)return reply(403,'Open this page directly on your phone.');if((req.headers['content-type']??'').split(';')[0]!=='application/x-www-form-urlencoded')return reply(415,'Use the pairing form.');if(Date.now()-codeWindow>60000){codeWindow=Date.now();codeAttempts=0;}if(++codeAttempts>10)return reply(429,'Too many attempts. Wait one minute.');let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size<=64)raw+=chunk.toString('utf8');}if(size>64)return reply(413,'Pairing code too long.');const value=new URLSearchParams(raw).get('code')?.replace(/\s/g,'');if(Date.now()>expires||!equal(value??'',pairCode))return login('That code is incorrect or expired. Check the current code on your computer.');return paired();}
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
