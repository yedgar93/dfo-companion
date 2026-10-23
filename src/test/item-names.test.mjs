import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeItemName,projectDetails} from '../dashboard-model.mjs';

test('copied magic labels resolve the item token by template ID without losing affix names',()=>{
 assert.equal(normalizeItemName({name:'%it of Friendship',templateIndex:120}),'Longsword of Friendship');
 assert.equal(normalizeItemName({name:'Frosty %it of Ice Storms',templateIndex:116}),'Frosty Shortsword of Ice Storms');
 assert.equal(normalizeItemName({name:'Guardian’s %it of Skill',templateIndex:522}),'Guardian’s Helmet of Skill');
 assert.equal(normalizeItemName({name:'%IT of Warding',templateIndex:110}),'Round Shield of Warding');
 assert.equal(normalizeItemName({name:'%it and %it',templateIndex:135}),'Ring and Ring');
});

test('copied custom template names take priority while unknown identities stay unresolved',()=>{
 assert.equal(normalizeItemName({name:'Healing %it',templateIndex:90001,template:{name:'Moonstone Charm'}}),'Healing Moonstone Charm');
 assert.equal(normalizeItemName({name:'Healing %it',templateIndex:120,template:{name:'Custom Longsword'}}),'Healing Custom Longsword');
 assert.equal(normalizeItemName({name:'Healing %it',templateIndex:90001}),'Healing %it');
 assert.equal(normalizeItemName({name:'%it of Practice',templateIndex:120,template:{name:'%it'}}),'Longsword of Practice');
 assert.equal(normalizeItemName({name:'Healing %it',templateIndex:90001,template:{name:'%missing'}}),'Healing %it');
});

test('ordinary percent text, other macros and already resolved names are preserved',()=>{
 for(const name of ['Sword of 10% Fire Resistance','100% Genuine Ring','%item of Mystery','%wep of Mystery','Soldier’s Longsword of Practice'])assert.equal(normalizeItemName({name,templateIndex:120}),name);
 assert.equal(normalizeItemName({templateIndex:120}),null);
});

test('unidentified items reveal only their trusted base type, regardless of stored magical names',()=>{
 for(const name of ['%it of Friendship','Warrior’s Longsword of the Silver Tongue','A Secret Artifact Name','Healing %it']){
  const item={name,identified:false,templateIndex:120,template:{name:'A Secret Custom Name'}},original=structuredClone(item);
  assert.equal(normalizeItemName(item),'Unidentified Longsword');assert.deepEqual(item,original);
 }
 assert.equal(normalizeItemName({identified:false,name:'Secret Shortsword of Doom',templateIndex:116}),'Unidentified Shortsword');
 assert.equal(normalizeItemName({identified:false,name:'Secret Staff',templateIndex:115}),'Unidentified Staff');
 assert.equal(normalizeItemName({identified:false,name:'Secret of the Gods',templateIndex:90001,template:{name:'Secret Custom Artifact'}}),'Unidentified item');
 assert.equal(normalizeItemName({identified:false,templateIndex:120}),'Unidentified Longsword');
});

test('projection fixes labels without mutating the snapshot or revealing unidentified effects',()=>{
 const source={name:'%it of Friendship',templateIndex:120,group:'Weapons',material:1,identified:false,rarity:'rare',description:'Hidden enchantment',affixes:[{id:'damage',value:20}],enchantments:[],customEnchantments:[],condition:{current:10,max:100}};
 const original=structuredClone(source),item=projectDetails({inventory:{available:true,items:[source]}},null).items[0];
 assert.equal(item.name,'Unidentified Longsword');assert.deepEqual(source,original);
 assert.deepEqual(item.affixes,[]);assert.equal(item.description,null);assert.equal(item.rarity,null);assert.equal(item.identified,false);assert.equal(item.magicKnown,false);
});
