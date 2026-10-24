export function regardFromBadge(classes,label=''){
  const tokens=String(classes??'').split(/\s+/),standing=['hostile','enemy','friend','neutral'].find(s=>tokens.includes(s));
  if(!tokens.includes('talk-regard')||!standing)return null;
  const match=String(label).replace(/−/g,'-').match(/[+-]?\d+/),value=match?Number(match[0]):null;
  return {standing,value:Number.isFinite(value)&&value>=-100&&value<=100?value:null};
}
export function farewellTone(regard,opinion=null){
  if(['hostile','enemy'].includes(regard?.standing))return 'hostile';
  if(regard?.standing==='friend')return 'friendly';
  if(regard?.standing==='neutral')return 'neutral';
  if(opinion?.source==='game-npc-session'&&Number.isFinite(opinion.reactionToPlayer)&&Math.abs(opinion.reactionToPlayer)<=10000)return opinion.reactionToPlayer<0?'unfriendly':opinion.reactionToPlayer>=10?'friendly':'neutral';
  return 'neutral';
}
