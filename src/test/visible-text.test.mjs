import test from 'node:test';import assert from 'node:assert/strict';import {readVisibleText} from '../visible-text.mjs';
test('a visible enhanced notebook is read before the body and marks the scene covered',()=>{
 const keys=['document','NodeFilter','getComputedStyle','innerWidth','innerHeight'],saved=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const root={},normal={display:'block',visibility:'visible',opacity:'1',overflowX:'visible',overflowY:'visible',pointerEvents:'auto'},box={left:0,top:0,right:100,bottom:100,width:100,height:100};
 const panel={parentElement:root,closest(){return null;},contains(el){return el===label;},getBoundingClientRect(){return box;}},label={parentElement:panel,closest(){return null;},contains(){return false;}},node={parentElement:label,nodeValue:'Character Pack Spellbook Chronicle SYSTEM'};
 let at=0;globalThis.document={body:{},documentElement:root,querySelectorAll(){return[panel];},createTreeWalker(target){assert.equal(target,panel);return {nextNode(){return at++===0?node:null;}};},createRange(){return {selectNodeContents(){},getClientRects(){return[box];}};},elementsFromPoint(){return[label];}};
 globalThis.NodeFilter={SHOW_TEXT:4};globalThis.getComputedStyle=()=>normal;globalThis.innerWidth=100;globalThis.innerHeight=100;
 try{const r=readVisibleText();assert.equal(r.sceneCovered,true);assert.equal(r.coverage.visibleModalRoots,1);assert.equal(r.lines[0].text,node.nodeValue);}finally{for(const[k,d]of saved)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];}
});
test('visible text never reads values of chat/account/input, hidden, clipped or covered nodes',()=>{
 const keys=['document','NodeFilter','getComputedStyle','innerWidth','innerHeight'],saved=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const root={},normal={display:'block',visibility:'visible',opacity:'1',overflowX:'visible',overflowY:'visible',pointerEvents:'auto'};let active=null,privateReads=0;
 const el=(kind,style={})=>({kind,parentElement:root,style:{...normal,...style},closest(selector){if(selector.includes('input')&&['input','chat','account'].includes(kind))return this;return null;},contains(){return false;},getBoundingClientRect(){return {left:0,top:0,right:10,bottom:10};}});
 const visible=el('visible'),input=el('input'),chat=el('chat'),account=el('account'),hidden=el('hidden',{display:'none'}),clipped=el('clipped'),covered=el('covered'),other=el('other');
 clipped.parentElement={parentElement:root,style:{...normal,overflowX:'hidden',overflowY:'hidden'},getBoundingClientRect(){return {left:0,top:0,right:2,bottom:2};},closest(){return null;}};
 const nodes=[visible,input,chat,account,hidden,clipped,covered].map(parentElement=>{const n={parentElement};Object.defineProperty(n,'nodeValue',{get(){if(parentElement!==visible){privateReads++;throw Error('PRIVATE TEXT READ');}return 'Visible dialogue';}});return n;});
 let at=0;globalThis.document={body:{},documentElement:root,createTreeWalker(){return {nextNode(){return nodes[at++]??null;}};},createRange(){let node;return {selectNodeContents(n){node=n;active=n.parentElement;},getClientRects(){return [{width:10,height:10,left:5,top:5,right:15,bottom:15}];}};},elementsFromPoint(){return [active===covered?other:active];}};
 globalThis.NodeFilter={SHOW_TEXT:4};globalThis.getComputedStyle=e=>e.style??normal;globalThis.innerWidth=100;globalThis.innerHeight=100;
 try{const result=readVisibleText();assert.deepEqual(result.lines,[{text:'Visible dialogue',role:'text'}]);assert.equal(privateReads,0);}finally{for(const[k,d]of saved)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];}
});
