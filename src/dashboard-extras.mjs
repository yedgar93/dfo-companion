// Pure dashboard helpers. No network, game, reader or DOM access.

// 3. Render gate: identical /api/live payloads skip the DOM rebuild.
// serverTime and uiVersion change every poll without changing what is shown.
const VOLATILE=new Set(['serverTime','uiVersion','sampling']);
export function livePayloadKey(live){if(!live||typeof live!=='object')return 'none';return JSON.stringify(live,(k,v)=>VOLATILE.has(k)?undefined:v);}
export function shouldDrawMap({documentHidden=false,mapHidden=false}={}){return !documentHidden&&!mapHidden;}

// 2. Panels whose copies are deferred after a location change.
export function deferredPanels(s,now=Date.now()){const d=s?.timings?.deferred;if(!d?.until)return [];const until=Date.parse(d.until);return Number.isFinite(until)&&until>now-1000?(d.panels??['details','quests']):[];}
export function laneSummary(lanes){if(!lanes||typeof lanes!=='object')return '';return Object.entries(lanes).filter(([,v])=>Number.isFinite(v)).map(([k,v])=>k+' '+v.toFixed(2)+' ms').join(' · ');}

// 4. Quest "what now" card. Only tracker and recorded-journal values already in the snapshot.
const placeLabel=d=>[d?.buildingName,d?.locationName,d?.regionName].filter(Boolean).join(' · ');
export function questNowCard(details){
 const tracker=details?.questTracker,views=tracker?.available?tracker.views??[]:[];
 const view=views.find(v=>v.id===tracker?.pinned)??views.find(v=>v.id===tracker?.journalFocus)??views[0]??null;
 if(!view)return {available:false,title:tracker?.available?'No quest tracked':'Waiting for your quest tracker',step:tracker?.available?'Track a quest in the game to see what to do next.':'Your current step appears after a detail read.',destination:null,done:[],canPin:false};
 const journal=(details?.questJournal??[]).find(q=>q.id===view.id)??null;
 const latestText=journal?.latest??null;
 let destination=null;
 if(view.destination&&(view.destination.locationName||view.destination.buildingName))destination={label:placeLabel(view.destination),confirmed:true,source:view.destination.source??'Shown by the game tracker'};
 else {const named=(journal?.disclosedLocations??[]).filter(l=>l.locationName);const unique=[...new Set(named.map(placeLabel))];if(unique.length===1)destination={label:unique[0],confirmed:false,source:'Mentioned in the journal'};}
 return {available:true,id:view.id,title:view.title??'Current quest',step:view.objective??(latestText?String(latestText).slice(0,400):'No current objective is shown by the game.'),stepFromJournal:!view.objective&&!!latestText,destination,destinationText:destination?(destination.confirmed?destination.label:destination.label+' · destination unconfirmed'):'Destination unconfirmed',done:(view.completed??[]).slice(0,6),canPin:!!destination?.confirmed||!!view.destination};
}

// 9d. Plain-English connection reasons.
const REASONS={
 LIVE_PLAYER_VERIFIED:'Connected. Your character is being read normally.',
 STARTING:'The companion is starting up.',
 PAGE_CHANGED:'The game page changed (for example, you went back to the menu or the game reloaded). The companion reconnects on its own once your character is loaded again.',
 GAME_CANVAS_UNAVAILABLE:'The game screen isn’t available right now, usually while the game is loading or reloading. Nothing to do; it reconnects automatically.',
 IDLE_READER_WAITING:'Waiting for the game to have a spare moment. Readings pause during busy scenes so gameplay stays smooth.',
 GAME_NOT_RUNNING:'DFO is closed. Open DFO with Companion when you’re ready.',
 GAME_TARGET_UNAVAILABLE:'DFO is open but hasn’t reached the game yet. Finish loading or logging in.',
 GAME_RUNNING_WITHOUT_FLAGS:'DFO is running without its companion connection. When it’s safe, quit DFO and start it with Companion.',
 UPDATER_DROPPED_FLAGS:'A game update restarted DFO without its companion connection. When it’s safe, quit DFO and start it with Companion.',
 PLAYER_NOT_AVAILABLE:'No character is loaded yet. Choose Play and load your character.',
 PLAYER_SURFACE_UNAVAILABLE:'Your character isn’t loaded yet, or is between scenes.',
 PLAYER_REFERENCE_UNAVAILABLE:'The companion lost track of your character, usually after a reload. It reconnects automatically.',
 PLAYER_READ_INCOMPLETE:'Part of your character couldn’t be read this time. The next read usually fixes it.',
 FAST_READ_UNAVAILABLE:'A quick read failed, so the companion is reconnecting.',
 SAMPLER_FAILED:'The local reader hit an error and will retry automatically.',
 DASHBOARD_UNREACHABLE:'This window can’t reach the companion’s local reader. Open DFO with Companion to reconnect.',
 LISTENER_NOT_OWNED_BY_GAME:'The local connection port belongs to another program, so the companion didn’t attach.',
 FLAGS_PRESENT_LISTENER_NOT_READY:'DFO is starting its companion connection. Give it a moment.'
};
export function explainReason(code){if(!code)return REASONS.STARTING;if(REASONS[code])return REASONS[code];if(/SOURCE_NOT_REVIEWED|UNREVIEWED|REVIEW|PROOF|BINDING|IMPORT_CHAIN/.test(code))return 'This game version hasn’t been checked by the companion yet. Keep playing; a companion update will add support.';if(/UNAVAILABLE$/.test(code))return 'Part of the game data isn’t available right now. The companion retries automatically.';return 'The last read didn’t work. The companion retries automatically.';}
export function sinceText(iso,now=Date.now()){const t=Date.parse(iso??'');if(!Number.isFinite(t))return 'never';const s=Math.max(0,Math.round((now-t)/1000));if(s<60)return s+'s ago';const m=Math.floor(s/60);if(m<60)return m+'m '+(s%60)+'s ago';const h=Math.floor(m/60);return h+'h '+(m%60)+'m ago';}

// 9b. Plain-English glossary, worded after the game's own help text and UESP's Daggerfall pages.
export const GLOSSARY={
 Strength:'Raises the damage of melee and hand-to-hand attacks, and how much you can carry.',
 Intelligence:'Sets how many spell points (magicka) you have.',
 Willpower:'Helps you resist magic and recover from its effects.',
 Agility:'Helps you hit enemies and avoid being hit.',
 Endurance:'Adds health each time you level up and helps you recover health and fatigue.',
 Personality:'Makes people like you more: better prices, persuasion and reactions.',
 Speed:'How fast you move.',
 Luck:'Gives a small boost to nearly everything, from hitting to skill checks.',
 Health:'How much damage you can take before you die.',
 Magicka:'Spell points. Casting spends them; resting restores them.',
 Fatigue:'Stamina. Running, fighting and swimming tire you; rest to recover.',
 Armour:'Your armour rating. Higher makes enemies miss more often.',
 Medical:'Heals more health when you rest and helps against poison and disease.',
 Etiquette:'Helps when talking politely to nobles, scholars and merchants.',
 Streetwise:'Helps when talking to commoners and the underworld.',
 Jumping:'How high and far you can jump.',
 Orcish:'Talk to orcs so they may leave you alone.',
 Harpy:'Talk to harpies so they may leave you alone.',
 Giantish:'Talk to giants so they may leave you alone.',
 Dragonish:'Talk to dragonlings so they may leave you alone.',
 Nymph:'Talk to nymphs so they may leave you alone.',
 Daedric:'Talk to daedra so they may leave you alone.',
 Spriggan:'Talk to spriggans so they may leave you alone.',
 Centaurian:'Talk to centaurs so they may leave you alone.',
 Impish:'Talk to imps so they may leave you alone.',
 Lockpicking:'Opens locked doors and chests.',
 Mercantile:'Gets you better prices when buying and selling.',
 Pickpocket:'Steals from people without being noticed.',
 Stealth:'Lets you move without being noticed.',
 Swimming:'How fast you swim and how long you last in water.',
 Climbing:'Lets you climb walls without falling.',
 Backstabbing:'Extra damage when you attack an enemy from behind.',
 Dodging:'Helps you avoid enemy attacks.',
 Running:'How fast you run.',
 Destruction:'Damaging spells such as fireballs.',
 Restoration:'Healing and curing spells.',
 Illusion:'Spells that hide you or trick the eye, such as invisibility.',
 Alteration:'Spells that change the body or the world, such as water walking.',
 Thaumaturgy:'Spells that move or sense things, such as levitation.',
 Mysticism:'Spells that bend magic itself, such as dispel or soul trap.',
 'Short Blade':'Daggers, tantos, wakazashis and shortswords.',
 'Long Blade':'Broadswords, longswords, sabres, katanas and claymores.',
 'Hand-to-Hand':'Fighting with bare hands.',
 Axe:'Battle axes and war axes.',
 'Blunt Weapon':'Maces, flails, warhammers and staves.',
 Archery:'Short and long bows.',
 'Critical Strike':'Raises your chance to land a hit with any weapon.'
};
export function glossaryFor(term){return GLOSSARY[String(term??'').trim()]??null;}

// Error plaque wording per existing snapshot reason code. Presentation only: no reads.
const PLAQUES={
 GAME_NOT_RUNNING:{tone:'stopped',title:'Game is closed',action:'Start DFO with Companion from the Connection tab when you’re ready.',start:true},
 PAGE_CHANGED:{tone:'error',title:'Game left the play screen',action:'Choose Play and load your character.'},
 GAME_CANVAS_UNAVAILABLE:{tone:'waiting',title:'Game screen is loading',action:'Leave this window open; no action needed.'},
 GAME_TARGET_UNAVAILABLE:{tone:'waiting',title:'Game is still loading',action:'Finish loading or logging in to DFO.'},
 GAME_RUNNING_WITHOUT_FLAGS:{tone:'error',title:'Game has no companion connection',action:'When it’s safe, quit DFO and start it from the Connection tab.',start:true},
 UPDATER_DROPPED_FLAGS:{tone:'error',title:'Game update dropped the connection',action:'When it’s safe, quit DFO and start it from the Connection tab.',start:true}
};
export const NO_READER_REASONS=new Set(['GAME_NOT_RUNNING','PAGE_CHANGED','GAME_CANVAS_UNAVAILABLE','GAME_TARGET_UNAVAILABLE','GAME_RUNNING_WITHOUT_FLAGS','UPDATER_DROPPED_FLAGS','DASHBOARD_UNREACHABLE']);
export function problemPlaque(s){const code=s?.reason;if(!code||code==='LIVE_PLAYER_VERIFIED'||code==='STARTING')return null;if(s?.status?.kind==='live'&&!s?.stale)return null;const known=PLAQUES[code],hasData=!!s?.lastSuccess;
 const base=known??{tone:'error',title:hasData?'Can’t read the game right now':'Can’t read the game yet',action:hasData?'The panels below show your last known data, marked as old.':'The companion retries automatically.'};
 return {code,tone:base.tone,title:base.title,message:explainReason(code),action:base.action,start:!!base.start,hasData};}

// Fixed-width digits: the pixel font's figures are proportional (1 is narrower than 0), so live numbers
// shift as they change. Each digit gets a 1ch box (CSS .dg); text content is unchanged.
export function digitBoxes(node,value){if(!node)return;const s=String(value??'');if(node.dataset.dg===s)return;node.dataset.dg=s;if(typeof document==='undefined'||!/\d/.test(s)){node.textContent=s;return;}
 const parts=[];let run='';for(const ch of s){if(ch>='0'&&ch<='9'){if(run){parts.push(document.createTextNode(run));run='';}const d=document.createElement('span');d.className='dg';d.textContent=ch;parts.push(d);}else run+=ch;}if(run)parts.push(document.createTextNode(run));node.replaceChildren(...parts);}

// Quiet connection toast: one message per real transition. Nothing on first load, a
// "lost" message only after the game was connected, a "back" message only after a loss.
export function connectionToast(state,online){
 const next={online,wasOnline:state?.wasOnline||online,lost:state?.lost||false};let toast=null;
 if(state&&state.online!==online){if(!online&&state.wasOnline){toast={kind:'lost',title:'Game connection lost',message:'Showing last known data until DFO is back.'};next.lost=true;}else if(online&&state.lost){toast={kind:'restored',title:'Game connection back',message:'Live readings resumed.'};next.lost=false;}}
 return {state:next,toast};
}
