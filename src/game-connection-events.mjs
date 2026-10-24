// Optional modules observe the already-created reader connection. Subscribing
// never opens a socket, schedules a sample, or changes the reader cadence.
let current=null;const listeners=new Set();
export function publishGameConnection(connection){const next=connection&&!connection.closed?connection:null;if(next===current)return;current=next;for(const listener of listeners)try{listener(current);}catch{}}
export function subscribeGameConnection(listener){listeners.add(listener);listener(current);return()=>listeners.delete(listener);}
