'use strict';
/* ============================================================
   FLORESTA — simulação de bichos que aprendem (núcleo)
   Reparo do arquivo original + 7 espécies.
   ============================================================ */

/* =====================  UTIL  ===================== */
const TAU = Math.PI * 2;
let R = Math.random;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const rnd=(a=0,b=1)=>a+R()*(b-a);
const rint=(a,b)=>Math.floor(rnd(a,b+1));
const pick=a=>a[Math.floor(R()*a.length)];
const clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v;
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const hyp=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const sm=s=>{s=clamp(s);return s*s*(3-2*s)};

/* =====================  MUNDO  ===================== */
const SIZES={pequeno:{gn:128,label:'pequeno'},medio:{gn:192,label:'médio'},grande:{gn:256,label:'grande'}};
const CFG_KEY='florestaViva.cfg.v1';
let GN=192, CELL=2, HALF=192, EDGE=HALF-4;
let PONDS=[];
const BASE_MOUNTAINS=[
  {x:-128,z:-112,r:36,h:17},{x:120,z:-126,r:32,h:15},{x:-136,z:54,r:30,h:13},
  {x:132,z:94,r:36,h:18},{x:-38,z:-146,r:26,h:11},{x:92,z:28,r:22,h:9},
  {x:-156,z:-30,r:28,h:12},{x:152,z:-38,r:26,h:11},
  // serras da área nova, além da antiga borda
  {x:44,z:174,r:30,h:14},{x:-72,z:-178,r:30,h:13},{x:176,z:70,r:26,h:12},
];
const EXTRA_MOUNTAINS=[
  {x:-206,z:-176,r:34,h:16},{x:212,z:-150,r:30,h:14},{x:-198,z:196,r:32,h:15},{x:206,z:186,r:28,h:12},
];
const MOUNTAINS=BASE_MOUNTAINS.slice();
const BASE_PONDS=[
  {x:-30,z:26,r:9},{x:34,z:-34,r:7},{x:56,z:46,r:11},{x:-52,z:-58,r:9},
  // pântano alagado no sul do mapa maior
  {x:-138,z:146,r:15,marsh:true,swamp:true},{x:138,z:142,r:13,marsh:true,swamp:true},
  {x:-116,z:134,r:9,marsh:true,swamp:true},
  {x:62,z:168,r:9},{x:-160,z:164,r:9,marsh:true},
];
const DESERT_ZONES=[{x:-96,z:118,r:58},{x:96,z:-8,r:40},{x:196,z:120,r:44}];
let BIOME_REGIONS=null;
let BIOME_REGION_SEED=0;
let OCEAN_ZONE=null;
let RIVER_MOUTH=null;
const WATER_Y=-1.1;
const RIVER={base:16,amp:9,width:3.4};
const WATERFALL={z:-34};
function riverX(z){return RIVER.base+Math.sin(z*.055+1.1)*RIVER.amp+Math.sin(z*.021+2)*4;}
function riverDist(x,z){
  let d=Math.abs(x-riverX(z));
  if(RIVER_MOUTH){
    const nearX=clamp(x,RIVER_MOUTH.minX,RIVER_MOUTH.maxX);
    d=Math.min(d,Math.hypot(x-nearX,z-RIVER_MOUTH.z));
  }
  return d;
}
function inRiver(x,z,m=1){return riverDist(x,z)<RIVER.width*m;}
function wetAt(x,z){return Math.sin(x*.043+2.2)*Math.cos(z*.05-1.1)+.6*Math.sin((x+z)*.026+1.7);}
function desertAt(x,z){
  if(BIOME_REGIONS){
    const region=biomeRegionAt(x,z);
    return region&&region.biome===8?clamp(.24+region.margin/38*.76):0;
  }
  let best=0;
  for(const d of DESERT_ZONES){
    if(Math.abs(d.x)>EDGE+20||Math.abs(d.z)>EDGE+20)continue;
    const q=(d.r-Math.hypot(x-d.x,z-d.z))/d.r;
    if(q>best)best=q;
  }
  return best;
}
function biomeRegionAt(x,z){
  if(!BIOME_REGIONS||!BIOME_REGIONS.length)return null;
  const phase=(BIOME_REGION_SEED%100000)*.0001;
  const wx=x+Math.sin(z*.024+phase+Math.sin(x*.013)*.8)*20;
  const wz=z+Math.sin(x*.022-phase+Math.cos(z*.014)*.8)*20;
  let first=null,d1=Infinity,d2=Infinity;
  for(const region of BIOME_REGIONS){
    const d=Math.hypot(wx-region.x,wz-region.z);
    if(d<d1){d2=d1;d1=d;first=region}
    else if(d<d2)d2=d;
  }
  return first?{biome:first.biome,margin:d2-d1}:null;
}
function makeOceanZone(seed,biomes){
  RIVER_MOUTH=null;
  if(!(biomes||[]).includes(10)){OCEAN_ZONE=null;return}
  const rng=mulberry32(((seed>>>0)^0xc2b2ae35)>>>0);
  OCEAN_ZONE={side:['west','east','north','south'][Math.floor(rng()*4)],phase:rng()*TAU};
  if(OCEAN_ZONE.side==='west'||OCEAN_ZONE.side==='east'){
    const z=clamp(Math.sin(OCEAN_ZONE.phase+.7)*HALF*.38,-EDGE+20,EDGE-20);
    const boundary=oceanBoundaryAt(0,z);
    const mouthX=OCEAN_ZONE.side==='west'?boundary-3:-boundary+3;
    const sourceX=riverX(z);
    RIVER_MOUTH={z,minX:Math.min(sourceX,mouthX),maxX:Math.max(sourceX,mouthX)};
  }
}
function riverClosestPoint(x,z){
  let point={x:riverX(z),z};
  let best=Math.abs(x-point.x);
  if(RIVER_MOUTH){
    const mouthX=clamp(x,RIVER_MOUTH.minX,RIVER_MOUTH.maxX);
    const distance=Math.hypot(x-mouthX,z-RIVER_MOUTH.z);
    if(distance<best){point={x:mouthX,z:RIVER_MOUTH.z};best=distance}
  }
  return point;
}
function riverBridgeYaw(x,z){
  if(RIVER_MOUTH&&z>=RIVER_MOUTH.z-RIVER.width*2&&z<=RIVER_MOUTH.z+RIVER.width*2&&x>=RIVER_MOUTH.minX-4&&x<=RIVER_MOUTH.maxX+4)return Math.PI/2;
  return Math.atan((riverX(z+2)-riverX(z-2))/4);
}
function oceanBoundaryAt(x,z){
  if(!OCEAN_ZONE)return null;
  const along=OCEAN_ZONE.side==='west'||OCEAN_ZONE.side==='east'?z:x;
  return -HALF*.42+Math.sin(along*.026+OCEAN_ZONE.phase)*Math.min(18,HALF*.075);
}
function isOcean(x,z){
  if(!OCEAN_ZONE)return false;
  const boundary=oceanBoundaryAt(x,z),side=OCEAN_ZONE.side;
  if(side==='west')return x<boundary;
  if(side==='east')return x>-boundary;
  if(side==='north')return z<boundary;
  return z>-boundary;
}
function coastDistance(x,z){
  if(!OCEAN_ZONE)return null;
  const boundary=oceanBoundaryAt(x,z),side=OCEAN_ZONE.side;
  if(side==='west')return x-boundary;
  if(side==='east')return -boundary-x;
  if(side==='north')return z-boundary;
  return -boundary-z;
}
function oceanReturnPoint(x,z){
  if(!OCEAN_ZONE)return null;
  const boundary=oceanBoundaryAt(x,z),margin=7;
  if(OCEAN_ZONE.side==='west')return {x:boundary-margin,z};
  if(OCEAN_ZONE.side==='east')return {x:-boundary+margin,z};
  if(OCEAN_ZONE.side==='north')return {x,z:boundary-margin};
  return {x,z:-boundary+margin};
}
function landReturnPoint(x,z){
  if(!OCEAN_ZONE)return null;
  const boundary=oceanBoundaryAt(x,z),margin=7;
  if(OCEAN_ZONE.side==='west')return {x:boundary+margin,z};
  if(OCEAN_ZONE.side==='east')return {x:-boundary-margin,z};
  if(OCEAN_ZONE.side==='north')return {x,z:boundary+margin};
  return {x,z:-boundary-margin};
}
function makeBiomeRegions(seed,biomes){
  const options=[...new Set((biomes||[]).filter(id=>[0,1,2,4,5,6,8,9].includes(id)))];
  if(!options.length)options.push(0);
  const width=HALF*2;
  const count=Math.max(options.length,Math.min(24,Math.round(width*width/(120*120))));
  const rng=mulberry32(((seed>>>0)^0x85ebca6b)>>>0);
  const dominant=options[Math.floor(rng()*options.length)];
  const labels=options.slice();
  const dominantTarget=Math.min(count-options.length+1,Math.max(1,Math.round(count*(.42+rng()*.12))));
  while(labels.filter(id=>id===dominant).length<dominantTarget)labels.push(dominant);
  while(labels.length<count){
    const others=options.filter(id=>id!==dominant);
    labels.push(others.length&&rng()<.72?others[Math.floor(rng()*others.length)]:dominant);
  }
  for(let i=labels.length-1;i>0;i--){
    const j=Math.floor(rng()*(i+1));[labels[i],labels[j]]=[labels[j],labels[i]];
  }
  const cols=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/cols);
  const dx=width/cols,dz=width/rows,regions=[];
  for(let i=0;i<count;i++){
    const col=i%cols,row=Math.floor(i/cols);
    const x=-HALF+(col+.5)*dx+(rng()-.5)*dx*.42;
    const z=-HALF+(row+.5)*dz+(rng()-.5)*dz*.42;
    regions.push({x:clamp(x,-EDGE+8,EDGE-8),z:clamp(z,-EDGE+8,EDGE-8),biome:labels[i]});
  }
  BIOME_REGION_SEED=seed>>>0;
  BIOME_REGIONS=regions;
}
function buildPonds(){
  PONDS=BASE_PONDS.filter(p=>Math.abs(p.x)<EDGE-6&&Math.abs(p.z)<EDGE-6)
    .filter(p=>!isOcean(p.x,p.z))
    .filter(p=>{const region=biomeRegionAt(p.x,p.z);return !region||region.biome!==8})
    .map(p=>({...p}));
  // lagoas em zonas úmidas e manchas naturalmente encharcadas
  const cand=[];
  for(let z=-EDGE+10;z<=EDGE-10;z+=6)for(let x=-EDGE+10;x<=EDGE-10;x+=6){
    const w=wetAt(x,z);
    const region=biomeRegionAt(x,z),wetland=region&&(region.biome===5||region.biome===6);
    if(w<.5&&!wetland)continue;
    if(isOcean(x,z))continue;
    if(Math.abs(x-riverX(z))<RIVER.width+9)continue;
    if(desertAt(x,z)>.2)continue;
    if(PONDS.some(p=>Math.hypot(x-p.x,z-p.z)<24))continue;
    if(MOUNTAINS.some(m=>Math.hypot(x-m.x,z-m.z)<m.r*1.15))continue;
    cand.push({x,z,w:w+(wetland ? .8 : 0),swamp:!!(region&&region.biome===6)});
  }
  cand.sort((a,b)=>b.w-a.w);
  const wetRegions=BIOME_REGIONS?BIOME_REGIONS.filter(r=>r.biome===5||r.biome===6).length:0;
  const target=Math.min(30,Math.max(10,wetRegions*6));
  let n=0;
  for(const c of cand){
    if(n>=target)break;
    if(PONDS.some(p=>Math.hypot(p.x-c.x,p.z-c.z)<24))continue;
    PONDS.push({x:c.x,z:c.z,r:8.5+(n%5)*1.3,marsh:true,swamp:c.swamp});
    n++;
  }
}
function mountH(x,z){
  let m=0;
  for(const p of MOUNTAINS){
    const d=Math.hypot(x-p.x,z-p.z);
    if(d<p.r){const t=1-d/p.r;m=Math.max(m,p.h*t*t*(1+.06*Math.sin(x*.55)*Math.cos(z*.47)))}
  }
  return m;
}
function hgt(x,z){
  const coast=coastDistance(x,z);
  if(coast!==null&&coast<=0){
    const depth=sm(clamp(-coast/18));
    return WATER_Y-.31-1.42*depth-.02*(.5+.5*Math.sin(x*.07+z*.043))*depth;
  }
  let h=Math.sin(x*.11+1)*Math.cos(z*.09)*1.3+Math.sin(x*.045+z*.06)*1.6;
  let w1=0,w2=0,mw1=0,mw2=0;
  for(const p of PONDS){
    const d=Math.hypot(x-p.x,z-p.z),inner=sm((p.r*1.55-d)/(p.r*1.1)),outer=sm((p.r*2.2-d)/p.r);
    if(p.marsh){mw1=Math.max(mw1,inner);mw2=Math.max(mw2,outer)}
    else{w1=Math.max(w1,inner);w2=Math.max(w2,outer)}
  }
  h=h*(1-w2)+.2*w2;
  h=h*(1-mw2)+.2*mw2;
  const wr=sm((RIVER.width+3.5-riverDist(x,z))/4.5);
  h=h*(1-wr)-1.8*wr;
  h=h*(1-w1)-1.95*w1;
  h=h*(1-mw1)-1.42*mw1+mountH(x,z)*(1-Math.max(w1,mw1));
  const dz=desertAt(x,z);
  if(dz>0)h+=Math.max(0,dz)*(.5+.3*Math.sin(x*.33+z*.21)+.18*Math.sin(x*.11-z*.27));
  if(coast!==null&&coast<14){
    const shore=1-sm(clamp(coast/14));
    h=h*(1-shore)+(WATER_Y-.15)*shore;
  }
  return h;
}
function inPond(x,z,m=1.08){for(const p of PONDS){if(Math.hypot(x-p.x,z-p.z)<p.r*m)return p}return null}
function nearestPond(x,z){let b=null,bd=1e9;for(const p of PONDS){const d=Math.hypot(x-p.x,z-p.z)-p.r;if(d<bd){bd=d;b=p}}return {p:b,d:bd}}
function inWater(x,z,m=1){return isOcean(x,z)||!!inPond(x,z,m)||inRiver(x,z,m*.9)}
const LAND_GENERATION_KINDS=new Set([
  'arvore','pinheiro','moita','flor','capim','samambaia','cogumelo_m','cogumelo_v',
  'pinha','fruta','galho','folha','raiz','pedra','monte','flor_deserto','cacto','osso',
  'junco','mushroom','cogumelo_assado','baga','baga_assada','lama'
]);
function cleanTreesFromWater(){
  if(!W)return 0;
  let removed=0;
  for(const t of W.things){
    if(t.gone||(!LAND_GENERATION_KINDS.has(t.kind)&&t.kind!=='ruina')||!inWater(t.x,t.z,1.02))continue;
    removeThing(t);removed++;
  }
  return removed;
}
const BIOME_NAMES={0:'floresta',1:'mata fechada',2:'seco',3:'montanha',4:'taiga',5:'pantanal',6:'pântano',7:'serra',8:'deserto',9:'cerrado',10:'oceano'};
const BIOME_LIST=[0,2,4,5,6,8,9,10];
let BIOME_ON={};
for(const id of [0,1,2,3,4,5,6,7,8,9,10])BIOME_ON[id]=1;
function biomeAt(x,z,h){
  const region=biomeRegionAt(x,z);
  if(h===undefined)h=hgt(x,z);
  let bm;
  if(isOcean(x,z))bm=10;
  else if(h>5.2)bm=7;
  else if(h>2.4)bm=3;
  else if(region)bm=region.biome;
  else{
    const dry=Math.sin(x*.06+1.7)*Math.cos(z*.05-.6)+.55*Math.sin((x-z)*.035+2.2);
    const wet=wetAt(x,z),dz=desertAt(x,z);
    if(dz>.46)bm=8;
    else if(z<-52&&dry<.9)bm=4;
    else if(wet>.56&&h<1.18)bm=6;
    else if(wet>.26&&h<1.75)bm=5;
    else if(dry>.95)bm=9;
    else if(dry>.55)bm=2;
    else if(dry<-.5)bm=1;
    else bm=0;
  }
  if(!BIOME_ON[bm]){
    if(bm===8||bm===9||bm===4||bm===5||bm===6)bm=BIOME_ON[2]?2:(BIOME_ON[0]?0:1);
    else if(bm===1&&!BIOME_ON[1])bm=0;
  }
  return bm;
}
function defaultCfg(){
  return {size:'medio',animals:30,wolfDays:10,wolfFirst:10,arriveEvery:0,animalCap:80,
    biomes:[0,2,4,5,6,8,9,10],species:SPECIES_ORDER.slice()};
}
function applyWorldConfig(cfg){
  cfg=Object.assign(defaultCfg(),cfg||{});
  if(!SIZES[cfg.size])cfg.size='medio';
  cfg.animals=clamp(cfg.animals|0,4,100);
  cfg.wolfDays=clamp(cfg.wolfDays|0,0,90);
  cfg.wolfFirst=clamp(cfg.wolfFirst|0,0,90);
  cfg.arriveEvery=clamp(cfg.arriveEvery|0,0,60);
  cfg.animalCap=clamp(cfg.animalCap|0,4,200);
  if(!Array.isArray(cfg.biomes)||!cfg.biomes.length)cfg.biomes=[0];
  cfg.biomes=cfg.biomes.map(Number).filter(id=>BIOME_NAMES[id]!=null);
  if(!Array.isArray(cfg.species))cfg.species=SPECIES_ORDER.slice();
  cfg.species=cfg.species.filter(s=>SP[s]);
  if(!cfg.species.length)cfg.species=SPECIES_ORDER.slice();
  if(cfg.species.some(s=>SP[s].marine))for(const spk of NEW_MARINE_SPECIES)if(!cfg.species.includes(spk))cfg.species.push(spk);
  if(cfg.species.some(s=>SP[s].marine)&&!cfg.biomes.includes(10))cfg.biomes.push(10);
  const sz=SIZES[cfg.size];
  GN=sz.gn;CELL=2;HALF=GN*CELL/2;EDGE=HALF-4;
  for(const id of [0,1,2,3,4,5,6,7,8,9,10])BIOME_ON[id]=id===3||id===7||id===0?1:0;
  for(const id of cfg.biomes)BIOME_ON[id]=1;
  BIOME_ON[1]=BIOME_ON[1]||BIOME_ON[0];
  MOUNTAINS.length=0;
  for(const m of BASE_MOUNTAINS)if(Math.abs(m.x)<EDGE-2&&Math.abs(m.z)<EDGE-2)MOUNTAINS.push(m);
  if(GN>=256)for(const m of EXTRA_MOUNTAINS)MOUNTAINS.push(m);
  CFG=cfg;
  BIOME_REGIONS=null;
  OCEAN_ZONE=null;
  RIVER_MOUTH=null;
  buildPonds();
  return CFG;
}
let CFG=null;
function loadCfg(){
  try{const raw=localStorage.getItem(CFG_KEY);if(raw)return JSON.parse(raw)}catch(err){}
  return null;
}
function saveCfg(cfg){try{localStorage.setItem(CFG_KEY,JSON.stringify(cfg))}catch(err){}}
function sizeForGN(gn){for(const k in SIZES)if(SIZES[k].gn===gn)return k;return 'medio'}

const NEEDS=['fome','sede','energia','calor','saude','social'];
const NEED_W={fome:1.5,sede:1.6,energia:1.0,calor:1.3,saude:3.0,social:.7};
const NEED_PT={fome:'fome',sede:'sede',energia:'energia',calor:'calor',saude:'saúde',social:'companhia'};

/* Tipos de coisa. d = como o bicho enxerga antes de ter nome. g = tradução para a HUD. */
const K={
 arvore:{g:'árvore',d:'uma coisa enorme, marrom embaixo e verde em cima',v:['sacudir','roer']},
 pinheiro:{g:'pinheiro',d:'uma coisa alta, escura e pontuda lá em cima',v:['sacudir','roer']},
 pinha:{g:'pinha',d:'uma bolinha dura e cheirosa',v:['provar','pegar'],food:1,smell:1,item:1},
 flor:{g:'flor',d:'uma coisinha colorida e cheirosa',v:['provar','pegar'],smell:2,item:1},
 capim:{g:'capim',d:'um punhado de folhas compridas e verdes',v:['provar','pegar'],item:1},
 samambaia:{g:'samambaia',d:'uma moita de folhas compridas curvadas',v:['pegar','provar'],item:1},
 computador:{g:'um computador',d:'uma caixa com uma tela acesa, cheia de letrinhas',v:['olhar','apertar','pesquisar']},
 mural:{g:'um mural',d:'uma parede lisa e escura, cheia de riscos',v:['desenhar','escrever']},
 quadro:{g:'um quadro',d:'uma tábua clara onde dá pra rabiscar',v:['desenhar','escrever']},
 peixe:{g:'peixe',d:'uma coisa prateada que escorrega na água',v:['provar','pegar'],food:1,smell:1,item:1},
 bagre:{g:'bagre',d:'um peixe gordo de bigodes compridos e pele grossa',v:['provar','pegar'],food:1,smell:1,item:1},
 alga:{g:'alga',d:'uma planta aquática verde, macia e cheia de folhas',v:['provar','pegar'],food:1,item:1},
 concha:{g:'concha',d:'uma concha dura que esconde um pedacinho de comida',v:['provar','pegar'],food:1,item:1},
 coral:{g:'coral',d:'um pequeno recife colorido preso ao fundo',v:['olhar']},
 fruta:{g:'fruta',d:'uma bolinha doce e suculenta',v:['provar','pegar'],food:1,smell:2,item:1},
 junco:{g:'junco',d:'um punhado de folhas altas e molhadas',v:['provar','pegar'],food:1,item:1},
 vitoria:{g:'vitória-régia',d:'uma folha grande e redonda boiando',v:['pegar'],item:1},
 moita:{g:'moita de bagas',d:'uma moita com bolinhas vermelhas',v:['provar','pegar'],food:1,smell:1,flam:.4},
 baga:{g:'baga',d:'uma bolinha vermelha',v:['provar'],food:1,item:1},
 baga_assada:{g:'baga assada',d:'uma bolinha vermelha, quentinha',v:['provar'],food:1,item:1},
 cogumelo_m:{g:'cogumelo marrom',d:'uma coisa baixinha de chapéu marrom',v:['provar','pegar'],food:1,smell:1,item:1},
 cogumelo_v:{g:'cogumelo vermelho',d:'uma coisa baixinha de chapéu vermelho',v:['provar','pegar'],food:1,smell:1,item:1},
 cogumelo_assado:{g:'cogumelo assado',d:'uma coisa de chapéu escuro, quentinha',v:['provar'],food:1,item:1},
 raiz:{g:'raiz',d:'uma coisa grossa e crocante',v:['provar','pegar'],food:1,item:1},
 minhoca:{g:'minhoca',d:'uma coisa mole e comprida que se mexe',v:['provar','pegar'],food:1,item:1},
 galho:{g:'galho',d:'um pedaço fino de madeira',v:['pegar','provar'],item:1,flam:.9},
 tronco:{g:'tronco',d:'um pedaço grosso de madeira',v:['pegar','provar'],item:1,flam:.8},
 pedra:{g:'pedra',d:'uma coisa dura e cinza',v:['pegar','provar'],item:1},
 folha:{g:'folha',d:'uma coisa verde, chata e leve',v:['pegar','provar'],item:1,flam:.9},
 lama:{g:'lama',d:'um chão molhado e marrom',v:['pegar','provar'],item:1},
 cubinho:{g:'cubinho marrom',d:'um cubinho marrom e duro',v:['pegar','provar'],item:1},
 machado:{g:'machado',d:'um galho com uma pedra grudada',v:['pegar'],item:1},
 curativo:{g:'curativo de lama e folha',d:'uma pasta verde e marrom',v:['provar','pegar'],item:1},
 monte:{g:'montinho de terra',d:'um montinho de terra fofa',v:['cavar'],smell:1},
 agua:{g:'água',d:'um chão que brilha e se mexe',v:['provar','pescar']},
 fogo:{g:'fogo',d:'uma coisa laranja que dança e queima',v:['ficar']},
 pilha:{g:'montinho de coisas',d:'um montinho de coisas empilhadas',v:[],flam:.9},
 abrigo:{g:'abrigo',d:'um montinho alto de galhos com folhas',v:['ficar'],flam:.9},
 toca:{g:'toca',d:'um buraco fundo no chão',v:['ficar']},
 represa:{g:'represa',d:'uma parede de galhos e lama na beira da água',v:['ficar','provar','pescar']},
 poco:{g:'poço',d:'um buraco fundo forrado de pedra com água lá no fundo',v:['provar','olhar','ficar']},
 plantacao:{g:'plantação',d:'fileiras de folhas novas que alguém cuidou',v:['colher','olhar']},
 marco:{g:'marco de pedras',d:'uma pilha alta de pedras',v:['ficar']},
 cabana:{g:'cabana',d:'uma casa alta de galhos coberta de folhas',v:['ficar'],flam:.9},
 casa:{g:'casa',d:'um abrigo construído, com paredes e teto',v:['ficar']},
 ponte:{g:'ponte',d:'uma passagem de madeira por cima da água',v:['ficar']},
 torre:{g:'torre',d:'uma torre alta de pedras empilhadas',v:['ficar']},
 celeiro:{g:'celeiro',d:'um monte oco de madeira e lama',v:['ficar'],flam:.8},
 caverna:{g:'caverna',d:'um buraco escuro e fundo na pedra',v:['olhar','ficar']},
 minerio:{g:'minério',d:'uma pedra com veios que brilham',v:['olhar','minerar'],item:1},
 mineral:{g:'mineral',d:'um pedaço de pedra brilhante',v:['provar','pegar'],item:1},
 picareta:{g:'picareta',d:'um cabo com uma ponta de pedra afiada',v:['pegar','minerar'],item:1},
 couro:{g:'couro',d:'uma pele grossa e flexível',v:['pegar','provar'],item:1},
 roupa:{g:'roupa de couro',d:'uma coisa macia que cobre o corpo',v:['pegar'],item:1},
 armadura:{g:'armadura de couro e bronze',d:'placas duras presas numa pele grossa',v:['pegar'],item:1},
 bronze:{g:'bronze',d:'um metal amarelado que brilha',v:['pegar','provar'],item:1},
 lanca:{g:'lança',d:'um cabo comprido com ponta de bronze',v:['pegar'],item:1},
 cerca:{g:'cerca de estacas',d:'estacas pontudas cercando um pedaço de chão',v:['ficar']},
 totem:{g:'totem',d:'um tronco alto cheio de marcas e oferendas',v:['olhar','ficar','rezar']},
 portao:{g:'portão de estacas',d:'duas estacas altas com uma trava que abre e fecha',v:['olhar','ficar']},
 ruina:{g:'ruína antiga',d:'pedras caídas com riscos estranhos gravados',v:['olhar','decifrar','ficar']},
 cacto:{g:'cacto',d:'uma coisa verde e espinhenta, dura como pedra',v:['provar','pegar'],food:1,item:1},
 osso:{g:'osso branco',d:'um pedaço branco e seco que o sol deixou',v:['pegar','olhar'],item:1},
 flor_deserto:{g:'flor do deserto',d:'uma flor pequena e rosa que nasce na areia',v:['provar','pegar'],smell:1,item:1},
 lobo:{g:'lobo',d:'um bicho grande, cinzento e de olhos amarelos',v:['olhar','ficar']},
};
const AQUATIC_THINGS=new Set(['peixe','bagre','alga','concha','vitoria','coral','minerio']);
const VERBG={provar:'provar',pegar:'pegar',sacudir:'sacudir a árvore',roer:'roer madeira',cavar:'cavar',ficar:'ficar perto',dormir:'dormir',conversar:'conversar',faiscar:'bater pedras',empilhar:'empilhar',cozinhar:'esquentar comida',combinar:'juntar coisas',olhar:'olhar',apertar:'apertar',desenhar:'desenhar',escrever:'escrever',pesquisar:'pesquisar',minerar:'minerar',rezar:'rezar',decifrar:'decifrar',pescar:'pescar',colher:'colher'};
const VERB_ING={provar:'provando',pegar:'pegando',sacudir:'sacudindo',roer:'roendo',cavar:'cavando',ficar:'descansando',dormir:'dormindo',conversar:'conversando',faiscar:'batendo pedras',empilhar:'empilhando',cozinhar:'esquentando comida',combinar:'juntando coisas',largar:'largando',olhar:'olhando',apertar:'apertando',desenhar:'desenhando',escrever:'escrevendo',pesquisar:'pesquisando',minerar:'minerando',rezar:'rezando',decifrar:'decifrando os riscos',pescar:'pescando',colher:'colhendo'};

const SP={
 castor:{label:'Castor',col:'#8a5a3c',vis:11,smell:5,speed:2.1,curio:.6,dig:.5,gnaw:1,soc:.5,cap:2,tough:1,swim:1,pref:{peixe:1.3,alga:.8}},
 guaxinim:{label:'Guaxinim',col:'#8a929c',vis:12,smell:6,speed:2.5,curio:1,dig:.4,gnaw:.2,soc:.6,cap:2,tough:1,pref:{peixe:1.6,fruta:1.2}},
 toupeira:{label:'Toupeira',col:'#5a5f78',vis:5,smell:11,speed:1.8,curio:.7,dig:1,gnaw:.1,soc:.3,cap:1,tough:1},
 marmota:{label:'Marmota',col:'#c09560',vis:11,smell:6,speed:2.0,curio:.5,dig:.8,gnaw:.3,soc:.95,cap:1,tough:1},
 vombate:{label:'Vombate',col:'#7a6c5f',vis:9,smell:6,speed:1.7,curio:.45,dig:.9,gnaw:.2,soc:.4,cap:1,tough:.6},
 porco_espinho:{label:'Porco-espinho',col:'#6b5a48',vis:9,smell:7,speed:1.7,curio:.65,dig:.6,gnaw:.4,soc:.35,cap:2,tough:1.5},
 porco_india:{label:'Porco-da-índia',col:'#c8a97e',vis:11,smell:5,speed:2.3,curio:.9,dig:.3,gnaw:.1,soc:.9,cap:1,tough:.7},
 esquilo:{label:'Esquilo',col:'#b06a3e',vis:13,smell:5,speed:2.9,curio:1,dig:.2,gnaw:.6,soc:.7,cap:2,tough:.7},
 nutria:{label:'Nútria',col:'#7a5a3c',vis:10,smell:6,speed:2.2,curio:.7,dig:.2,gnaw:.3,soc:.8,cap:1,tough:.8,swim:1,pref:{peixe:1.5,junco:1.4,alga:1.25}},
 cuica:{label:'Cuíca',col:'#9a7a5a',vis:10,smell:7,speed:2.8,curio:.9,dig:.3,gnaw:.2,soc:.6,cap:2,tough:.5,pref:{fruta:1.4,minhoca:1.3}},
 capivara:{label:'Capivara',col:'#8a6a4a',vis:11,smell:6,speed:1.9,curio:.5,dig:.2,gnaw:.5,soc:.95,cap:1,tough:1.2,swim:1,sz:1.3,pref:{junco:1.6,capim:1.4,alga:.8}},
 pug:{label:'Pug',col:'#c9a878',vis:12,smell:7,speed:2.6,curio:.8,dig:.4,gnaw:.2,soc:.9,cap:2,tough:1,pred:1,sz:.95,pref:{peixe:1.3}},
 besouro_rinoceronte:{label:'Besouro-rinoceronte',col:'#4a3a2a',vis:8,smell:6,speed:1.5,curio:.6,dig:.6,gnaw:.1,soc:.3,cap:2,tough:1.2,sz:.55},
 serra_pau:{label:'Serra-pau',col:'#6b5232',vis:9,smell:5,speed:1.6,curio:.5,dig:.9,gnaw:.2,soc:.3,cap:1,tough:1,sz:.62},
 sapo:{label:'Sapo',col:'#5f8a3a',vis:9,smell:7,speed:1.8,curio:.7,dig:.2,gnaw:.05,soc:.5,cap:1,tough:.6,swim:1,sz:.75,pref:{peixe:1.4,minhoca:1.5,alga:.75}},
 besouro_tartaruga:{label:'Besouro-tartaruga',col:'#7a8a3a',vis:8,smell:5,speed:1.4,curio:.6,dig:.3,gnaw:.1,soc:.4,cap:2,tough:1.4,sz:.55},
 cigarra_bola:{label:'Cigarra-bola',col:'#c8a03a',vis:10,smell:4,speed:1.7,curio:.5,dig:.1,gnaw:.05,soc:.4,cap:1,tough:.4,sz:.5},
 rola_bosta:{label:'Rola-bosta',col:'#3a3a2e',vis:7,smell:9,speed:1.5,curio:.6,dig:.7,gnaw:.05,soc:.3,cap:1,tough:.7,sz:.55},
 prea:{label:'Preá',col:'#a08050',vis:11,smell:6,speed:2.7,curio:.8,dig:.4,gnaw:.2,soc:.8,cap:1,tough:.6,pref:{capim:1.4}},
 lontra:{label:'Lontra',col:'#6a5240',vis:11,smell:7,speed:2.7,curio:1,dig:.3,gnaw:.2,soc:.7,cap:1,tough:.9,swim:1,pref:{peixe:2,fruta:1.6,alga:.8}},
 joaninha:{label:'Joaninha',col:'#c8402a',vis:9,smell:4,speed:1.6,curio:.6,dig:.1,gnaw:.05,soc:.5,cap:1,tough:.4,sz:.5,herb:1},
 besouro_fungo:{label:'Besouro dos fungos',col:'#6a5a8a',vis:8,smell:8,speed:1.4,curio:.7,dig:.2,gnaw:.1,soc:.4,cap:2,tough:.8,sz:.55,pref:{cogumelo_m:1.8,cogumelo_v:1.2}},
 tatu:{label:'Tatu',col:'#8a7a56',vis:10,smell:7,speed:1.9,curio:.6,dig:1,gnaw:.2,soc:.45,cap:2,tough:1.1,sz:.9,pref:{minhoca:1.5,raiz:1.3}},
 coruja:{label:'Coruja',col:'#9a8a72',vis:16,smell:5,speed:2.1,curio:.75,dig:.1,gnaw:.05,soc:.55,cap:1,tough:.8,sz:.85,pref:{minhoca:1.4,fruta:1.1}},
 cotia:{label:'Cutia',col:'#a86a3a',vis:12,smell:6,speed:2.8,curio:.9,dig:.3,gnaw:.35,soc:.75,cap:2,tough:.7,pref:{fruta:1.4,pinha:1.5}},
 // bichos do deserto
 calango:{label:'Calango',col:'#b0924a',vis:13,smell:5,speed:3.0,curio:.9,dig:.3,gnaw:.05,soc:.4,cap:2,tough:.6,sz:.7,dry:1,pref:{flor_deserto:1.3}},
 cascavel:{label:'Cascavel',col:'#a08a62',vis:9,smell:7,speed:1.6,curio:.5,dig:.1,gnaw:.05,soc:.25,cap:1,tough:1.1,sz:.75,dry:1,pred:1},
 escorpiao:{label:'Escorpião',col:'#5a4630',vis:6,smell:6,speed:1.5,curio:.4,dig:.5,gnaw:.05,soc:.2,cap:1,tough:1.3,sz:.55,dry:1},
 feneco:{label:'Feneco',col:'#d8bc8c',vis:14,smell:8,speed:2.9,curio:1,dig:.7,gnaw:.1,soc:.6,cap:2,tough:.7,sz:.75,dry:1,pred:1,pref:{osso:1.1}},
 camelo:{label:'Camelo',col:'#c8a76a',vis:14,smell:7,speed:2.0,curio:.5,dig:.2,gnaw:.2,soc:.8,cap:2,tough:1.6,sz:1.55,dry:1,pref:{cacto:2,capim:1.3}},
 // mais bichos da mata, do campo e da água
 paca:{label:'Paca',col:'#a5713f',vis:11,smell:7,speed:2.4,curio:.8,dig:.5,gnaw:.4,soc:.6,cap:1,tough:.8,pref:{fruta:1.5,raiz:1.2}},
 tamandua:{label:'Tamanduá',col:'#b09a78',vis:9,smell:9,speed:1.7,curio:.7,dig:.6,gnaw:.1,soc:.5,cap:1,tough:1.0,pref:{minhoca:1.8}},
 garca:{label:'Garça',col:'#e8e4d8',vis:15,smell:5,speed:2.2,curio:.7,dig:.1,gnaw:.05,soc:.55,cap:1,tough:.6,swim:1,sz:.9,pref:{peixe:2}},
 jaguatirica:{label:'Jaguatirica',col:'#d59a3d',vis:13,smell:8,speed:3.1,curio:.8,dig:.2,gnaw:.2,soc:.45,cap:2,tough:1.2,pred:1,pref:{peixe:1.4}},
 caranguejo:{label:'Caranguejo',col:'#df8a2e',vis:8,smell:6,speed:1.7,curio:.55,dig:.4,gnaw:.2,soc:.35,cap:2,tough:1.2,swim:1,marine:1,sz:.72,pref:{alga:1.2,concha:1.5}},
 camarao:{label:'Camarão',col:'#e86d81',vis:9,smell:6,speed:2.2,curio:.7,dig:.1,gnaw:.1,soc:.55,cap:1,tough:.6,swim:1,marine:1,sz:.48,pref:{alga:1.5,peixe:1.1}},
 camarao_pistola:{label:'Camarão-pistola',col:'#27a99a',vis:9,smell:7,speed:2.0,curio:.7,dig:.4,gnaw:.15,soc:.35,cap:1,tough:.85,swim:1,marine:1,sz:.58,pref:{alga:1.1,concha:1.5,peixe:1.1}},
 lagosta:{label:'Lagosta',col:'#b6293d',vis:8,smell:7,speed:1.5,curio:.55,dig:.45,gnaw:.3,soc:.3,cap:2,tough:1.5,swim:1,marine:1,sz:.95,pref:{concha:1.7,alga:1.1,peixe:1.2}},
 lagosta_boxeadora:{label:'Lagosta-boxeadora',col:'#9561c9',vis:10,smell:7,speed:2.3,curio:.8,dig:.2,gnaw:.2,soc:.3,cap:1,tough:1.0,swim:1,marine:1,pred:1,sz:.68,pref:{concha:1.4,peixe:1.5}},
 polvo:{label:'Polvo',col:'#b266a2',vis:14,smell:8,speed:2.1,curio:1.2,dig:.2,gnaw:.4,soc:.45,cap:1,tough:.8,swim:1,marine:1,pred:1,sz:.82,pref:{concha:1.8,alga:.8,peixe:1.2}},
 lula:{label:'Lula',col:'#75c6d1',vis:15,smell:7,speed:2.8,curio:1,dig:.05,gnaw:.15,soc:.55,cap:2,tough:.7,swim:1,marine:1,pred:1,sz:.78,pref:{peixe:1.6,concha:1.1}},
 estrela_mar:{label:'Estrela-do-mar',col:'#e9a34b',vis:7,smell:8,speed:.8,curio:.5,dig:.15,gnaw:.1,soc:.25,cap:1,tough:1.2,swim:1,marine:1,sz:.7,pref:{concha:1.7,alga:1.1}},
 ourico_mar:{label:'Ouriço-do-mar',col:'#594458',vis:6,smell:7,speed:.9,curio:.4,dig:.2,gnaw:.1,soc:.2,cap:1,tough:1.5,swim:1,marine:1,sz:.62,herb:1,pref:{alga:2,concha:.6}},
 mexilhao:{label:'Mexilhão',col:'#527b78',vis:5,smell:9,speed:.55,curio:.3,dig:.05,gnaw:.05,soc:.3,cap:1,tough:1.1,swim:1,marine:1,sz:.56,pref:{alga:2,concha:.7}},
};
const NEW_MARINE_SPECIES=['polvo','lula','estrela_mar','ourico_mar','mexilhao'];
const SPECIES_ORDER=['castor','guaxinim','toupeira','marmota','vombate','porco_espinho','porco_india','esquilo','nutria','cuica','capivara','pug','besouro_rinoceronte','serra_pau','sapo','besouro_tartaruga','cigarra_bola','rola_bosta','prea','lontra','joaninha','besouro_fungo','tatu','coruja','cotia','calango','cascavel','escorpiao','feneco','camelo','paca','tamandua','garca','jaguatirica','caranguejo','camarao','camarao_pistola','lagosta','lagosta_boxeadora','polvo','lula','estrela_mar','ourico_mar','mexilhao'];
const DESERT_SPECIES=['calango','cascavel','escorpiao','feneco','camelo'];
const WETLAND_SPECIES=['castor','nutria','capivara','sapo','lontra','garca'];
const COLD_BIOME_SPECIES=['serra_pau','besouro_fungo'];

function speciesBiomeMatches(spk,bm){
  if(SP[spk]&&SP[spk].marine)return bm===10;
  if(SP[spk]&&SP[spk].dry)return bm===8;
  if(WETLAND_SPECIES.includes(spk))return bm===0||bm===1||bm===5||bm===6;
  if(spk==='jaguatirica')return bm===0||bm===1||bm===2||bm===5||bm===6||bm===9;
  if(COLD_BIOME_SPECIES.includes(spk))return bm===0||bm===1||bm===2||bm===4||bm===9;
  return bm===0||bm===1||bm===2||bm===4||bm===5||bm===6||bm===9;
}
function biomeAreaWeights(cells){
  const counts=Array(11).fill(0);
  for(const c of cells)if(counts[c.bm]!=null)counts[c.bm]++;
  const total=counts.reduce((sum,n)=>sum+n,0)||1;
  return counts.map(n=>n/total);
}
function speciesBiomeWeight(spk,areas,dominant){
  let weight=0;
  if(SP[spk]&&SP[spk].marine)weight=areas[10]*2;
  else if(SP[spk]&&SP[spk].dry)weight=areas[8]*1.4;
  else if(WETLAND_SPECIES.includes(spk))weight=areas[0]*.15+areas[1]*.15+areas[5]+areas[6];
  else if(spk==='jaguatirica')weight=areas[0]+areas[1]+areas[2]+areas[5]+areas[6]+areas[9];
  else if(COLD_BIOME_SPECIES.includes(spk))weight=areas[0]*.2+areas[1]*.4+areas[2]*.2+areas[4]+areas[9]*.2;
  else weight=areas[0]+areas[1]+areas[2]+areas[4]+areas[5]+areas[6]+areas[9];
  return weight+(speciesBiomeMatches(spk,dominant)? .25 : 0);
}
function dominantBiomeId(cells){
  const counts=Array(11).fill(0);
  for(const c of cells)if(counts[c.bm]!=null)counts[c.bm]++;
  let best=0;
  for(let i=1;i<counts.length;i++)if(counts[i]>counts[best])best=i;
  return best;
}

let W=null, V=null, UI=null;   // mundo, view 3D, HUD

function daylight(){ const d=clamp(.5-.62*Math.cos(TAU*W.t/W.dayLen)); return W.rain>0?d*.7:d; }
function ambient(){ return .16+.62*daylight(); }
function clockStr(){ const h=((W.t/W.dayLen)*24)%24; const hh=Math.floor(h),mm=Math.floor((h-hh)*60); return String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0'); }
function dayNum(){ return Math.floor(W.t/W.dayLen)+1; }

const cellAt=(x,z)=>{const ix=Math.floor((x+HALF)/CELL),iy=Math.floor((z+HALF)/CELL);if(ix<0||iy<0||ix>=GN||iy>=GN)return null;return W.cells[iy*GN+ix]};

function addThing(kind,x,z,data={}){const t={id:W.nid++,kind,x,z,data,gone:false};W.things.push(t);W.byId[t.id]=t;V&&V.onAdd(t);return t}
function removeThing(t){if(t.gone)return;t.gone=true;delete W.byId[t.id];V&&V.onRemove(t)}
function liveThings(){return W.things.filter(t=>!t.gone)}

/* saves antigos podem não ter o objeto "agua" de cada lagoa; sem ele ninguém bebe ali */
function ensureWaterThings(){
  for(const p of PONDS){
    const has=W.things.some(t=>!t.gone&&t.kind==='agua'&&Math.hypot(t.x-p.x,t.z-p.z)<2.5);
    if(!has)addThing('agua',p.x,p.z,{r:p.r,pond:p});
  }
  let riverN=0;for(const t of W.things)if(!t.gone&&t.kind==='agua'&&!t.data.pond)riverN++;
  if(riverN<10)for(let z=-HALF+12;z<=HALF-12;z+=24){
    const x=riverX(z);
    if(W.things.some(t=>!t.gone&&t.kind==='agua'&&Math.hypot(t.x-x,t.z-z)<5))continue;
    addThing('agua',x,z,{r:RIVER.width*1.05});
  }
  if(!W.things.some(t=>!t.gone&&t.kind==='bagre')){
    for(const p of PONDS){
      const an=rnd(0,TAU),d=p.r*rnd(.25,.7);
      addThing('bagre',p.x+Math.cos(an)*d,p.z+Math.sin(an)*d,{ph:rnd(0,TAU)});
    }
  }
}

function freePos(){
  for(let i=0;i<50;i++){
    const x=rnd(-EDGE,EDGE),z=rnd(-EDGE,EDGE);
    if(isOcean(x,z)||inWater(x,z,1.08))continue;
    let ok=true;for(const p of PONDS)if(Math.hypot(x-p.x,z-p.z)<p.r*1.6)ok=false;
    if(inRiver(x,z,1.5))ok=false;
    if(ok)return {x,z};
  }
  return {x:0,z:0};
}
function marineSpawnPoint(){
  const cells=W&&W.oceanCells||[];
  if(!cells.length)return null;
  const c=pick(cells);
  return {x:c.cx+rnd(-.65,.65),z:c.cz+rnd(-.65,.65)};
}

function seedAquaticHabitats(){
  if(W.aquaticHabitatV>=1)return;
  const countKind=(kind,test)=>W.things.reduce((n,t)=>n+(!t.gone&&t.kind===kind&&(!test||test(t))?1:0),0);
  const sea=W.oceanCells||[];
  const shallowSea=sea.filter(c=>{const d=coastDistance(c.cx,c.cz);return d!==null&&d<=-5&&d>=-58});
  const deeperSea=sea.filter(c=>{const d=coastDistance(c.cx,c.cz);return d!==null&&d<=-14});
  const addOceanKind=(kind,target,cells,data)=>{
    let count=countKind(kind,t=>isOcean(t.x,t.z));
    for(let i=0;count<target&&i<target*12&&cells.length;i++){
      const c=pick(cells);
      addThing(kind,c.cx+rnd(-.65,.65),c.cz+rnd(-.65,.65),data?data():{});
      count++;
    }
  };
  if(sea.length){
    addOceanKind('peixe',54,sea,()=>({ph:rnd(0,TAU)}));
    addOceanKind('alga',90,shallowSea.length?shallowSea:sea,()=>({ph:rnd(0,TAU)}));
    addOceanKind('concha',38,shallowSea.length?shallowSea:sea,()=>({}));
    let reefs=countKind('coral',t=>isOcean(t.x,t.z));
    for(let tries=0;reefs<36&&tries<180&&shallowSea.length;tries++){
      const c=pick(shallowSea);
      if(W.things.some(t=>!t.gone&&t.kind==='coral'&&Math.hypot(t.x-c.cx,t.z-c.cz)<16))continue;
      const patch=Math.min(6,36-reefs);
      for(let i=0;i<patch;i++){
        const a=rnd(0,TAU),d=rnd(.3,4.2),x=c.cx+Math.cos(a)*d,z=c.cz+Math.sin(a)*d;
        if(!isOcean(x,z))continue;
        addThing('coral',x,z,{sc:rnd(.8,1.35),hue:rint(0,3)});
        reefs++;
      }
    }
    let ore=countKind('minerio',t=>!!t.data.submerged);
    for(let i=0;ore<12&&i<120&&deeperSea.length;i++){
      const c=pick(deeperSea);
      addThing('minerio',c.cx+rnd(-.6,.6),c.cz+rnd(-.6,.6),{submerged:true});
      ore++;
    }
  }
  for(const p of PONDS){
    const target=p.marsh?(p.swamp?8:6):3;
    let algae=countKind('alga',t=>Math.hypot(t.x-p.x,t.z-p.z)<p.r*.95&&!isOcean(t.x,t.z));
    for(let i=0;algae<target&&i<target*3;i++){
      const a=rnd(0,TAU),d=p.r*rnd(.18,.78);
      addThing('alga',p.x+Math.cos(a)*d,p.z+Math.sin(a)*d,{ph:rnd(0,TAU)});
      algae++;
    }
  }
  const riverAlgae=countKind('alga',t=>!isOcean(t.x,t.z)&&inRiver(t.x,t.z));
  for(let i=riverAlgae;i<16&&i<120;i++){
    const z=rnd(-HALF+12,HALF-12);
    addThing('alga',riverX(z)+rnd(-RIVER.width*.55,RIVER.width*.55),z,{ph:rnd(0,TAU)});
  }
  W.aquaticHabitatV=1;
}

function newWorld(seed){
  R=mulberry32(seed);
  const cfg=CFG||defaultCfg();
  W={seed,t:66,dayLen:240,rain:0,nextRain:rnd(40,80),things:[],byId:{},animals:[],cells:[],burning:[],events:[],nid:1,regT:0,percT:0,
     mural:{marks:[]},quadro:{marks:[]},
     tribes:[],tribeNid:1,wolves:[],wolfNid:1,langEvents:[],
     wolfEvery:cfg.wolfDays||0,wolfFirst:cfg.wolfFirst||0,
     arriveEvery:cfg.arriveEvery|0,animalCap:cfg.animalCap||80,arriveNext:0,arrivals:0,
     songs:[],songT:rnd(70,140),
     crisis:{nextDay:cfg.wolfFirst>0?cfg.wolfFirst:1e9,phase:'none',raidEnd:0,decision:null,history:[]},
     snow:0,flood:0,yearLen:16,crisisT:0,tribeT:12,
     weather:{kind:'limpo',until:0,next:rnd(50,110)},
     stats:{fires:0,words:0,inventions:0,trees:0,mixes:0,tribes:0,crises:0,sacrifices:0,rituals:0,floods:0,winters:0,weather:0},
     names:new Set(),words:new Set(),inventions:[],aquaticHabitatV:0};
  W.campaign={completed:[],era:0,nextStory:W.t+W.dayLen*2,stories:[]};
  W.biomeMapV=2;
  makeBiomeRegions(seed,cfg.biomes);
  makeOceanZone(seed,cfg.biomes);
  buildPonds();
  W.arriveNext=W.arriveEvery>0?dayNum()+W.arriveEvery:1e9;
  for(let iy=0;iy<GN;iy++)for(let ix=0;ix<GN;ix++){
    const cx=-HALF+ix*CELL+CELL/2,cz=-HALF+iy*CELL+CELL/2;
    const h0=hgt(cx,cz);
    const pnd=isOcean(cx,cz)||inPond(cx,cz,1.12)||inRiver(cx,cz,1.15);
    W.cells.push({ix,iy,cx,cz,st:pnd?4:0,f:pnd?0:rnd(.55,1),bt:0,digs:0,rg:0,sh:R(),h:h0,bm:biomeAt(cx,cz,h0),tb:0});
  }
  W.oceanCells=W.cells.filter(c=>c.bm===10&&c.st===4);
  W.dominantBiome=dominantBiomeId(W.cells);
  addThing('computador',0,0,{});
  addThing('mural',-6,5,{});
  addThing('quadro',7,-5,{});
  placeMountainFeatures();
  placeRuins();
  // bosques
  for(let c=0;c<34;c++){const o=freePos();const n=rint(5,11);
    for(let i=0;i<n;i++){const a=rnd(0,TAU),d=rnd(1,10);const x=o.x+Math.cos(a)*d,z=o.z+Math.sin(a)*d;
      if(Math.abs(x)>EDGE-1||Math.abs(z)>EDGE-1||inWater(x,z,1.7))continue;
      if(Math.hypot(x,z)<11)continue;
      const bm=biomeAt(x,z,hgt(x,z));
      if(bm===7||bm===8)continue;
      addThing((bm===2||bm===4)&&R()<.7?'pinheiro':'arvore',x,z,{br:3,rg:0,sc:rnd(.85,1.35),burn:0});}}
  for(let i=0;i<44;i++){const p=freePos();if(Math.hypot(p.x,p.z)<11)continue;
    const bm=biomeAt(p.x,p.z,hgt(p.x,p.z));
    if(bm===7||bm===8)continue;
    addThing(bm===2||bm===4?'pinheiro':'arvore',p.x,p.z,{br:3,rg:0,sc:rnd(.85,1.3),burn:0})}
  // taiga: pinheiros extras no norte
  for(let i=0;i<46;i++){
    const x=rnd(-EDGE+4,EDGE-4),z=rnd(-EDGE+2,-50);
    if(inWater(x,z,2)||Math.abs(x)>EDGE-2)continue;
    addThing('pinheiro',x,z,{br:3,rg:0,sc:rnd(.9,1.4),burn:0});
  }
  for(let i=0;i<95;i++){const p=freePos();if(inRiver(p.x,p.z,2.2))continue;addThing('moita',p.x,p.z,{b:rint(2,5),rg:0,burn:0})}
  const trees=W.things.filter(t=>t.kind==='arvore'||t.kind==='pinheiro');
  const pines=W.things.filter(t=>t.kind==='pinheiro');
  const nearTree=(k,count,spread,filter)=>{
    let made=0;
    const src=typeof filter==='function'?filter():(filter||trees);
    if(!src.length)return;
    for(let i=0;i<count*4&&made<count;i++){
      const tr=pick(src),a=rnd(0,TAU),d=rnd(1,spread);
      const x=tr.x+Math.cos(a)*d,z=tr.z+Math.sin(a)*d;
      if(inWater(x,z,1.3)||Math.abs(x)>EDGE||Math.abs(z)>EDGE)continue;
      addThing(k,x,z,{});made++;
    }
  };
  nearTree('cogumelo_m',40,4);nearTree('cogumelo_v',40,4);
  nearTree('pinha',64,3.2,()=>pines.length?pines:trees);
  nearTree('samambaia',64,5);
  nearTree('galho',86,3.5);nearTree('folha',86,4.5);
  nearTree('raiz',40,2.5);nearTree('fruta',50,3.2);
  for(let i=0;i<150;i++){const p=freePos();addThing('flor',p.x,p.z,{})}
  for(let i=0;i<130;i++){const p=freePos();addThing('capim',p.x,p.z,{})}
  for(let i=0;i<80;i++){const p=freePos();addThing('pedra',p.x,p.z,{})}
  for(let i=0;i<60;i++){const p=freePos();addThing('monte',p.x,p.z,{})}
  // juncos do pantanal e do pântano
  for(let i=0;i<200;i++){
    const p=freePos();
    if(wetAt(p.x,p.z)<.1&&!inWater(p.x,p.z,2.6))continue;
    if(inWater(p.x,p.z,.95))continue;
    addThing('junco',p.x,p.z,{});
  }
  // flora extra do pantanal (alagado) e do pântano (encharcado)
  for(let i=0;i<150;i++){
    const p=freePos();
    const bm=biomeAt(p.x,p.z,hgt(p.x,p.z));
    if(bm!==5&&bm!==6)continue;
    if(inWater(p.x,p.z,1.1))continue;
    const q=R();
    if(q<.32)addThing('moita',p.x,p.z,{b:rint(2,5),rg:0,burn:0});
    else if(q<.58)addThing('flor',p.x,p.z,{});
    else if(q<.78)addThing('capim',p.x,p.z,{});
    else if(q<.9)addThing('samambaia',p.x,p.z,{sc:rnd(.9,1.45)});
    else addThing(bm===6?'cogumelo_m':'cogumelo_v',p.x,p.z,{});
  }
  // mangues do pantanal e do pântano: árvores de raízes escoras
  for(let i=0;i<90;i++){
    const p=freePos();
    const bm=biomeAt(p.x,p.z,hgt(p.x,p.z));
    if(bm!==5&&bm!==6)continue;
    if(Math.abs(p.x)>EDGE-2||Math.abs(p.z)>EDGE-2)continue;
    if(inWater(p.x,p.z,1.2))continue;
    if(W.things.some(t=>!t.gone&&t.kind==='arvore'&&Math.hypot(t.x-p.x,t.z-p.z)<4.5))continue;
    addThing('arvore',p.x,p.z,{br:3,rg:0,sc:rnd(.9,1.35),burn:0,mg:1});
  }
  // flora do deserto: cactos, flores de areia e ossos que o sol deixou
  const desertCells=W.cells.filter(c=>c.bm===8&&c.st===0);
  const nearDesert=(x,z,d)=>W.things.some(t=>!t.gone&&(t.kind==='cacto'||t.kind==='pedra'||t.kind==='osso')&&Math.hypot(t.x-x,t.z-z)<d);
  let nC=Math.min(150,Math.round(desertCells.length*.09));
  for(let i=0;i<nC&&desertCells.length;i++){
    const c=pick(desertCells);
    if(inWater(c.cx,c.cz,1.1)||nearDesert(c.cx,c.cz,2.2))continue;
    const q=R();
    if(q<.45)addThing('cacto',c.cx,c.cz,{sc:rnd(.8,1.4)});
    else if(q<.7)addThing('pedra',c.cx,c.cz,{});
    else if(q<.85)addThing('flor_deserto',c.cx,c.cz,{});
    else if(q<.95)addThing('capim',c.cx,c.cz,{});
    else addThing('osso',c.cx,c.cz,{});
  }
  // cerrado: capim alto e moitas espalhadas
  const cerradoCells=W.cells.filter(c=>c.bm===9&&c.st===0);
  let nG=Math.min(140,Math.round(cerradoCells.length*.12));
  for(let i=0;i<nG&&cerradoCells.length;i++){
    const c=pick(cerradoCells);
    if(inWater(c.cx,c.cz,1.2))continue;
    if(R()<.5)addThing('capim',c.cx,c.cz,{});
    else addThing('moita',c.cx,c.cz,{b:rint(1,3),rg:0,burn:0});
  }
  for(const p of PONDS){
    addThing('agua',p.x,p.z,{r:p.r,pond:p});
    for(let i=0;i<5;i++){const a=rnd(0,TAU),d=p.r*1.32;addThing('lama',p.x+Math.cos(a)*d,p.z+Math.sin(a)*d,{patch:true})}
    for(let i=0;i<(p.marsh?(p.swamp?5:8):3);i++){const a=rnd(0,TAU),d=p.r*rnd(.35,.8);addThing('vitoria',p.x+Math.cos(a)*d,p.z+Math.sin(a)*d,{})}
    for(let i=0;i<(p.marsh?(p.swamp?4:7):4);i++){const a=rnd(0,TAU),d=p.r*rnd(.2,.9);addThing('peixe',p.x+Math.cos(a)*d,p.z+Math.sin(a)*d,{ph:rnd(0,TAU)})}
    // bagres de couro grosso nas águas mais fundas
    for(let i=0;i<(p.marsh?2:1);i++){const a=rnd(0,TAU),d=p.r*rnd(.25,.75);addThing('bagre',p.x+Math.cos(a)*d,p.z+Math.sin(a)*d,{ph:rnd(0,TAU)})}
  }
  for(let z=-HALF+8;z<=HALF-8;z+=16){
    addThing('agua',riverX(z),z,{r:RIVER.width*1.05});
    for(let i=0;i<2;i++){const a=rnd(0,TAU),d=RIVER.width+rnd(.8,2.2);addThing('lama',riverX(z)+Math.cos(a)*d,z+Math.sin(a)*d,{patch:true})}
    if(R()<.75)addThing('peixe',riverX(z)+rnd(-1.2,1.2),z+rnd(-3,3),{ph:rnd(0,TAU)});
  }
  // cachoeira
  const wx=riverX(WATERFALL.z);
  addThing('agua',wx,WATERFALL.z,{r:RIVER.width*1.15,wf:true});
  for(let i=0;i<7;i++){const a=rnd(0,TAU),d=rnd(2.6,4.2);addThing('pedra',wx+Math.cos(a)*d,WATERFALL.z+Math.sin(a)*d,{})}
  seedAquaticHabitats();
  // os bichos, cada um mais perto do seu bioma
  const chosen=(cfg.species&&cfg.species.length?cfg.species:SPECIES_ORDER).filter(sp=>SP[sp]);
  const total=clamp(cfg.animals||30,1,200);
  const areas=biomeAreaWeights(W.cells),dominant=W.dominantBiome;
  const weighted=chosen.map(sp=>({sp,weight:speciesBiomeWeight(sp,areas,dominant)}))
    .filter(x=>x.weight>.01);
  const available=weighted.length?weighted:chosen.filter(sp=>!SP[sp].marine||areas[10]>.01).map(sp=>({sp,weight:1}));
  const preferred=dominant===10?['lagosta_boxeadora']:dominant===8?['feneco','cascavel']:(dominant===5||dominant===6)?['jaguatirica']:['jaguatirica'];
  const predator=preferred.find(sp=>chosen.includes(sp)&&SP[sp]&&SP[sp].pred);
  const spawnList=[];
  if(predator&&total>0)spawnList.push(predator);
  const pool=available.filter(x=>x.sp!==predator);
  function drawFromPool(source,remove){
    if(!source.length)return null;
    const sum=source.reduce((n,x)=>n+x.weight,0);
    let roll=R()*sum;
    let i=0;
    for(;i<source.length-1;i++){roll-=source[i].weight;if(roll<0)break}
    const entry=source[i];
    if(remove)source.splice(i,1);
    return entry.sp;
  }
  while(spawnList.length<total&&pool.length)spawnList.push(drawFromPool(pool,true));
  while(spawnList.length<total)spawnList.push(drawFromPool(available,false));
  shuffle(spawnList).forEach((sp,i)=>{
    const an=i/spawnList.length*TAU+.4;
    const s=SP[sp];
    const drySp=!!s.dry;
    let p=null;
    for(let t=0;t<140&&!p;t++){
      const x=rnd(-EDGE,EDGE),z=rnd(-EDGE,EDGE);
      if(s.marine?!isOcean(x,z):inWater(x,z,.9))continue;
      const bm=biomeAt(x,z);
      if(bm===7)continue;
      if(!speciesBiomeMatches(sp,bm))continue;
      if(drySp&&bm!==8)continue;
      if(!drySp&&bm===8&&chosen.some(o=>SP[o].dry))continue;
      const wetNear=nearestPond(x,z).d<6||riverDist(x,z)<RIVER.width+4;
      if(s.swim&&!s.marine&&!wetNear)continue;
      if(WETLAND_SPECIES.includes(sp)&&!(bm===5||bm===6||wetNear))continue;
      if((sp==='pug'||sp==='prea'||sp==='cuica'||sp==='capivara'||sp==='sapo')&&!(bm===5||bm===6)&&!wetNear)continue;
      if(W.animals.some(other=>Math.hypot(x-other.x,z-other.z)<animalRadius(s)+animalRadius(other.sp)+.25))continue;
      p={x,z};
    }
    if(!p){
      const candidates=W.cells.filter(c=>speciesBiomeMatches(sp,c.bm)&&(s.marine?c.st===4:c.st===0));
      const c=candidates.length?pick(candidates):null;
      if(!c)return;
      p={x:c.cx,z:c.cz};
    }
    makeAnimal(sp,p.x,p.z);
  });
  W.animals.forEach(a=>{a.yaw=Math.atan2(-a.z,-a.x)+rnd(-.8,.8)});
  teachBoards();
  const names=[];
  for(const spk of chosen)if(!names.includes(SP[spk].label))names.push(SP[spk].label);
  ev('🌱',`${W.animals.length} bichos acordaram num mundo de ${BIOME_NAMES[W.dominantBiome]}: ${names.slice(0,6).join(', ')}${names.length>6?' e mais':''}. Nenhum sabe de nada.`);
  return W;
}

/* ruínas antigas: pedras com inscrições de um povo que já se foi */
const RUIN_SITES=[{x:-74,z:58},{x:86,z:-86},{x:4,z:-150},{x:-150,z:-20},{x:120,z:100}];
function placeRuins(){
  for(const s of RUIN_SITES){
    if(isOcean(s.x,s.z)||inWater(s.x,s.z,1.15))continue;
    if(W.things.some(t=>!t.gone&&t.kind==='ruina'&&Math.hypot(t.x-s.x,t.z-s.z)<9))continue;
    const glyphs=[];
    const cons='ptkbdgmnlrvs'.split('');
    for(let i=0;i<6;i++){
      let g='';for(let j=0;j<3;j++)g+=pick(cons)+pick(['a','e','i','o','u','ã','ô']);
      glyphs.push(g[0].toUpperCase()+g.slice(1));
    }
    addThing('ruina',s.x,s.z,{lang:'antiga',glyphs,dec:0,done:false});
    for(let i=0;i<5;i++){const an=rnd(0,TAU),d=rnd(1.6,3.8);addThing('pedra',s.x+Math.cos(an)*d,s.z+Math.sin(an)*d,{})}
  }
}

/* serra: cavernas e veios de minério nas encostas */
function placeMountainFeatures(){
  for(const m of MOUNTAINS){
    const an=Math.atan2(-m.z,-m.x),baseR=m.r*.48;
    const cx=m.x+Math.cos(an)*baseR,cz=m.z+Math.sin(an)*baseR;
    if(!W.things.some(t=>!t.gone&&t.kind==='caverna'&&Math.hypot(t.x-cx,t.z-cz)<9)){
      addThing('caverna',cx,cz,{peak:true});
      for(let i=0;i<6;i++){const a=rnd(0,TAU),d=rnd(2,7);addThing('minerio',cx+Math.cos(a)*d,cz+Math.sin(a)*d,{})}
      for(let i=0;i<12;i++){const a=rnd(0,TAU),d=rnd(2,11);addThing('pedra',cx+Math.cos(a)*d,cz+Math.sin(a)*d,{})}
    }
    for(let i=0;i<4;i++){
      const a=rnd(0,TAU),d=rnd(m.r*.3,m.r*.62);
      const x=m.x+Math.cos(a)*d,z=m.z+Math.sin(a)*d;
      if(!inWater(x,z,1.3)&&hgt(x,z)>2.2)addThing('minerio',x,z,{});
    }
  }
}

/* usado quando um save antigo abre num mapa maior: enche a área nova */
function seedExpansion(){
  placeMountainFeatures();
  placeRuins();
  const make=(k,count,test)=>{
    let n=0;
    for(let i=0;i<count*6&&n<count;i++){
      const x=rnd(-EDGE,EDGE),z=rnd(-EDGE,EDGE);
      if(inWater(x,z,1.2))continue;
      if(test&&!test(x,z))continue;
      if(k==='arvore'||k==='pinheiro')addThing(k,x,z,{br:3,rg:0,sc:rnd(.85,1.35),burn:0});
      else if(k==='moita')addThing(k,x,z,{b:rint(1,4),rg:0,burn:0});
      else addThing(k,x,z,{});
      n++;
    }
  };
  make('arvore',44);
  make('pinheiro',30,(x,z)=>z<-40);
  make('moita',60);
  make('flor',70);
  make('capim',60);
  make('fruta',28);
  make('junco',44,(x,z)=>wetAt(x,z)>.1||!!inPond(x,z,2.6));
  for(const p of PONDS){
    if(!p.marsh)continue;
    for(let i=0;i<3;i++){const a=rnd(0,TAU),d=p.r*rnd(.3,.85);addThing('vitoria',p.x+Math.cos(a)*d,p.z+Math.sin(a)*d,{})}
    for(let i=0;i<2;i++){const a=rnd(0,TAU),d=p.r*rnd(.3,.85);addThing('peixe',p.x+Math.cos(a)*d,p.z+Math.sin(a)*d,{ph:rnd(0,TAU)})}
  }
  ev('🗺️','O mapa cresceu: serra com cavernas, minério, charcos novos e mais flora por toda parte.');
}

/* saves antigos ganham o deserto (areia, cactos) e os bichos do deserto */
function ensureNewBiomes(){
  const desert=W.cells.filter(c=>c.bm===8&&c.st!==4);
  if(desert.length<20)return {desert:0,cactos:0,animals:0};
  const near=(x,z,d)=>W.things.some(t=>!t.gone&&(t.kind==='cacto'||t.kind==='pedra')&&Math.hypot(t.x-x,t.z-z)<d);
  let cactos=0,props=0;
  for(const c of desert){
    if(props>=70)break;
    if(R()<.8)continue;
    if(inWater(c.cx,c.cz,1.2)||near(c.cx,c.cz,2.4))continue;
    const q=R();
    if(q<.62){addThing('cacto',c.cx,c.cz,{sc:rnd(.85,1.35)});cactos++}
    else if(q<.85)addThing('pedra',c.cx,c.cz,{});
    else if(q<.94)addThing('flor_deserto',c.cx,c.cz,{});
    else addThing('osso',c.cx,c.cz,{});
    props++;
  }
  let animals=0;
  for(const spk of DESERT_SPECIES){
    const have=W.animals.filter(a=>a.spk===spk).length;
    for(let n=have;n<2;n++){
      const c=pick(desert);
      makeAnimal(spk,c.cx+rnd(-1.6,1.6),c.cz+rnd(-1.6,1.6));
      animals++;
    }
  }
  if(props||animals)ev('🏜️',`A floresta mudou: o <b>deserto</b> apareceu com ${props} cactos, pedras e ossos${animals?` e ${animals} bichos do deserto`:''} — lagartos, cascavéis, escorpiões, fenecos e camelos.`);
  return {desert:desert.length,cactos,props,animals};
}

/* =====================  EVENTOS / PENSAMENTOS  ===================== */
function ev(icon,html,a){const e={t:W.t,icon,html};if(a&&a.id){e.aid=a.id;e.x=a.x;e.z=a.z}W.events.push(e);if(W.events.length>160)W.events.shift();UI&&UI.onEvent&&UI.onEvent(e)}
const CAMPAIGN_ERAS=[
  {name:'Exploração',desc:'Aprender a sobreviver e encontrar companhia.'},
  {name:'Comunidade',desc:'Construir abrigos e inventar ferramentas.'},
  {name:'Conhecimento',desc:'Pesquisar o mundo e deixar registros.'},
  {name:'Cultura',desc:'Criar tradições e compartilhar histórias.'},
];
const CAMPAIGN_GOALS=[
  {id:'days',era:0,title:'Conheça os primeiros dias',hint:'Deixe a floresta passar por três dias.',target:3,value:()=>Math.min(3,Math.floor(W.t/W.dayLen))},
  {id:'tribe',era:0,title:'Forme uma comunidade',hint:'Ajude os bichos a formar a primeira tribo.',target:1,value:()=>W.tribes.length?1:0},
  {id:'shelter',era:1,title:'Construa um abrigo',hint:'Uma toca, cabana ou casa conta.',target:1,value:()=>W.things.some(t=>!t.gone&&['toca','abrigo','cabana','casa','caverna'].includes(t.kind))?1:0},
  {id:'inventions',era:1,title:'Descubra três invenções',hint:'Observe as ferramentas e soluções criadas.',target:3,value:()=>Math.min(3,W.inventions.length)},
  {id:'research',era:2,title:'Pesquise três assuntos',hint:'Acompanhe o que os bichos aprendem na internet.',target:3,value:()=>{
    const topics=new Set();for(const a of W.animals)for(const topic in (a.knowledge||{}))topics.add(topic);return Math.min(3,topics.size);
  }},
  {id:'marks',era:2,title:'Registre cinco marcas',hint:'Veja os murais e quadros da floresta.',target:5,value:()=>(W.mural.marks.length+W.quadro.marks.length)},
  {id:'song',era:3,title:'Crie uma música',hint:'Uma canção marca o começo de uma tradição.',target:1,value:()=>W.songs.length?1:0},
];
function campaignProgress(goal){return Math.min(goal.target,goal.value())}
function campaignEra(c){return CAMPAIGN_ERAS[Math.min(c.era||0,CAMPAIGN_ERAS.length-1)]}
function addCampaignStory(){
  const c=W.campaign;
  const options=[];
  if(W.dominantBiome===10||W.animals.some(a=>a.sp.marine))options.push(['🌊','Maré de descobertas','Correntes novas trazem algas e conchas para os moradores do oceano.','tide']);
  if(W.dominantBiome===8)options.push(['🏜️','Rastros na areia','O vento descobre ossos e pegadas nas dunas.','desert']);
  if((W.dominantBiome===5||W.dominantBiome===6||W.flood>.25)&&PONDS.length)options.push(['🌿','Águas em movimento','Um cardume aparece nas margens alagadas do pantanal.','wetland']);
  if(W.tribes.length>1)options.push(['🤝','Encontro entre tribos','Viajantes de comunidades diferentes se encontram e trocam histórias.','community']);
  if(W.tribes.length)options.push(['🏕️','Noite ao redor do fogo','A comunidade se reúne; uma lembrança antiga vira assunto da noite.','community']);
  if(!options.length)options.push(['🍃','Um dia de descobertas','Frutas maduras caem perto das árvores e atraem os exploradores.','forest']);
  const story=pick(options),entry={day:dayNum(),icon:story[0],title:story[1],text:story[2]};
  if(story[3]==='tide'){
    const sea=W.oceanCells||[];
    for(let i=0;i<5&&sea.length;i++){const cell=pick(sea);addThing(i<3?'alga':'concha',cell.cx+rnd(-.7,.7),cell.cz+rnd(-.7,.7),{})}
  }else if(story[3]==='desert'){
    const desert=W.cells.filter(cell=>cell.bm===8&&cell.st===0);
    for(let i=0;i<3&&desert.length;i++){const cell=pick(desert);addThing('osso',cell.cx,cell.cz,{})}
  }else if(story[3]==='wetland'&&PONDS.length){
    const pond=pick(PONDS);
    for(let i=0;i<3;i++){const angle=rnd(0,TAU),distance=pond.r*rnd(.2,.8);addThing('peixe',pond.x+Math.cos(angle)*distance,pond.z+Math.sin(angle)*distance,{ph:rnd(0,TAU)})}
  }else if(story[3]==='community'){
    const tribe=pick(W.tribes);
    for(const animal of W.animals)if(Math.hypot(animal.x-tribe.center.x,animal.z-tribe.center.z)<24)animal.n.social=clamp(animal.n.social+.12);
  }else if(story[3]==='forest'){
    const trees=W.things.filter(t=>!t.gone&&(t.kind==='arvore'||t.kind==='pinheiro'));
    if(trees.length){const tree=pick(trees);for(let i=0;i<3;i++)spawnItem('fruta',tree.x+rnd(-1,1),tree.z+rnd(-1,1))}
  }
  c.stories.push(entry);if(c.stories.length>16)c.stories.shift();
  ev(entry.icon,`<b>${entry.title}.</b> ${entry.text}`);
}
function updateCampaign(){
  if(!W.campaign)W.campaign={completed:[],era:0,nextStory:W.t+W.dayLen*2,stories:[]};
  const c=W.campaign;
  const goal=CAMPAIGN_GOALS[c.completed.length];
  if(goal&&campaignProgress(goal)>=goal.target){
    c.completed.push(goal.id);
    ev('🏅',`Objetivo concluído: <b>${goal.title}</b>.`);
    const nextEra=Math.min(CAMPAIGN_ERAS.length-1,Math.floor(c.completed.length/2));
    if(nextEra>c.era){
      c.era=nextEra;
      ev('📖',`Nova era: <b>${campaignEra(c).name}</b>. ${campaignEra(c).desc}`);
    }
  }
  if(W.t>=c.nextStory){
    addCampaignStory();
    c.nextStory=W.t+W.dayLen*rnd(2,4);
  }
}
const stripTags=s=>s.replace(/<small>.*?<\/small>/g,'').replace(/<[^>]+>/g,'');
function say(a,html,type='t'){
  const last=a.log[a.log.length-1];
  if(last&&last.html===html&&W.t-last.t<20)return;
  const e={t:W.t,html,type};a.log.push(e);if(a.log.length>160)a.log.shift();
  a.bubble={txt:stripTags(html),t:W.t};
  UI&&UI.onThought&&UI.onThought(a,e);
}
const wordHTML=(w,g)=>`<span class="w">${w}<small>${g}</small></span>`;
function gloss(key){
  if(key==='self')return 'eu';
  if(key.startsWith('k:'))return K[key.slice(2)]?K[key.slice(2)].g:key.slice(2);
  if(key.startsWith('v:'))return VERBG[key.slice(2)]||key.slice(2);
  if(key.startsWith('a:')){const o=W.animals.find(x=>x.id==key.slice(2));return o?o.sp.label.toLowerCase():'outro bicho'}
  if(key.startsWith('s:'))return 'o espírito';
  return key;
}
function ref(a,kind){const w=a.lex['k:'+kind];return w?wordHTML(w,K[kind].g):K[kind].d}
function vref(a,verb){const w=a.lex['v:'+verb];return w?wordHTML(w,VERBG[verb]):VERBG[verb]}
function nameOf(a){return a.name||('o '+a.sp.label.toLowerCase())}
function nameTag(a){return a.name?`<b>${a.name}</b>`:`<b>${a.sp.label}</b>`}
function otherRef(a,o){const w=a.lex['a:'+o.id];return w?wordHTML(w,o.sp.label.toLowerCase()):('o '+o.sp.label.toLowerCase())}

/* ---- linguagem própria de cada bicho ---- */
function coin(a,len){
  for(let tr=0;tr<30;tr++){
    const n=len||(R()<.4?3:2);let w='';
    for(let i=0;i<n;i++)w+=pick(a.phon.c)+pick(a.phon.v);
    if(R()<.3)w+=pick(a.phon.e);
    if(!a.words.has(w)&&w.length>2){a.words.add(w);return w}
  }
  return 'ka'+rint(10,99);
}
function maybeCoin(a,key,p=1,lead){
  if(a.lex[key]||R()>p)return null;
  const w=coin(a);a.lex[key]=w;W.stats.words++;
  say(a,`${lead||pick(['Vou chamar isso de','Isso vai se chamar','Preciso de um nome pra isso:'])} ${wordHTML(w,gloss(key))}.`,'name');
  UI&&UI.onLex&&UI.onLex(a);
  return w;
}
function selfName(a){
  let nm;
  for(let i=0;i<40;i++){nm=coin(a,2);nm=nm[0].toUpperCase()+nm.slice(1);if(!W.names.has(nm))break}
  W.names.add(nm);a.name=nm;a.lex.self=nm;
  say(a,`Eu… eu sou alguém! Meu nome é <b>${nm}</b>.`,'name');
  ev('🏷️',`O ${a.sp.label.toLowerCase()} escolheu um nome: <b>${nm}</b>.`);
  UI&&UI.onLex&&UI.onLex(a);
}

/* =====================  PERSONALIDADE / PENSAMENTOS PRÓPRIOS  ===================== */
const TRAITS={
  curioso:{label:'curioso',desc:'precisa saber o que tem atrás de cada coisa',curio:.2,explore:.07,ruin:.12},
  sonhador:{label:'sonhador',desc:'vive com a cabeça nas nuvens',dream:.5,ruin:.04,explore:.03},
  corajoso:{label:'corajoso',desc:'não recua diante do perigo',brave:1,fire:.15},
  medroso:{label:'medroso',desc:'prefere o seguro, longe do susto',fear:1,fire:-.2},
  teimoso:{label:'teimoso',desc:'não larga uma ideia fácil',stub:1,build:.06},
  pratico:{label:'prático',desc:'gosta do que serve pra alguma coisa',build:.25},
  falante:{label:'falante',desc:'conversa até com pedra',talk:.35},
  calado:{label:'calado',desc:'fala pouco e observa muito',talk:-.18,dream:.1},
  brincalhao:{label:'brincalhão',desc:'transforma tudo em brincadeira',play:.65},
  preguicoso:{label:'preguiçoso',desc:'um cochilo resolve quase tudo',lazy:.4},
};
const TRAIT_LINES={
  curioso:['O que será que tem atrás daquelas árvores?','Toda coisa aqui esconde um segredo. Eu quero descobrir.','Nunca me canso de olhar as coisas de perto.'],
  sonhador:['Já imaginei um mundo onde ninguém tem medo.','Se eu fechar os olhos, vejo lugares que ainda não existem.','Talvez as nuvens sejam os pensamentos de alguém.'],
  corajoso:['Nada aqui me faz recuar.','Se vier perigo, eu vou na frente.','O medo passa. Quem fica sou eu.'],
  medroso:['Tem sempre um barulho que eu não sei de onde vem.','Prefiro ficar onde enxergo tudo.','O escuro é grande demais.'],
  teimoso:['Eu já decidi: não largo essa ideia.','Podem dizer que não dá. Eu vou tentar de novo.','Insistir é o único jeito que eu sei.'],
  pratico:['Coisa boa é coisa que serve.','Se não tem utilidade, pra que serve?','Com o que eu tenho na mão já dá pra fazer alguma coisa.'],
  falante:['Eu podia passar o dia conversando.','Tem tanta coisa pra contar…','Queria alguém pra ouvir o que eu penso.'],
  calado:['…','Às vezes o silêncio diz mais do que a fala.','Fico quieto, mas estou pensando o tempo todo.'],
  brincalhao:['Se eu pular nessa poça, será que espirra longe?','Tudo fica melhor quando vira brincadeira.','Imaginei uma corrida com o vento. Ganhei.'],
  preguicoso:['Um cochilo agora seria perfeito.','Trabalhar? Hoje não.','O chão está macio. Quase uma cama.'],
};
const QUIRKS=[
  {k:'nuvens',label:'olha as nuvens',line:'As nuvens hoje parecem bichos. Aquela lá parece um peixe.'},
  {k:'pedrinhas',label:'junta pedrinhas',line:'Essa pedrinha tem um brilho esquisito. Vou guardar com as outras.'},
  {k:'cantar',label:'canta baixinho',line:'Cantou uma melodia sem letra, só para o vento ouvir.'},
  {k:'estrelas',label:'conta estrelas',line:'Uma, duas, três… perdi a conta de novo.'},
  {k:'arvores',label:'fala com as árvores',line:'Bom dia, árvore. Você cresceu de novo?'},
  {k:'chuva',label:'adora cheiro de chuva',line:'Cheiro de chuva vindo… isso me deixa leve.'},
  {k:'sombra',label:'dorme na sombra',line:'A sombra daquela árvore é a minha favorita.'},
  {k:'pegadas',label:'segue pegadas',line:'Pegadas frescas… quem passou por aqui antes de mim?'},
  {k:'agua',label:'gosta do som da água',line:'A água faz um som que limpa a cabeça.'},
  {k:'fogo',label:'admira o fogo de longe',line:'O fogo dança. Se eu chegar perto, ele morde.'},
  {k:'folhas',label:'coleciona folhas bonitas',line:'Essa folha tem um formato que eu nunca vi.'},
  {k:'bromas',label:'faz graça com os outros',line:'Se eu fizer cara de susto, será que eles riem?'},
];
const BELIEFS=[
  'o fogo é um bicho que come mato e dança',
  'a lua deve ser um olho grande que fica de vigia',
  'os rios levam tudo até um lugar que ninguém viu',
  'as árvores conversam devagar, no vento',
  'o trovão é a voz de alguém muito grande',
  'os bichos de antes deixaram os riscos nas pedras pra ensinar a gente',
  'dormir é só visitar outro mundo por um tempo',
  'tudo que existe tem um nome, mesmo o que a gente ainda não falou',
  'a chuva é o céu lavando o mundo',
  'cada pegada conta pra onde alguém foi',
  'o medo é um aviso, não um dono',
  'quando a gente some, vira semente',
];
const DREAMS=[
  {k:'agua',label:'ver onde a água vai parar',act:'agua',line:'Se eu seguir a água, será que ela tem fim?'},
  {k:'alto',label:'ver o mundo do ponto mais alto',act:'alto',line:'Do alto tudo deve ficar pequeno. Preciso ver isso.'},
  {k:'noite',label:'passar a noite olhando o céu',act:'noite',line:'À noite o céu acende. Quero entender por quê.'},
  {k:'desenho',label:'deixar um desenho que dure',act:'desenho',line:'Quero riscar uma parede e que fique lá pra sempre.'},
  {k:'amigo',label:'ter um amigo de verdade',act:'amigo',line:'Ter alguém que me entende deve ser bom.'},
  {k:'comida',label:'provar um gosto que ainda não conheço',act:'comida',line:'Cada coisa deve ter um gosto diferente.'},
  {k:'lingua',label:'entender o que os outros falam',act:'lingua',line:'Eles falam coisas que eu não entendo. Quero entender.'},
  {k:'fogo',label:'chegar perto do fogo sem medo',act:'fogo',line:'Aquele laranja me chama e me assusta ao mesmo tempo.'},
];
function initSelf(a){
  if(a.pers&&a.pers.trait&&a.pers.dream)return;
  const tk=pick(Object.keys(TRAITS)),T=TRAITS[tk];
  const q=pick(QUIRKS),d=pick(DREAMS);
  a.pers={
    trait:tk,quirk:q.k,belief:pick(BELIEFS),voice:pick(['curta','poetica','brincalhona','teimosa']),
    routine:R()<.18?'noite':'dia',dream:{k:d.k,label:d.label,act:d.act,line:d.line,done:false,doneT:0},dreams:0,
  };
  a.opinion=a.opinion||{};
  if(a.curio!=null)a.curio=clamp(a.curio+(T.curio||0),.1,1);
  if(T.fear)a.fear.fire=clamp(a.fear.fire+.18,0,1);
  if(T.brave)a.fear.fire=clamp(a.fear.fire-.12,0,1);
  a.thoughtT=rnd(18,42);a.dreamT=0;a.lastThinkT=0;
}
function quirkOf(a){const P=a.pers;return P?QUIRKS.find(q=>q.k===P.quirk)||null:null}
function bumpOpinion(a,b,d){
  if(!a||!b||a===b)return;
  if(!a.opinion)a.opinion={};
  const op=a.opinion[b.id]||(a.opinion[b.id]={v:0,t:0});
  op.v=clamp(op.v+d,-1,1);op.t=W.t;
}
function dreamAct(a,act){
  const P=a.pers;if(!P||!P.dream||P.dream.done||P.dream.act!==act)return false;
  P.dream.done=true;P.dream.doneT=W.t;P.dreams=(P.dreams||0)+1;
  a.exp+=2;a.n.social=clamp(a.n.social+.12);a.curio=clamp(a.curio+.04);
  say(a,pick([
    `Consegui ${P.dream.label}! Foi do jeito que eu queria.`,
    `Pronto: ${P.dream.label}. Agora isso é meu.`,
    `Eu queria ${P.dream.label} e consegui. Que dia.`,
  ]),'feel');
  UI&&UI.onSelf&&UI.onSelf(a);
  return true;
}
function thinkNow(a){
  const P=a.pers;if(!P)return;
  if(a.faint>0||a.taken||a.state==='sleep'||a.state==='talk')return;
  if(W.t-(a.lastThinkT||0)<12)return;
  a.lastThinkT=W.t;
  const pool=[];
  if(P.dream&&P.dream.done&&W.t-(P.dream.doneT||0)>60+R()*90){
    const nd=pick(DREAMS.filter(d=>d.k!==P.dream.k));
    P.dream={k:nd.k,label:nd.label,act:nd.act,line:nd.line,done:false,doneT:0};
    pool.push(`Já fiz o que eu queria. Agora outra coisa me chama: ${nd.label}.`);
    UI&&UI.onSelf&&UI.onSelf(a);
  }else if(P.dream&&!P.dream.done){
    pool.push(pick([`O que eu quero mesmo é ${P.dream.label}.`,`Sonho com ${P.dream.label}.`,`Se eu conseguir ${P.dream.label}, já vale o dia.`]));
  }
  const q=quirkOf(a);if(q&&R()<.3)pool.push(q.line);
  if(R()<.16)pool.push(`Eu acho que ${P.belief}.`);
  if(R()<.35){
    const known=[];
    for(const id in (a.opinion||{})){const o=W.animals.find(x=>x.id===+id);if(o&&o!==a&&!o.taken)known.push(o)}
    if(known.length){
      const o=pick(known),v=(a.opinion[o.id]||{v:0}).v;
      if(v>.35)pool.push(`${nameTag(o)} me faz companhia. Gosto quando está por perto.`);
      else if(v<-.3)pool.push(`Não confio em ${nameTag(o)}. Tem algo ali que me incomoda.`);
    }
  }
  const tl=TRAIT_LINES[P.trait];
  if(tl&&R()<.4)pool.push(pick(tl));
  if(R()<.22){
    const w=W.weather&&W.weather.kind;
    if(w==='tempestade')pool.push('O céu está gritando lá em cima. Vou ficar atento.');
    else if(w==='neblina')pool.push('A neblina esconde tudo. Talvez esconda também a mim.');
    else if(w==='geada')pool.push('Esse branco gela. Cada passo range.');
    else if(daylight()<.2)pool.push('A noite tem um silêncio que parece cheio de olhos.');
  }
  if(!pool.length)return;
  let s=pick(pool);
  if(P.voice==='teimosa'&&R()<.3)s='E não mudo de ideia: '+s[0].toLowerCase()+s.slice(1);
  else if(P.voice==='brincalhona'&&R()<.2)s+=' '+pick(['Hihi.','Qual é, o dia tá bom!','Eu sou demais.']);
  else if(P.voice==='poetica'&&R()<.2)s+=pick([' O vento leva.',' Tudo passa devagar.','']);
  say(a,s,'think');
}
function planDream(a){
  const P=a.pers;if(!P||!P.dream||P.dream.done)return null;
  const act=P.dream.act,mem=visibleMem(a);
  if(act==='agua'){
    const w=mem.find(t=>t.kind==='agua')||W.things.filter(t=>!t.gone&&t.kind==='agua'&&Math.hypot(t.x-a.x,t.z-a.z)<60).sort((p,q)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(q.x-a.x,q.z-a.z))[0];
    if(!w)return null;
    return planInteract(a,'ficar',w).map((s,i)=>i===1?Object.assign({},s,{dur:11,key:'sonho:agua',dream:'agua'}):s);
  }
  if(act==='alto'){
    let best=null,bh=-1e9;
    for(let i=0;i<10;i++){
      const x=clamp(a.x+rnd(-45,45),-EDGE,EDGE),z=clamp(a.z+rnd(-45,45),-EDGE,EDGE);
      if(inWater(x,z,2))continue;
      const h=hgt(x,z);if(h>bh){bh=h;best={x,z}}
    }
    if(!best)return null;
    return [{t:'goto',x:best.x,z:best.z,r:1.2},{t:'stay',dur:10,key:'sonho:alto',dream:'alto'}];
  }
  if(act==='noite'){
    if(daylight()>.35)return null;
    return [{t:'stay',dur:12,key:'sonho:noite',dream:'noite'}];
  }
  if(act==='desenho'){
    const b=mem.find(t=>t.kind==='mural'||t.kind==='quadro');
    if(!b)return null;
    return planInteract(a,'desenhar',b).map((s,i)=>i===1?Object.assign({},s,{dream:'desenho'}):s);
  }
  if(act==='amigo'||act==='lingua'){
    const o=W.animals.filter(x=>x!==a&&x.faint<=0&&x.state!=='sleep'&&Math.hypot(x.x-a.x,x.z-a.z)<45).sort((p,q)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(q.x-a.x,q.z-a.z))[0];
    if(!o)return null;
    return [{t:'goto',x:o.x,z:o.z,r:1.8,th:o,follow:true},{t:'talk',with:o,dur:6,key:'sonho:'+act,dream:act}];
  }
  if(act==='comida'){
    const f=mem.find(t=>K[t.kind]&&K[t.kind].food&&!a.mem['provar:'+t.kind]);
    if(!f)return null;
    return [{t:'goto',x:f.x,z:f.z,r:.95,th:f},{t:'do',verb:'provar',th:f,kind:f.kind,dur:1.5,key:'provar:'+f.kind,dream:'comida'}];
  }
  if(act==='fogo'){
    const f=W.things.filter(t=>!t.gone&&t.kind==='fogo'&&Math.hypot(t.x-a.x,t.z-a.z)<60).sort((p,q)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(q.x-a.x,q.z-a.z))[0];
    if(!f)return null;
    const s=standPoint(a,f);
    return [{t:'goto',x:s.x,z:s.z,r:s.r,th:f},{t:'stay',dur:9,key:'sonho:fogo',th:f,kind:'fogo',dream:'fogo'}];
  }
  return null;
}

/* =====================  BICHOS  ===================== */
function animalRadius(sp){return Math.max(.3,(sp.sz||1)*.62)}
function makeAnimal(spk,x,z){
  const sp=SP[spk];
  const cons=shuffle('ptkbdgmnlrvsfzjch'.split('')).slice(0,6);
  const vow=shuffle(['a','e','i','o','u','ã','ô']).slice(0,3);
  const a={
    id:W.animals.length+1,spk,sp,x,z,yaw:0,y:hgt(x,z),
    name:null,lex:{},words:new Set(),phon:{c:cons,v:vow,e:shuffle(['n','m','r','s','k']).slice(0,2)},
    n:{fome:.85,sede:.85,energia:.95,calor:.75,saude:1,social:.55},oxygen:1,curio:.7,
    hands:[],handT:0,mem:{},seen:{},kinds:new Set(),others:{},
    tried:{},recipes:{},inventions:[],lessons:{burned:false},fear:{fire:0,wolf:0},
    known:{},knowledge:{},research:0,tribeId:null,taken:null,
    plan:null,cur:null,state:'idle',idle:rnd(.5,2),age:0,exp:0,
    log:[],bubble:null,wish:{text:'…',tag:''},ideas:[],project:null,
    stats:{eaten:0,drank:0,slept:0,dug:0,burned:0,built:0,talks:0,fished:0},
    vc:{},wishT:0,muse:rnd(8,16),lastCand:'',pain:0,heat:{warm:0,burn:false},lastDig:null,walk:0,faint:0,
    mind:null,ruinT:0,pers:null,opinion:{},thoughtT:0,dreamT:0,lastThinkT:0,songs:[],
  };
  if(sp.swim)a.recipes.pesca=a.recipes.pesca||{innate:true};
  W.animals.push(a);
  nearestBlockedFix(a);
  a.y=hgt(a.x,a.z);
  initSelf(a);
  say(a,'Acordei. Tudo é novo. Não sei o que é nada aqui.','think');
  return a;
}

const snap=a=>Object.assign({},a.n);
function teachBoards(){
  const boards=W.things.filter(t=>!t.gone&&(t.kind==='mural'||t.kind==='quadro'));
  if(!boards.length)return;
  for(const a of W.animals)for(const t of boards)a.seen[t.id]=t;
}
function visibleMem(a){
  const out=[];
  for(const id in a.seen){const t=W.byId[id];if(!t||t.gone){delete a.seen[id];continue}out.push(t)}
  return out;
}
function standPoint(a,t){
  if(t.kind==='agua'){
    const p=t.data.pond;const cx=p?p.x:t.x,cz=p?p.z:t.z,rr=p?p.r:(t.data.r||2.5);
    const an=Math.atan2(a.z-cz,a.x-cx);const d=rr*1.1+.9;
    return {x:cx+Math.cos(an)*d,z:cz+Math.sin(an)*d,r:.5};
  }
  if(t.kind==='fogo'){const an=Math.atan2(a.z-t.z,a.x-t.x);return {x:t.x+Math.cos(an)*2.3,z:t.z+Math.sin(an)*2.3,r:.6}}
  if(t.kind==='computador'){const an=Math.atan2(a.z-t.z,a.x-t.x);return {x:t.x+Math.cos(an)*2.1,z:t.z+Math.sin(an)*2.1,r:.6}}
  if(t.kind==='mural'||t.kind==='quadro'){const an=Math.atan2(a.z-t.z,a.x-t.x);const rr=t.kind==='mural'?2.5:1.7;return {x:t.x+Math.cos(an)*rr,z:t.z+Math.sin(an)*rr,r:.6}}
  if(t.kind==='ruina'||t.kind==='portao'){const an=Math.atan2(a.z-t.z,a.x-t.x);return {x:t.x+Math.cos(an)*2.1,z:t.z+Math.sin(an)*2.1,r:.7}}
  if(t.kind==='represa'){const {p}=nearestPond(t.x,t.z);const an=Math.atan2(t.z-p.z,t.x-p.x);return {x:t.x+Math.cos(an)*1.1,z:t.z+Math.sin(an)*1.1,r:.6}}
  return {x:t.x,z:t.z,r:.95};
}
function distTo(a,t){const s=standPoint(a,t);return Math.hypot(a.x-s.x,a.z-s.z)}

/* ---- percepção ---- */
function perceive(a){
  const night=1-daylight();
  const fog=W.weather&&W.weather.kind==='neblina'?.55:1;
  const vis=a.sp.vis*(1-.45*night)*fog,smell=a.sp.smell*(fog*.8+.2);
  for(const t of W.things){
    if(t.gone)continue;
    const k=K[t.kind];
    let d=Math.hypot(t.x-a.x,t.z-a.z);
    if(t.kind==='agua')d-=t.data.r;
    const R_=k.smell?Math.max(vis,smell):vis;
    if(d<=R_){
      if(!a.seen[t.id]){a.seen[t.id]=t;onFirstSight(a,t)}
    }
  }
  // fogo selvagem (células queimando) conta como "fogo"
  let nf=null,nd=1e9;
  for(const c of W.burning){const d=Math.hypot(c.cx-a.x,c.cz-a.z);if(d<nd){nd=d;nf=c}}
  if(nf&&nd<vis+4&&!a.kinds.has('fogo')){a.kinds.add('fogo');onKindSeen(a,'fogo')}
  a.fireNear=nf&&nd<vis+4?{x:nf.cx,z:nf.cz,d:nd}:null;
  for(const o of W.animals){if(o===a)continue;const d=hyp(o,a);if(d<vis+2)a.others[o.id]={o,t:W.t}}
}
function onFirstSight(a,t){
  if(!a.kinds.has(t.kind)){a.kinds.add(t.kind);onKindSeen(a,t.kind)}
}
function onKindSeen(a,kind){
  if(a.kinds.size<=1&&a.age<2)return;
  const k=K[kind];
  a.curio=clamp(a.curio-.05);
  if(kind==='fogo'){
    say(a,`Que luz é aquela? ${K.fogo.d}. Estou com medo e curiosidade ao mesmo tempo.`,'alert');
    maybeCoin(a,'k:fogo',.9);return;
  }
  if(a.sawKindT&&W.t-a.sawKindT<12)return;
  a.sawKindT=W.t;
  say(a,pick([`Hm, o que é ${k.d}?`,`Nunca vi ${k.d}.`,`Olha só: ${k.d}. Será que serve pra algo?`]),'think');
}

/* ---- memória por experiência ---- */
function learnFrom(a,key,before,extra){
  const eff={};for(const n of NEEDS)eff[n]=a.n[n]-before[n];
  if(extra)for(const k in extra)eff[k]=(eff[k]||0)+extra[k];
  let r=a.mem[key];const first=!r;
  if(!r)r=a.mem[key]={n:0,eff:{},last:W.t};
  const al=Math.max(.3,1/(r.n+1));
  for(const n of NEEDS)r.eff[n]=(r.eff[n]||0)+(eff[n]-(r.eff[n]||0))*al;
  r.n++;r.last=W.t;a.exp++;
  if(first)a.curio=clamp(a.curio-.12);
  UI&&UI.onMem&&UI.onMem(a);
  return {first,eff,r};
}
function prior(key){
  const [v,k]=key.split(':');const e={};const kd=K[k];
  if(v==='provar'){ if(kd&&kd.food)e.fome=.13; if(k==='agua'||k==='poco')e.sede=.15; else if(!kd||!kd.food)e.fome=.01 }
  if(v==='dormir')e.energia=.35;
  if(v==='cavar')e.fome=.03;
  if(v==='socializar')e.social=.18;
  if(v==='ficar')e.energia=.02;
  return e;
}
function scoreKey(a,key,d,U,calm,mult=1){
  const r=a.mem[key];
  let mem=r;
  // desenhar/escrever valem para os dois suportes: a memória não deve viciar num só
  if(/^(desenhar|escrever):(mural|quadro)$/.test(key)){
    const alt=key.replace(key.endsWith('mural')?'mural':'quadro',key.endsWith('mural')?'quadro':'mural');
    const r2=a.mem[alt];
    if(r2&&(!mem||r2.n>mem.n))mem=r2;
  }
  const E=mem?mem.eff:prior(key);
  let g=0;
  for(const n of NEEDS){const e=E[n]||0;if(!e)continue;g+=e*(e>0?U[n]:(.5+U[n]))*NEED_W[n]}
  const nov=a.sp.curio*(.4+a.curio)*(r?.14/(1+r.n*.6):.34)*calm;
  const pref=(a.sp.pref&&a.sp.pref[key.split(':')[1]])||1;
  return (g+nov)*mult*pref-d*.008;
}

/* =====================  DECISÃO  ===================== */
function verbsFor(a,t){
  const k=K[t.kind];let v=k.v.slice();
  if(t.kind==='moita'&&t.data.b<=0)v=v.filter(x=>x!=='provar'&&x!=='pegar');
  if(a.sp.gnaw<.8)v=v.filter(x=>x!=='roer');
  if(v.includes('pegar')&&a.hands.length>=a.sp.cap)v=v.filter(x=>x!=='pegar');
  return v;
}
function decide(a){
  if(a.faint>0)return;
  const nm=Math.min(a.n.fome,a.n.sede,a.n.energia,a.n.calor);
  const calm=clamp(nm*2,.1,1);
  const P=a.pers||{},T=P.trait?(TRAITS[P.trait]||{}):{};
  const U={};for(const k of NEEDS)U[k]=k==='saude'?Math.pow(1-a.n.saude,1.5)+.1:Math.pow(1-a.n[k],1.5);
  const C=[];
  const mem=visibleMem(a);
  // coisas conhecidas × verbos
  const best={};
  for(const t of mem){
    if(!a.sp.swim&&AQUATIC_THINGS.has(t.kind)&&inWater(t.x,t.z,.95))continue;
    for(const v of verbsFor(a,t)){
      const key=v+':'+t.kind;const d=distTo(a,t);
      if(a.fear.fire>.5&&t.kind==='fogo'&&(a.mem[key]?a.mem[key].eff.saude:0)<-.05&&d<2)continue;
      if(!best[key]||d<best[key].d)best[key]={key,v,t,d};
    }
  }
  for(const b of Object.values(best))C.push({key:b.key,score:scoreKey(a,b.key,b.d,U,calm),mk:()=>planInteract(a,b.v,b.t)});
  // itens na mão
  for(const kind of new Set(a.hands)){
    const kd=K[kind];
    if(kd.food||!a.mem['provar:'+kind])C.push({key:'provar:'+kind,score:scoreKey(a,'provar:'+kind,0,U,calm),mk:()=>[{t:'do',verb:'provar',kind,hand:true,dur:1.4,key:'provar:'+kind}]});
  }
  // emergência: fome ou sede muito baixas
  if(!a.sp.marine&&a.n.sede<.22){
    const w=mem.filter(t=>t.kind==='agua'||t.kind==='poco').sort((p,q)=>distTo(a,p)-distTo(a,q))[0];
    if(w)C.push({key:'provar:'+w.kind,score:1.0,mk:()=>planInteract(a,'provar',w)});
    else C.push({key:'explorar:agua',score:.8,mk:()=>planWater(a)});
  }
  if(a.n.fome<.18){
    let food=null,fd=1e9;
    for(const t of mem){
      const kd=K[t.kind];if(!kd.food||t.kind==='agua')continue;
      if(t.kind==='moita'&&t.data.b<=0)continue;
      if(t.kind==='plantacao'&&(t.data.ripe|0)<=0)continue;
      if(!a.sp.swim&&AQUATIC_THINGS.has(t.kind)&&inWater(t.x,t.z,.95))continue;
      const d=distTo(a,t);if(d<fd){fd=d;food=t}
    }
    if(food)C.push({key:'provar:'+food.kind,score:1.1,mk:()=>planInteract(a,'provar',food)});
  }
  // pescar: quem já sabe fica na beira e tenta pegar peixe
  if(a.recipes.pesca&&a.n.fome<.7&&a.n.energia>.28&&a.n.sede>.18){
    const w=mem.filter(t=>t.kind==='agua'||t.kind==='represa').sort((p,q)=>distTo(a,p)-distTo(a,q))[0];
    if(w)C.push({key:'pescar:'+w.kind,score:.2+(a.n.fome<.42?.18:0)+a.sp.curio*.05,mk:()=>planInteract(a,'pescar',w)});
  }
  // colher plantação madura
  if(a.n.fome<.78){
    const crop=mem.filter(t=>t.kind==='plantacao'&&(t.data.ripe|0)>0).sort((p,q)=>distTo(a,p)-distTo(a,q))[0];
    if(crop)C.push({key:'colher:plantacao',score:.28+(a.n.fome<.5?.2:0),mk:()=>planInteract(a,'colher',crop)});
  }
  // dormir
  const shel=mem.filter(t=>t.kind==='toca'||t.kind==='abrigo'||t.kind==='cabana'||t.kind==='celeiro'||t.kind==='caverna').sort((p,q)=>distTo(a,p)-distTo(a,q))[0];
  const fire=mem.filter(t=>t.kind==='fogo').sort((p,q)=>distTo(a,p)-distTo(a,q))[0];
  const owl=P.routine==='noite';
  const nightB=daylight()<.25?(owl?1:1.25):(owl&&daylight()<.62?1.08:1);
  C.push({key:'dormir:chao',score:scoreKey(a,'dormir:chao',0,U,calm,nightB),mk:()=>[{t:'sleep',key:'dormir:chao',max:70}]});
  if(shel)C.push({key:'dormir:'+shel.kind,score:scoreKey(a,'dormir:'+shel.kind,distTo(a,shel),U,calm,nightB),mk:()=>[{t:'goto',x:shel.x,z:shel.z,r:.7,th:shel},{t:'sleep',key:'dormir:'+shel.kind,max:80}]});
  if(fire&&!(a.mem['ficar:fogo']&&a.mem['ficar:fogo'].eff.saude<-.05&&a.fear.fire>.4))C.push({key:'dormir:fogo',score:scoreKey(a,'dormir:fogo',distTo(a,fire),U,calm,nightB),mk:()=>{const s=standPoint(a,fire);return[{t:'goto',x:s.x,z:s.z,r:s.r,th:fire},{t:'sleep',key:'dormir:fogo',max:70}]}});
  // explorar e cavar
  C.push({key:'explorar:mata',score:scoreKey(a,'explorar:mata',0,U,calm)+.06+.1*a.curio+(T.explore||0),mk:()=>planExplore(a)});
  if(a.sp.dig>0)C.push({key:'cavar:chao',score:scoreKey(a,'cavar:chao',0,U,calm,.6+a.sp.dig*.6),mk:()=>planDigGround(a)});
  // socializar
  for(const id in a.others){
    const o=a.others[id].o;if(W.t-a.others[id].t>25||o.state==='sleep'||o.faint>0)continue;
    const d=hyp(a,o);if(d>35)continue;
    C.push({key:'socializar:animal',score:scoreKey(a,'socializar:animal',d,U,calm,.6+a.sp.soc*.9+(T.talk||0)),mk:()=>planTalk(a,o)});break;
  }
  // fé da tribo: rezar no totem ou marcar o chão perto dele
  const myTribe=tribeOf(a);
  if(myTribe){
    const totem=mem.find(t=>t.kind==='totem'&&(!t.data.tribe||t.data.tribe===a.tribeId));
    if(totem&&a.n.energia>.3)C.push({key:'rezar:totem',score:.045+.11*(myTribe.faith.piety||0)+(a.n.social<.45?.06:0),mk:()=>planInteract(a,'rezar',totem)});
    // aprender a passar pelo portão: sai, olha a entrada e volta
    const gate=mem.find(t=>t.kind==='portao'&&(!t.data.tribe||t.data.tribe===a.tribeId));
    if(gate&&!a.lessons.gate&&a.n.energia>.5&&W.t-(a.gateT||-999)>50){
      C.push({key:'visitar:portao',score:.07+.1*a.curio,mk:()=>{
        a.gateT=W.t;
        const ga=gate.data.gate||0,rr=(gate.data.r||5.6)+2.4;
        return [{t:'goto',x:myTribe.center.x+Math.cos(ga)*rr,z:myTribe.center.z+Math.sin(ga)*rr,r:1.1,th:gate,gate:true},
          {t:'stay',dur:5,key:'olhar:portao',th:gate,kind:'portao'}];
      }});
    }
  }
  // mexer em coisas (tinkering) e projetos
  const parts=knownParts(a);
  // com ferramenta na mão, minério visível vira prioridade
  if(a.hands.includes('picareta')||a.hands.includes('machado')){
    const ore=mem.find(t=>t.kind==='minerio');
    if(ore&&a.n.energia>.35)C.push({key:'minerar:minerio',score:.62,mk:()=>planInteract(a,'minerar',ore)});
  }
  if(parts.size>=1){
    const tw=(.06+.42*a.curio*a.sp.curio)*calm;
    C.push({key:'mexer:coisas',score:tw+(a.wish.tag==='inventar'?.08:0)+(T.build||0)*.5,mk:()=>planTinker(a)});
  }
  // quem já descobriu couro/bronze insiste no próximo passo (roupa, armadura, bronze)
  if(a.n.energia>.32){
    const nearPart=(k,rad)=>{if(a.hands.includes(k))return true;let d=1e9;for(const t of mem)if(t.kind===k)d=Math.min(d,Math.hypot(t.x-a.x,t.z-a.z));return d<=rad};
    const nearFire=mem.some(t=>t.kind==='fogo'&&Math.hypot(t.x-a.x,t.z-a.z)<26);
    if(a.recipes.couro&&!a.recipes.roupa&&nearPart('couro',20)&&(nearPart('folha',20)||nearPart('couro',20)))
      C.push({key:'combinar:roupa',score:.10+.15*a.curio,mk:()=>planCombine(a,'couro',nearPart('folha',20)?'folha':'couro')});
    if(!a.recipes.armadura&&nearPart('bronze',20)&&nearPart('couro',20)&&(a.recipes.bronze||a.recipes.roupa))
      C.push({key:'combinar:armadura',score:.15+.2*a.curio,mk:()=>planCombine(a,'bronze','couro')});
    if(a.recipes.lanca&&!a.hands.includes('lanca')&&nearPart('bronze',20)&&(nearPart('galho',20)||nearPart('tronco',20)))
      C.push({key:'combinar:lanca',score:.09+.14*a.curio,mk:()=>planCombine(a,'bronze',nearPart('galho',20)?'galho':'tronco')});
    if(!a.recipes.bronze&&nearFire&&nearPart('mineral',22))
      C.push({key:'combinar:bronze',score:.09+.16*a.curio,mk:()=>planCombine(a,'mineral','mineral')});
  }
  // pesquisar no computador (com pausa entre sessões)
  const pc=mem.find(t=>t.kind==='computador');
  if(pc&&W.t-(a.researchT||-999)>90&&a.n.energia>.3&&Math.min(a.n.fome,a.n.sede)>.28){
    const known=Object.keys(a.knowledge).length;
    const sc=(.04+.18*a.curio*a.sp.curio)*(known<4?1:.4)*(known<8?1:.2);
    C.push({key:'pesquisar:computador',score:sc,mk:()=>planInteract(a,'pesquisar',pc)});
  }
  // ruínas antigas: quem é curioso tenta decifrar os riscos
  const ruin=mem.find(t=>t.kind==='ruina'&&!t.data.done);
  if(ruin&&a.n.energia>.3&&W.t-(a.ruinT||-999)>30&&a.n.saude>.4){
    C.push({key:'decifrar:ruina',score:.09+.3*a.curio*a.sp.curio+(T.ruin||0),mk:()=>{a.ruinT=W.t;return planInteract(a,'decifrar',ruin)}});
  }else if(!ruin&&a.curio>.5&&a.n.energia>.35&&a.n.saude>.4&&W.t-(a.ruinT||-999)>60){
    // pedras com riscos chamam quem é curioso, mesmo de longe
    const far=W.things.filter(t=>!t.gone&&t.kind==='ruina'&&!t.data.done).sort((p,q)=>hyp(a,p)-hyp(a,q))[0];
    if(far&&hyp(a,far)<60)C.push({key:'investigar:ruina',score:.07+.28*a.curio,mk:()=>{a.ruinT=W.t;return planInteract(a,'decifrar',far)}});
  }
  // nadadores vão pra água quando a barriga ou a sede aperta
  if(a.sp.swim&&Math.min(a.n.fome,a.n.sede)<.62){
    C.push({key:'explorar:agua',score:scoreKey(a,'provar:peixe',0,U,calm,.55),mk:()=>planSwim(a)});
  }
  // pug persegue bichinhos menores
  if(a.sp.pred&&a.n.fome<.6){
    const prey=W.animals.filter(o=>o!==a&&!o.sp.pred&&o.sp.tough<1&&o.faint<=0&&hyp(a,o)<16).sort((p,q)=>hyp(a,p)-hyp(a,q))[0];
    if(prey)C.push({key:'perseguir:animal',score:.24+.16*calm,mk:()=>[{t:'goto',x:prey.x,z:prey.z,r:1.3,th:prey,follow:true}]});
  }
  if(a.project)C.push({key:'projeto:'+a.project.type,score:.28+.2*calm+(T.stub?.12:0)+(T.build?.08:0),mk:()=>planProject(a)});
  // brincar (bichos brincalhões) e perseguir o próprio sonho (iniciativa própria)
  if(T.play&&a.n.energia>.45&&Math.min(a.n.fome,a.n.sede)>.35){
    const t=mem.find(x=>['agua','arvore','moita','pedra','flor'].includes(x.kind)&&Math.hypot(x.x-a.x,x.z-a.z)<24);
    if(t)C.push({key:'brincar:'+t.kind,score:.08+.12*T.play+(a.n.energia>.7?.04:0),mk:()=>{const s=standPoint(a,t);return[{t:'goto',x:s.x,z:s.z,r:s.r,th:t},{t:'stay',dur:6,key:'brincar:'+t.kind,th:t,kind:t.kind,play:true}]}});
  }
  if(P.dream&&!P.dream.done&&Math.min(a.n.fome,a.n.sede,a.n.energia,a.n.calor)>.35&&a.n.saude>.5&&W.t-(a.dreamT||-999)>55){
    const ds=planDream(a);
    if(ds)C.push({key:'sonho:'+P.dream.k,score:.2+.2*(T.dream||0)+.12*a.curio,mk:()=>{a.dreamT=W.t;return ds}});
  }
  // largar o que está carregando há muito tempo
  if(a.hands.length&&W.t-a.handT>40&&!a.project&&a.hands.every(k=>!K[k].food))C.push({key:'largar:tudo',score:.3,mk:()=>[{t:'do',verb:'largar',dur:1,all:true}]});
  if(!C.length)return planExplore(a);
  // escolha por softmax
  C.forEach(c=>{if(!isFinite(c.score))c.score=-9});
  const mx=Math.max(...C.map(c=>c.score));
  const ws=C.map(c=>Math.exp((c.score-mx)/.085));
  let sum=ws.reduce((p,q)=>p+q,0),r=R()*sum,ch=C[0];
  for(let i=0;i<C.length;i++){r-=ws[i];if(r<=0){ch=C[i];break}}
  const steps=ch.mk();
  if(!steps||!steps.length){a.idle=1;return}
  // retrato da decisão: a rede simples que a HUD desenha (entradas → ações)
  a.mind={t:W.t,pick:ch.key,cands:C.map(c=>({k:c.key,s:+c.score.toFixed(3)})).sort((p,q)=>q.s-p.s).slice(0,7),
    needs:NEEDS.map(k=>[k,+a.n[k].toFixed(2)])};
  intentThought(a,ch,U);
  startPlan(a,steps,{key:ch.key});
}

/* ---- planos ---- */
function startPlan(a,steps,meta){a.plan={steps,i:0,meta};a.cur=null;a.state='move'}
function endPlan(a){a.plan=null;a.cur=null;a.state='idle';a.idle=rnd(.3,1.1)}
function abortPlan(a,why){if(why)say(a,why,'think');endPlan(a)}
function planInteract(a,verb,t){
  const steps=[];
  const key=verb+':'+t.kind;
  if(verb==='ficar'){
    const s=standPoint(a,t);
    steps.push({t:'goto',x:s.x,z:s.z,r:s.r,th:t});
    steps.push({t:'stay',dur:9,key,th:t,kind:t.kind});
    return steps;
  }
  const s=standPoint(a,t);
  steps.push({t:'goto',x:s.x,z:s.z,r:s.r,th:t});
  const dur={provar:1.5,pegar:1.1,sacudir:3,roer:5,cavar:4,olhar:2.6,apertar:1.8,desenhar:4,escrever:3.4,pesquisar:5,minerar:4.5,rezar:8,decifrar:6,pescar:7,colher:2.2}[verb]||2;
  steps.push({t:'do',verb,th:t,kind:t.kind,dur,key});
  return steps;
}
function planExplore(a){
  let best=null,bs=-1;
  for(let i=0;i<6;i++){
    const an=rnd(0,TAU),d=rnd(10,28);let x=clamp(a.x+Math.cos(an)*d,-EDGE,EDGE),z=clamp(a.z+Math.sin(an)*d,-EDGE,EDGE);
    if(inPond(x,z,1.3)&&!a.sp.swim)continue;
    if(inRiver(x,z,1.3)&&!a.sp.swim)continue;
    const k=Math.floor(x/6)+','+Math.floor(z/6);const vis=a.vc[k]||0;
    const s=1/(1+vis)+R()*.3;if(s>bs){bs=s;best={x,z}}
  }
  if(!best)best={x:rnd(-30,30),z:rnd(-30,30)};
  return [{t:'goto',x:best.x,z:best.z,r:1.5,explore:true,key:'explorar:mata'}];
}
function planSwim(a){
  const {p,d}=nearestPond(a.x,a.z);
  if(p&&(d<70||!inRiver(a.x,a.z,3))){
    const an=rnd(0,TAU),rr=p.r*rnd(.35,.8);
    return [{t:'goto',x:p.x+Math.cos(an)*rr,z:p.z+Math.sin(an)*rr,r:1.1,swim:true,key:'explorar:agua'}];
  }
  const z=clamp(a.z+rnd(-24,24),-HALF+8,HALF-8);
  return [{t:'goto',x:riverX(z)+rnd(-1,1),z,r:1.1,swim:true,key:'explorar:agua'}];
}
function planWater(a){
  const {p,d}=nearestPond(a.x,a.z);
  const rd=Math.abs(riverDist(a.x,a.z))-RIVER.width*1.1;
  if(p&&d<rd){
    const an=Math.atan2(a.z-p.z,a.x-p.x)||rnd(0,TAU);
    const rr=p.r*1.13+.5;
    return [{t:'goto',x:p.x+Math.cos(an)*rr,z:p.z+Math.sin(an)*rr,r:.7,key:'explorar:agua'}];
  }
  const side=Math.sign(a.x-riverX(a.z))||1;
  return [{t:'goto',x:riverX(a.z)+side*RIVER.width*1.25,z:a.z,r:.7,key:'explorar:agua'}];
}
function planDigGround(a){
  let x,z;
  if(a.lastDig&&W.t-a.lastDig.t<30){x=a.lastDig.x;z=a.lastDig.z}
  else{const an=rnd(0,TAU),d=rnd(1.5,3);x=a.x+Math.cos(an)*d;z=a.z+Math.sin(an)*d;if(inPond(x,z,1.3)){x=a.x;z=a.z}}
  return [{t:'goto',x,z,r:.5},{t:'do',verb:'cavar',kind:'chao',gx:x,gz:z,dur:4/(.5+a.sp.dig),key:'cavar:chao'}];
}
function planTalk(a,o){
  return [{t:'goto',x:o.x,z:o.z,r:1.8,th:o,follow:true},{t:'talk',with:o,dur:5,key:'socializar:animal'}];
}

function intentThought(a,c,U){
  if(c.key===a.lastCand&&W.t-(a.lastCandT||0)<25)return;
  a.lastCand=c.key;a.lastCandT=W.t;
  const [v,k]=c.key.split(':');
  let s=null;
  if(v==='provar'&&k!=='agua'&&K[k]){
    s=a.n.fome<.45&&(a.mem[c.key]&&a.mem[c.key].eff.fome>.05)?`Estou com fome. Vou comer ${ref(a,k)}.`:a.mem[c.key]?`Vou provar ${ref(a,k)} de novo.`:`Vou provar ${ref(a,k)}. Não sei o que acontece.`;
  }else if(v==='provar'&&k==='agua'){
    s=a.n.sede<.5?`Minha boca está seca. Vou beber ${ref(a,'agua')}.`:`Vou provar ${ref(a,'agua')}.`;
  }else if(v==='pegar')s=`Vou pegar ${ref(a,k)} e ver como é.`;
  else if(v==='sacudir')s='Essa coisa enorme… vou sacudir pra ver o que cai.';
  else if(v==='roer')s=`Meus dentes querem roer ${ref(a,'arvore')}!`;
  else if(v==='cavar')s=k==='monte'?`Tem ${ref(a,'monte')} ali. Vou cavar!`:(a.lastDig&&W.t-a.lastDig.t<30?'Vou cavar mais fundo aqui.':`Vou ${vref(a,'cavar')} um pouco.`);
  else if(v==='ficar'){
    if(k==='fogo')s=a.n.calor<.5?'Estou com frio. Aquela coisa laranja parece quente…':`Vou chegar perto de ${ref(a,'fogo')}, devagar.`;
    else s=`Vou ficar um pouco perto de ${ref(a,k)}.`;
  }else if(v==='dormir')s=a.n.energia<.4?`Estou cansado. Preciso ${k==='chao'?'deitar':'dormir perto de '+ref(a,k)}.`:`Vou ${vref(a,'dormir')}.`;
  else if(v==='explorar'&&k==='agua')s='Água… sinto cheiro de peixe. Vou nadar um pouco.';
  else if(v==='explorar')s=pick(['Vou ver o que tem mais pra lá.','Quero conhecer mais coisas.','Tem algo além daquelas árvores?']);
  else if(v==='socializar')s='Tem alguém ali. Vou chegar perto.';
  else if(v==='mexer')s=pick(['Será que dá pra fazer algo juntando essas coisas?','Quero mexer nas coisas e ver o que acontece.']);
  else if(v==='olhar')s=k==='computador'?'Que caixa é essa? Tem luz e letrinhas… vou olhar de perto.':`Vou olhar ${ref(a,k)} com calma.`;
  else if(v==='apertar')s='E se eu apertar essa caixa acesa? Ela parece responder.';
  else if(v==='desenhar')s=k==='mural'?'Aquela parede escura está pedindo riscos. Vou desenhar nela.':k==='quadro'?`O ${ref(a,'quadro')} é liso. Vou rabiscar baixinho nele.`:`Vou rabiscar em ${ref(a,k)}.`;
  else if(v==='escrever')s=k==='quadro'?'Talvez essa tábua clara guarde melhor as palavras.':'Será que dá pra guardar uma palavra nessa parede? Vou tentar escrever.';
  else if(v==='rezar')s='O totem está ali. Vou pedir baixinho, com a tribo por perto.';
  else if(v==='pesquisar')s=Object.keys(a.knowledge).length<2?'Essa caixa acesa tem internet. Vou perguntar o que eu quiser.':'Já pesquisei umas coisas. A internet sabe mais. Vou perguntar outra.';
  else if(v==='minerar')s=a.hands.includes('picareta')||a.hands.includes('machado')?`Essa pedra brilha. Vou bater com o que tenho na mão.`:`Pedra com veios… será que dá pra quebrar? Minhas patas não são fortes.`;
  else if(v==='decifrar')s=pick(['Esses riscos parecem letras de um povo antigo. Vou tentar entender.','Pedra velha com sinais… cada um deve querer dizer algo.','Foi alguém que escreveu isto muito antes de mim. Vou decifrar.']);
  else if(v==='perseguir')s='Tem um bichinho menor ali. Vou atrás.';
  else if(v==='pescar')s=a.n.fome<.5?'A água tem peixe. Vou ficar quietinho na beira e tentar pegar.':'Vou pescar um pouco, só pelo gosto de esperar.';
  else if(v==='colher')s='A plantação cresceu! Vou colher o que estiver maduro.';
  else if(v==='largar')s='Isso na minha mão está atrapalhando. Vou largar.';
  else if(v==='sonho'&&a.pers&&a.pers.dream)s=`Meu sonho: ${a.pers.dream.label}. Vou atrás disso agora.`;
  else if(v==='brincar')s=pick(['Vou brincar um pouco. Ninguém precisa saber.','Correr, pular, espirrar água… só por gostar.','Hoje eu quero me divertir.']);
  if(s)say(a,s,'think');
}

/* =====================  TINKER / PROJETOS  ===================== */
const BASE_PARTS=['galho','pedra','folha','lama','tronco','cubinho','machado','mineral','picareta','couro','bronze'];
function knownParts(a){
  const s=new Set(a.hands.filter(k=>BASE_PARTS.includes(k)));
  for(const t of visibleMem(a))if(BASE_PARTS.includes(t.kind))s.add(t.kind);
  return s;
}
function nearestOfKind(a,kind,from){
  let b=null,bd=1e9;from=from||a;
  for(const t of visibleMem(a)){if(t.kind!==kind)continue;const d=Math.hypot(t.x-from.x,t.z-from.z);if(d<bd){bd=d;b=t}}
  return b;
}
function comboKey(x,y){return [x,y].sort().join('+')}
function planTinker(a){
  const parts=[...knownParts(a)];
  // às vezes tenta empilhar; às vezes juntar
  const fire=visibleMem(a).filter(t=>t.kind==='fogo')[0];
  if(fire&&!a.tried['cozinhar']&&R()<.6)return planCook(a,fire);
  if((parts.length>=2&&R()<.35)||(parts.length<2&&parts.length>0&&R()<.6)){
    // montinho: começa a empilhar de forma exploratória
    const n=rint(4,7);const w={galho:3,folha:2,pedra:1.5,lama:1,tronco:.8,cubinho:.4};
    const tasks=[];
    for(let i=0;i<n;i++){
      const ks=parts.filter(k=>w[k]);if(!ks.length)break;
      let tot=ks.reduce((p,k)=>p+w[k],0),r=R()*tot,pk=ks[0];for(const k of ks){r-=w[k];if(r<=0){pk=k;break}}
      tasks.push({kind:pk,dest:'pile'});
    }
    if(tasks.length){
      const pos=sitePos(a,false);
      a.project={type:'montinho',pos,tasks,idx:0,fails:0};
      say(a,'Vou empilhar umas coisas aqui e ver no que dá.','think');
      return planProject(a);
    }
  }
  if(parts.length<1)return planExplore(a);
  // pares
  let bestP=null,bs=-9;
  for(let i=0;i<parts.length;i++)for(let j=i;j<parts.length;j++){
    const x=parts[i],y=parts[j];const key=comboKey(x,y);
    const tr=a.tried[key];
    let s=tr?(tr.res==='nada'?.02:.3):1;
    if(x==='machado'||y==='machado')s*=.3;
    if(x===y&&(x==='lama'))s*=.2;
    s+=R()*.5;
    if(s>bs){bs=s;bestP=[x,y]}
  }
  if(!bestP)return planExplore(a);
  const [x,y]=bestP;
  say(a,`Vou juntar ${ref(a,x)} com ${ref(a,y)} e ver o que acontece.`,'think');
  return planCombine(a,x,y);
}
function planCombine(a,x,y){
  const steps=[];
  const need=x===y?[x,x]:[x,y];
  let hands=a.hands.slice();
  let spot=null,picked=null;
  for(const k of need){
    const i=hands.indexOf(k);
    if(i>=0){hands.splice(i,1);continue}
    const t=nearestOfKind(a,k,spot||a);
    if(!t)return planExplore(a);
    const s=standPoint(a,t);steps.push({t:'goto',x:s.x,z:s.z,r:s.r,th:t});
    if(a.hands.length<a.sp.cap&&k!==need[need.length-1]){steps.push({t:'do',verb:'pegar',th:t,kind:k,dur:1,key:'pegar:'+k});hands.push(k);picked=t}
    else spot=t;
  }
  if(comboKey(x,y)==='mineral+mineral'){
    // bronze precisa de calor: compactua as pedras que estão no alcance do fogo
    const fires=visibleMem(a).filter(t=>!t.gone&&t.kind==='fogo');
    const mins=visibleMem(a).filter(t=>!t.gone&&t.kind==='mineral'&&t!==picked&&fires.some(f=>Math.hypot(f.x-t.x,f.z-t.z)<4.2));
    if(mins.length){
      let best=mins[0],bs=-9;
      for(const m of mins){
        const mate=mins.some(o=>o!==m&&Math.hypot(o.x-m.x,o.z-m.z)<1.85)?1:0;
        const fd=Math.min(...fires.map(f=>Math.hypot(f.x-m.x,f.z-m.z)));
        const sc=mate*3-fd;
        if(sc>bs){bs=sc;best=m}
      }
      steps.push({t:'goto',x:best.x,z:best.z,r:.5,th:best});
    }else{
      const fire=fires[0];
      if(fire){const s=standPoint(a,fire);steps.push({t:'goto',x:s.x,z:s.z,r:s.r,th:fire})}
    }
  }
  steps.push({t:'do',verb:'combinar',x,y,dur:2.4,key:'combinar:'+comboKey(x,y)});
  return steps;
}
function planCook(a,fire){
  const foods=[...a.hands.filter(k=>K[k].food),...visibleMem(a).filter(t=>K[t.kind].food&&K[t.kind].item).map(t=>t.kind)];
  const f=pick(foods.filter(k=>['baga','cogumelo_m','cogumelo_v'].includes(k)));
  if(!f){a.tried['cozinhar']={res:'nada'};return planExplore(a)}
  const steps=[];
  if(!a.hands.includes(f)){const t=nearestOfKind(a,f);if(!t)return planExplore(a);const s=standPoint(a,t);steps.push({t:'goto',x:s.x,z:s.z,r:s.r,th:t});steps.push({t:'do',verb:'pegar',th:t,kind:f,dur:1,key:'pegar:'+f})}
  const s=standPoint(a,fire);
  steps.push({t:'goto',x:s.x,z:s.z,r:.6,th:fire});
  steps.push({t:'do',verb:'largar',kind:f,cook:true,dur:1.2,key:'cozinhar:fogo'});
  say(a,`E se eu largar ${ref(a,f)} perto de ${ref(a,'fogo')}? Quero ver.`,'think');
  return steps;
}
function tribeSite(a){
  const tr=tribeOf(a);
  if(!tr||R()<.25)return null;
  if(Math.hypot(a.x-tr.center.x,a.z-tr.center.z)>70)return null;
  for(let i=0;i<12;i++){
    const an=rnd(0,TAU),d=rnd(1.4,4.4);
    const x=tr.center.x+Math.cos(an)*d,z=tr.center.z+Math.sin(an)*d;
    if(inWater(x,z,1.2)||Math.abs(x)>EDGE||Math.abs(z)>EDGE)continue;
    if(W.things.some(t=>!t.gone&&(t.kind==='abrigo'||t.kind==='cabana'||t.kind==='totem'||t.kind==='cerca')&&Math.hypot(t.x-x,t.z-z)<1.8))continue;
    return {x,z,tribe:tr.id};
  }
  return null;
}
function sitePos(a,safe){
  if(safe){
    let b=null,bd=1e9;
    for(const c of W.cells){if(c.st!==3&&c.st!==2)continue;const d=Math.hypot(c.cx-a.x,c.cz-a.z);if(d<bd&&d<22&&!inPond(c.cx,c.cz,1.6)){bd=d;b=c}}
    if(b)return {x:b.cx,z:b.cz,safe:true};
  }
  for(let i=0;i<10;i++){const an=rnd(0,TAU),d=rnd(1.5,3.5);const x=a.x+Math.cos(an)*d,z=a.z+Math.sin(an)*d;if(!inPond(x,z,1.5)&&!inRiver(x,z,1.5)&&Math.abs(x)<EDGE&&Math.abs(z)<EDGE)return {x,z}}
  return {x:a.x,z:a.z};
}
function pileItems(pos){const p=pileAt(pos.x,pos.z);return (p&&p.data.items)||{}}
function pileAt(x,z,r=1.7){for(const t of W.things){if(t.gone)continue;if((t.kind==='pilha'||t.kind==='abrigo'||t.kind==='marco'||t.kind==='represa')&&Math.hypot(t.x-x,t.z-z)<r)return t}return null}
function planProject(a){
  const pr=a.project;if(!pr){return planExplore(a)}
  // fogueira: etapa final
  while(pr.idx<pr.tasks.length){
    const tk=pr.tasks[pr.idx];
    if(tk.final==='faiscar'){
      const ps=a.hands.filter(k=>k==='pedra').length;
      const steps=[];
      const near=nearPieces(a,pr.pos,'pedra');
      let need=2-ps-near;
      if(need>0){
        const t=nearestOfKind(a,'pedra');if(!t){failProject(a,'Não achei pedra.');return planExplore(a)}
        const s=standPoint(a,t);steps.push({t:'goto',x:s.x,z:s.z,r:s.r,th:t});steps.push({t:'do',verb:'pegar',th:t,kind:'pedra',dur:1,key:'pegar:pedra'});
        if(a.hands.length>=a.sp.cap&&!a.hands.includes('pedra')){steps.length=0;steps.push({t:'do',verb:'largar',dur:1,all:true})}
        return steps;
      }
      steps.push({t:'goto',x:pr.pos.x+.9,z:pr.pos.z,r:.4});
      steps.push({t:'do',verb:'combinar',x:'pedra',y:'pedra',dur:2.4,key:'combinar:pedra+pedra',fromProject:true,pos:pr.pos});
      pr.idx++;pr.done=true;
      return steps;
    }
    const have=tk.dest==='pile'?(pileItems(pr.pos)[tk.kind]||0):nearPieces(a,pr.pos,tk.kind);
    const cnt=tk.n||1;
    if(tk.act==='cavar'){
      const here=cellAt(pr.pos.x,pr.pos.z);
      if(here&&here.digs>=3)pr.idx++;else
      return [{t:'goto',x:pr.pos.x,z:pr.pos.z,r:.5},{t:'do',verb:'cavar',kind:'chao',gx:pr.pos.x,gz:pr.pos.z,dur:4/(.5+a.sp.dig),key:'cavar:chao'}];
      continue;
    }
    if(tk.dest==='pile'&&tk.n&&have>=tk.n||tk.dest==='near'&&have>=cnt||(!tk.n&&tk.done)){pr.idx++;continue}
    // um passeio: pegar (se preciso) e largar
    const steps=[];
    if(!a.hands.includes(tk.kind)){
      if(a.hands.length>=a.sp.cap)return [{t:'do',verb:'largar',dur:1,all:true}];
      const t=nearestOfKind(a,tk.kind);
      if(!t){failProject(a,`Não achei ${ref(a,tk.kind)} por perto.`);return planExplore(a)}
      const s=standPoint(a,t);steps.push({t:'goto',x:s.x,z:s.z,r:s.r,th:t});steps.push({t:'do',verb:'pegar',th:t,kind:tk.kind,dur:1,key:'pegar:'+tk.kind});
    }
    const off=tk.dest==='near'?{x:pr.pos.x+.9,z:pr.pos.z+.5}:{x:pr.pos.x,z:pr.pos.z};
    steps.push({t:'goto',x:pr.pos.x+(tk.dest==='near'?1.3:.9),z:pr.pos.z+.2,r:.45});
    steps.push({t:'do',verb:'largar',kind:tk.kind,dest:tk.dest,pos:pr.pos,off,dur:1.1,key:'empilhar:'+tk.kind,project:true});
    if(!tk.n)tk.done=true;
    return steps;
  }
  // terminou
  const type=pr.type;a.project=null;
  if(type==='plantacao'||type==='poco'){
    const p=pileAt(pr.pos.x,pr.pos.z);
    if(p){
      const tr=tribeOf(a);
      p.kind=type;
      p.data={tribe:tr?tr.id:null,crop:'fruta',ripe:type==='plantacao'?1:0,growT:0};
      V&&V.onChange(p);
      discover(a,type,p,type==='plantacao'?{items:{baga:2,lama:1}}:{items:{pedra:3,galho:2}});
    }
  }
  if(type==='montinho'){
    const p=pileAt(pr.pos.x,pr.pos.z);
    if(!p||p.kind==='pilha'){say(a,'Só virou um montinho de coisas. Será que serve pra algo?','think');a.tried['empilhar']={res:'nada'}}
  }
  return planExplore(a);
}
function nearPieces(a,pos,kind){let n=0;for(const t of W.things){if(t.gone||t.kind!==kind)continue;if(Math.hypot(t.x-pos.x,t.z-pos.z)<1.9)n++}return n}
function failProject(a,msg){say(a,msg+' Vou deixar pra depois.','think');a.project=null}

/* projetos intencionais a partir de receitas conhecidas */
function maybeStartRecipeProject(a){
  if(a.project||a.state==='sleep'||a.faint>0)return;
  const n=a.n,low=NEEDS.filter(k=>k==='calor'||k==='energia').sort((p,q)=>n[p]-n[q])[0];
  // deserto: sem lagoa por perto, a tribo cava um poço
  const bmHere=biomeAt(a.x,a.z,hgt(a.x,a.z));
  if(bmHere===8&&a.n.energia>.35&&R()<.03){
    const dry=nearestPond(a.x,a.z).d>24&&Math.abs(riverDist(a.x,a.z))>RIVER.width+16;
    if(dry&&!a.recipes.poco){a.recipes.poco={items:{pedra:3,galho:2}};say(a,'Aqui a água não fica. Vou fazer um poço fundo forrado de pedra.','invent')}
    if(dry&&a.recipes.poco&&!visibleMem(a).some(t=>t.kind==='poco'&&Math.hypot(t.x-a.x,t.z-a.z)<38)){
      const pos=tribeSite(a)||sitePos(a,false);
      a.project={type:'poco',pos,tasks:[{kind:'pedra',n:3,dest:'pile'},{kind:'galho',n:2,dest:'pile'}],idx:0,fails:0};
      say(a,'Vou juntar pedra e galho e cavar um poço. Assim a tribo tem água sempre.','invent');
      return;
    }
  }
  // plantação: sementes na lama perto do acampamento
  if(a.recipes.plantacao&&a.n.energia>.4&&R()<.03&&!visibleMem(a).some(t=>t.kind==='plantacao'&&Math.hypot(t.x-a.x,t.z-a.z)<34)){
    const pos=tribeSite(a)||sitePos(a,false);
    a.project={type:'plantacao',pos,tasks:[{kind:'fruta',n:2,dest:'pile'},{kind:'lama',n:1,dest:'pile'}],idx:0,fails:0};
    say(a,'Vou plantar sementes na lama. Daqui a pouco nasce comida aqui mesmo.','invent');
    return;
  }
  // de vez em quando ergue uma ponte sobre o rio, se já souber fazer
  if(a.recipes.ponte&&R()<.04&&!visibleMem(a).some(t=>t.kind==='ponte'&&Math.hypot(t.x-a.x,t.z-a.z)<42)){
    const rd=Math.abs(riverDist(a.x,a.z));
    if(rd<RIVER.width+26&&rd>RIVER.width*.7){
      const pos=riverClosestPoint(a.x,a.z);
      a.project={type:'ponte',pos,tasks:[{kind:'galho',n:3,dest:'pile'},{kind:'tronco',n:1,dest:'pile'},{kind:'pedra',n:2,dest:'pile'}],idx:0,fails:0};
      say(a,`O rio corta o caminho. Já sei como fazer ${ref(a,'ponte')}: madeira e pedra por cima.`,'invent');
      return;
    }
  }
  if(n.fome>.5&&n.sede>.5&&n.energia>.45){
    if(a.recipes.torre&&R()<.02&&!visibleMem(a).some(t=>t.kind==='torre'&&Math.hypot(t.x-a.x,t.z-a.z)<38)){
      const pos=sitePos(a,false);
      a.project={type:'torre',pos,tasks:[{kind:'pedra',n:6,dest:'pile'}],idx:0,fails:0};
      say(a,`Vou empilhar ${ref(a,'pedra')} até ficar bem alto, como ${ref(a,'torre')}.`,'invent');
      return;
    }
    if(a.recipes.marco&&R()<.015&&!visibleMem(a).some(t=>t.kind==='marco'&&Math.hypot(t.x-a.x,t.z-a.z)<30)){
      const pos=sitePos(a,false);
      a.project={type:'marco',pos,tasks:[{kind:'pedra',n:4,dest:'pile'}],idx:0,fails:0};
      say(a,`Vou juntar umas ${ref(a,'pedra')} num marco pra achar o caminho de volta.`,'invent');
      return;
    }
  }
  if(n[low]>.45)return;
  const night=daylight()<.3;
  if(low==='calor'&&a.recipes.fogo&&(night||n.calor<.35)&&!visibleMem(a).some(t=>t.kind==='fogo'&&Math.hypot(t.x-a.x,t.z-a.z)<14)){
    const pos=sitePos(a,a.lessons.burned);
    const tasks=[{kind:'galho',n:3,dest:'pile'}];
    if(a.lessons.burned||pos.safe)tasks.push({kind:'pedra',n:3,dest:'pile'});
    tasks.push({kind:'pedra',n:1,dest:'near'},{final:'faiscar'});
    a.project={type:'fogueira',pos,tasks,idx:0,fails:0};
    say(a,a.lessons.burned?`Vou fazer ${ref(a,'fogo')} de novo, mas num chão pelado e com pedras em volta pra não queimar tudo.`:`Estou gelado. Vou fazer ${ref(a,'fogo')} igual da outra vez.`,'invent');
    return;
  }
  if(low==='energia'||n.calor<.4){
    if(a.recipes.toca&&a.sp.dig>=.8){
      const pos=sitePos(a,false);a.project={type:'toca',pos,tasks:[{act:'cavar',n:3}],idx:0,fails:0};
      say(a,`Vou cavar ${ref(a,'toca')} pra dormir protegido.`,'invent');return;
    }
    const wantCabana=!!a.recipes.cabana;
    if((wantCabana||a.recipes.abrigo)&&!visibleMem(a).some(t=>(t.kind==='abrigo'||t.kind==='toca'||t.kind==='cabana')&&Math.hypot(t.x-a.x,t.z-a.z)<20)){
      const pos=tribeSite(a)||sitePos(a,false);
      a.project=wantCabana
        ?{type:'cabana',pos,tasks:[{kind:'galho',n:5,dest:'pile'},{kind:'folha',n:3,dest:'pile'}],idx:0,fails:0}
        :{type:'abrigo',pos,tasks:[{kind:'galho',n:3,dest:'pile'},{kind:'folha',n:2,dest:'pile'}],idx:0,fails:0};
      say(a,wantCabana?`Vou fazer uma ${ref(a,'cabana')} maior: mais galhos e um teto grosso de folhas.`:`Preciso de ${ref(a,'abrigo')}. Já sei como fazer: galhos e folhas.`,'invent');
    }
  }
}

/* =====================  EXECUÇÃO  ===================== */
function nearestBlockedFix(a){
  // Águas e costa são atravessáveis; a necessidade de respirar guia o retorno ao habitat.
  for(const t of W.things){if(t.gone)continue;if(t.kind==='arvore'||t.kind==='pinheiro'||t.kind==='computador'||t.kind==='mural'||t.kind==='quadro'||t.kind==='totem'){
    const rad=t.kind==='computador'?1.7:t.kind==='mural'?1.8:t.kind==='quadro'?1.3:t.kind==='totem'?1.1:.75;const d=Math.hypot(a.x-t.x,a.z-t.z);
    if(d<rad){const an=Math.atan2(a.z-t.z,a.x-t.x);a.x=t.x+Math.cos(an)*rad;a.z=t.z+Math.sin(an)*rad}}}
  // cerca da tribo: só as estacas bloqueiam, o portão fica aberto
  for(const t of W.things){if(t.gone||t.kind!=='cerca')continue;
    if(a.tribeId&&a.tribeId===t.data.tribe)continue;
    const d=Math.hypot(a.x-t.x,a.z-t.z),rr=t.data.r||5.5;
    if(Math.abs(d-rr)<.5){const an=Math.atan2(a.z-t.z,a.x-t.x);
      const diff=((an-(t.data.gate||0)+Math.PI)%TAU+TAU)%TAU-Math.PI;
      if(Math.abs(diff)>.42){
        a.x=t.x+Math.cos(an)*(rr+(d>rr?.65:-.65));
        a.z=t.z+Math.sin(an)*(rr+(d>rr?.65:-.65));
      }}
  }
  // Separação entre bichos: impede que modelos reais passem uns por cima dos outros.
  for(const other of W.animals){
    if(other===a||other.gone)continue;
    const dx=a.x-other.x,dz=a.z-other.z;
    const d=Math.hypot(dx,dz);
    const min=animalRadius(a.sp)+animalRadius(other.sp);
    if(d<min){
      const angle=d>.001?Math.atan2(dz,dx):((a.id*2.399)%TAU);
      const nx=Math.cos(angle),nz=Math.sin(angle),push=(min-d)*.6;
      a.x+=nx*push;a.z+=nz*push;
      other.x-=nx*push*.35;other.z-=nz*push*.35;
    }
  }
  a.x=clamp(a.x,-(HALF-1.5),HALF-1.5);a.z=clamp(a.z,-(HALF-1.5),HALF-1.5);
  a.x=clamp(a.x,-(HALF-1.5),HALF-1.5);a.z=clamp(a.z,-(HALF-1.5),HALF-1.5);
}
function curSpeed(a){
  let s=a.sp.speed*(1-.15*(1-daylight()))*(a.n.energia<.2?.7:1);
  if(a.fleeing)s*=1.5;
  const onBridge=W.things.some(t=>!t.gone&&t.kind==='ponte'&&Math.hypot(t.x-a.x,t.z-a.z)<5.2);
  if(!onBridge){
    if(inPond(a.x,a.z,1.06))s*=.55;
    else if(inRiver(a.x,a.z,1.06))s*=.7;
  }
  if(floodAt(a.x,a.z))s*=.62;
  s*=1-.16*(W.snow||0);
  return s;
}
function runPlan(a,dt){
  const p=a.plan;
  if(!p){a.idle-=dt;a.state='idle';if(a.idle<=0)decide(a);return}
  const s=p.steps[p.i];
  if(!a.cur){a.cur={t:0};beginStep(a,s)}
  if(!a.plan)return;
  a.cur.t+=dt;
  switch(s.t){
    case 'goto':{
      if(s.th&&s.th.gone&&!s.follow){abortPlan(a,'Cadê? Sumiu o que eu queria.');return}
      let tx=s.x,tz=s.z;if(s.follow&&s.th){tx=s.th.x;tz=s.th.z}
      const dx=tx-a.x,dz=tz-a.z,d=Math.hypot(dx,dz);
      if(d<=s.r){nextStep(a);a.stuckD=null;return}
      if(a.cur.t>d/Math.max(.5,curSpeed(a))*2.4+10){abortPlan(a,'Não consigo chegar lá…');a.stuckD=null;return}
      // desvio: se não aproximar por 1,2s, anda de lado em volta do obstáculo
      if(a.stuckD==null||d<a.stuckD-.12){a.stuckD=d;a.stuckT=W.t}
      let ang=Math.atan2(dz,dx);
      if(W.t-a.stuckT>1.2){
        if(!a.sideUntil||W.t>a.sideUntil){a.sideSign=-(a.sideSign||1);a.sideUntil=W.t+1.2}
        ang+=a.sideSign*1.35;
      }
      // Quem mora na tribo só atravessa a cerca pelo portão.
      // Rota ao longo do círculo da palissada até o vão marcado, em vez de empurrar o bicho contra a madeira.
      if(a.tribeId&&!s.gate){
        const tr=tribeOf(a);
        if(tr){
          const st=W.things.find(t=>!t.gone&&t.kind==='cerca'&&t.data.tribe===tr.id);
          if(st){
            const rr=st.data.r||5.6,ga=st.data.gate||0;
            const gx=tr.center.x+Math.cos(ga)*rr,gz=tr.center.z+Math.sin(ga)*rr;
            const dNow=Math.hypot(a.x-tr.center.x,a.z-tr.center.z);
            const dTarget=Math.hypot(tx-tr.center.x,tz-tr.center.z);
            const outsideNow=dNow>rr-.15,outsideTarget=dTarget>rr+.15;
            if(outsideNow!==outsideTarget){
              if(Math.hypot(a.x-gx,a.z-gz)>1.15){
                const aa=Math.atan2(a.z-tr.center.z,a.x-tr.center.x);
                const gaAngle=ga;
                const curDelta=((aa-gaAngle+Math.PI*3)%TAU)-Math.PI;
                const side=curDelta>=0?-1:1;
                ang=Math.atan2(gz-a.z,gx-a.x);
                if(Math.abs(curDelta)>.25){
                  const ringAn=gaAngle+side*Math.min(Math.abs(curDelta),.55);
                  const rx=tr.center.x+Math.cos(ringAn)*rr,rz=tr.center.z+Math.sin(ringAn)*rr;
                  ang=Math.atan2(rz-a.z,rx-a.x);
                }
              }else{
                ang=Math.atan2(tz-a.z,tx-a.x);
                if(!a.lessons.gate){
                  a.lessons.gate=true;
                  if(R()<.3)ev('🚪',`${nameTag(a)} aprendeu a entrar e sair de <b>${tr.name}</b> pelo portão.`,a);
                }
              }
            }
          }
        }
      }
      const sp=curSpeed(a)*dt;
      a.x+=Math.cos(ang)*sp;a.z+=Math.sin(ang)*sp;
      const ty=Math.atan2(dx,dz);let dy=ty-a.yaw;while(dy>Math.PI)dy-=TAU;while(dy<-Math.PI)dy+=TAU;a.yaw+=dy*Math.min(1,dt*8);
      a.walk+=sp*1.8;a.state='move';
      nearestBlockedFix(a);
      if(s.explore){const kk=Math.floor(a.x/6)+','+Math.floor(a.z/6);a.vc[kk]=(a.vc[kk]||0)+dt*.2}
      break;}
    case 'do':
      a.state='do';
      if(a.cur.t>=s.dur){finishDo(a,s);}
      break;
    case 'stay':
      a.state='stay';
      if(a.cur.t>=s.dur){finishLearn(a,s,{kind:s.kind});nextStep(a)}
      break;
    case 'sleep':
      a.state='sleep';a.stats.slept+=dt;
      if(a.n.energia>=.93||a.cur.t>s.max||a.n.fome<.08||a.n.sede<.06||a.heat.burn){
        if(a.heat.burn)say(a,'Quente! Acordei assustado!','alert');
        finishLearn(a,s,{});nextStep(a);
      }
      break;
    case 'talk':
      a.state='talk';
      if(a.cur.t>=s.dur){converse(a,s.with);finishLearn(a,s,{});nextStep(a)}
      break;
  }
}
function beginStep(a,s){
  a.cur.before=snap(a);
  if(s.t==='goto'){a.stuckD=null;a.stuckT=W.t;a.sideUntil=0}
  if(s.t==='do'||s.t==='stay'||s.t==='sleep'||s.t==='talk'){
    if(s.th&&s.th.x!==undefined){a.yaw=Math.atan2(s.th.x-a.x,s.th.z-a.z)}
  }
  if(s.t==='sleep'){
    if(a.heat.warm>.3)say(a,'Aqui está quentinho. Vou fechar os olhos.','think');
    else say(a,pick(['Zzz… vou dormir um pouco.','Meus olhos estão pesados…']),'think');
  }
  if(s.t==='stay'&&s.kind==='fogo')say(a,`Estou perto de ${ref(a,'fogo')}. É quentinho aqui, mas sinto o calor forte.`,'think');
  if(s.t==='talk'){s.with.talkWith=a}
}
function nextStep(a){const p=a.plan;if(!p)return;p.i++;a.cur=null;if(p.i>=p.steps.length)endPlan(a)}
function finishLearn(a,s,extra){
  if(!s.key)return;
  const l=learnFrom(a,s.key,a.cur.before,extra&&extra.eff);
  react(a,s,l,extra);
}

/* ---- efeitos dos verbos ---- */
function feed(a,v){a.n.fome=clamp(a.n.fome+v);a.stats.eaten++;}
function removeFromHand(a,k){const i=a.hands.indexOf(k);if(i>=0)a.hands.splice(i,1);a.handT=W.t}
function giveHand(a,k){a.hands.push(k);a.handT=W.t}
function spawnItem(kind,x,z,data){const an=rnd(0,TAU),d=rnd(.6,1.3);return addThing(kind,x+Math.cos(an)*d,z+Math.sin(an)*d,data||{})}

function finishDo(a,s){
  const res=execVerb(a,s)||{};
  if(res.abort){nextStepAfterAbort(a);return}
  if(s.key){
    const extra={};
    if(res.extra)Object.assign(extra,res.extra);
    const l=learnFrom(a,s.key,a.cur.before,extra);
    react(a,s,l,res);
  }
  nextStep(a);
}
function nextStepAfterAbort(a){nextStep(a)}

/* ---- mural: riscos e tentativas de escrita ---- */
function boardOf(kind){
  if(kind==='quadro'){if(!W.quadro)W.quadro={marks:[]};return W.quadro}
  if(!W.mural)W.mural={marks:[]};return W.mural;
}
function muralAdd(m,kind){
  const b=boardOf(kind);b.marks.push(m);
  if(b.marks.length>34)b.marks.shift();
  V&&V.onMural&&V.onMural(kind);
}
function drawOnMural(a,kind){
  const strokes=[],ns=rint(2,3);
  for(let s=0;s<ns;s++){
    const pts=[];let x=rnd(.1,.9),y=rnd(.12,.88);pts.push([x,y]);
    const n=rint(6,10);
    for(let i=0;i<n;i++){x=clamp(x+rnd(-.09,.09),.05,.95);y=clamp(y+rnd(-.07,.07),.06,.94);pts.push([x,y])}
    strokes.push(pts);
  }
  muralAdd({type:'shape',strokes,w:rnd(3,7),col:rint(0,5),by:a.id,t:W.t},kind);
}
function muralWordOf(a){
  const ws=[];
  if(a.name)ws.push(a.name);
  for(const k in a.lex)if(/^[kv]:/.test(k))ws.push(a.lex[k]);
  if(ws.length&&R()<.85)return pick(ws);
  let s='';const n=rint(3,5);
  for(let i=0;i<n;i++)s+=pick(a.phon.c)+pick(a.phon.v);
  return s;
}
function writeOnMural(a,kind){
  const txt=muralWordOf(a);
  muralAdd({type:'word',txt,x:rnd(.16,.84),y:rnd(.2,.8),rot:rnd(-.4,.4),size:rint(20,42),col:rint(0,5),by:a.id,t:W.t},kind);
  return txt;
}

function execVerb(a,s){
  const t=s.th;const verb=s.verb;const kind=s.kind;
  if(t&&t.gone){say(a,'Hmm, sumiu antes de eu mexer.','think');return {abort:true}}
  switch(verb){
    case 'provar':{
      const fromHand=s.hand;
      const eat=(k)=>{
        switch(k){
          case 'moita':if(t.data.b>0){t.data.b--;V&&V.onChange(t);feed(a,.26);return 'comeu'}return 'vazio';
          case 'baga':feed(a,.17);return 'comeu';
          case 'baga_assada':feed(a,.32);a.n.calor=clamp(a.n.calor+.05);return 'comeu';
          case 'cogumelo_m':feed(a,.26);return 'comeu';
          case 'cogumelo_assado':feed(a,.34);return 'comeu';
          case 'cogumelo_v':feed(a,.06);a.n.saude=clamp(a.n.saude-.24*a.sp.tough);a.n.energia=clamp(a.n.energia-.1);a.pain=1;return 'veneno';
          case 'raiz':feed(a,a.spk==='toupeira'?.3:.24);return 'comeu';
          case 'minhoca':feed(a,a.spk==='toupeira'?.22:.1);return 'comeu';
          case 'folha':feed(a,.04);return 'fraco';
          case 'flor':a.curio=clamp(a.curio+.08);a.n.social=clamp(a.n.social+.03);return 'cheiroso';
          case 'capim':feed(a,.1);return 'fraco';
          case 'samambaia':feed(a,.07);a.n.calor=clamp(a.n.calor+.01);return 'fraco';
          case 'pinha':feed(a,a.spk==='guaxinim'?.16:.14);return 'comeu';
          case 'peixe':feed(a,.28);a.n.sede=clamp(a.n.sede+.04);return 'comeu';
          case 'bagre':{
            feed(a,.38);a.n.sede=clamp(a.n.sede+.05);
            if(R()<.8){spawnItem('couro',a.x,a.z,{});discoverSkin(a)}
            return 'comeu';
          }
          case 'alga':feed(a,.18);return 'comeu';
          case 'concha':feed(a,.24);return 'comeu';
          case 'couro':a.n.calor=clamp(a.n.calor+.03);return 'pele';
          case 'bronze':a.n.saude=clamp(a.n.saude-.04);return 'dura';
          case 'fruta':feed(a,.24);a.n.sede=clamp(a.n.sede+.03);return 'comeu';
          case 'junco':feed(a,.1);return 'fraco';
          case 'agua':a.n.sede=clamp(a.n.sede+.42);a.stats.drank++;return 'bebeu';
          case 'poco':a.n.sede=clamp(a.n.sede+.58);a.stats.drank++;return 'bebeu';
          case 'lama':a.n.sede=clamp(a.n.sede+.02);return 'nada';
          case 'pedra':case 'mineral':a.n.saude=clamp(a.n.saude-.02);return 'dura';
          case 'curativo':if(a.n.saude<.95){a.n.saude=clamp(a.n.saude+.35);return 'curou'}return 'nada';
          case 'represa':if(t.data.fish>0){t.data.fish--;feed(a,.2);return 'comeu'}return 'vazio';
          default:return 'nada';
        }
      };
      const r=eat(fromHand?kind:t.kind);
      const keep=fromHand&&['bronze','lanca','armadura','roupa','machado','picareta'].includes(kind);
      if(fromHand&&!keep)removeFromHand(a,kind);
      else if(t&&K[t.kind].item&&t.kind!=='lama'&&r!=='dura'&&r!=='nada'&&!['represa'].includes(t.kind)){removeThing(t)}
      else if(t&&t.kind==='lama'&&!t.data.patch)removeThing(t);
      if(a.spk==='vombate'&&(r==='comeu')&&R()<.5)spawnItem('cubinho',a.x,a.z);
      return {r};
    }
    case 'pegar':{
      const k=s.kind;
      if(a.hands.length>=a.sp.cap)return {r:'cheio'};
      if(k==='moita'){if(t.data.b<=0)return {r:'vazio'};t.data.b--;V&&V.onChange(t);giveHand(a,'baga');return {r:'pegou',got:'baga'}}
      if(k==='lama'){giveHand(a,'lama');if(!t.data.patch)removeThing(t);return {r:'pegou',got:'lama'}}
      giveHand(a,k);removeThing(t);return {r:'pegou',got:k};
    }
    case 'sacudir':case 'roer':{
      if(t.data.br>0){
        t.data.br--;
        if(verb==='roer'){spawnItem('tronco',t.x,t.z);spawnItem('galho',t.x,t.z);return {r:'caiu',got:'tronco'}}
        spawnItem('galho',t.x,t.z);if(a.hands.includes('machado'))spawnItem('galho',t.x,t.z);
        return {r:'caiu',got:'galho'};
      }
      return {r:'nada'};
    }
    case 'cavar':{
      const gx=s.gx!==undefined?s.gx:t.x,gz=s.gz!==undefined?s.gz:t.z;
      const c=cellAt(gx,gz);
      if(c&&c.st!==4){
        c.digs++;if(c.st===0||c.st===2){c.st=3;c.f=0;c.rg=rnd(200,300);V&&V.paintCell(c)}
        a.lastDig={x:gx,z:gz,t:W.t,cell:c};a.stats.dug++;
        // toca
        if(c.digs>=3&&!W.things.some(x=>!x.gone&&x.kind==='toca'&&Math.hypot(x.x-c.cx,x.z-c.cz)<3)){
          const toca=addThing('toca',c.cx,c.cz,{by:a});
          discover(a,'toca',toca,{});
        }
      }
      let r='nada',got=null;
      const mach=a.hands.includes('machado')?1.5:1;
      if(t&&t.kind==='monte'){
        removeThing(t);const q=R();
        if(q<.55){got='raiz'}else if(q<.8){got='minhoca'}else got='pedra';
      }else{
        const q=R();if(q<.1*mach)got='raiz';else if(q<.16)got='pedra';
      }
      if(got){spawnItem(got,gx,gz);r='achou'}
      return {r,got};
    }
    case 'largar':return doDrop(a,s);
    case 'olhar':{
      a.curio=clamp(a.curio+.06);
      if(kind==='computador'){maybeCoin(a,'k:computador',1);return {r:'tela'}}
      return {r:'nada'};
    }
    case 'decifrar':{
      if(kind!=='ruina')return {r:'nada'};
      a.curio=clamp(a.curio+.07);
      t.data.dec=(t.data.dec||0)+1+(a.curio>.85?1:0);
      const d=t.data.dec,g=t.data.glyphs||[];
      if(d===1)say(a,'Esses riscos não são só desenho. Um povo antigo deixou um recado aqui.','think');
      const learn=i=>{if(g[i]&&!a.knowledge['sinal '+g[i]]){a.knowledge['sinal '+g[i]]=true;say(a,`Aquele risco quer dizer “${g[i]}”. Mais uma palavra antiga.`,'learn')}};
      if(d>=3)learn(0);
      if(d>=6)learn(1);
      if(d>=9)learn(2);
      if(d>=6&&!a.knowledge['números']){
        a.knowledge['números']=true;
        const tr=tribeOf(a);
        if(tr)inventNumerals(tr);
        else{a.recipes.numeros=true;say(a,'Um risco, dois riscos, três… os antigos contavam com marcas. Eu também posso contar!','invent');ev('🔢',`${nameTag(a)} aprendeu a contar com os sinais das ruínas.`,a)}
      }
      if(d>=12&&!t.data.done){
        t.data.done=true;
        t.data.doneBy=a.id;
        t.data.doneDay=dayNum();
        const tr=tribeOf(a);
        if(tr){tr.inscription=g.join(' ');inventNumerals(tr)}
        a.knowledge['ruínas']=true;
        say(a,`Consegui! A pedra conta de um povo que morou aqui antes: “${g.join(' ')}”. Agora eu sei ler o passado.`,'learn');
        ev('📜',`${nameTag(a)} decifrou a inscrição da ruína: “${g.join(' ')}”. Uma língua morta voltou a falar.`,a);
        W.stats.inventions++;UI&&UI.onInvent&&UI.onInvent(a);
      }
      return {r:'decifrou',n:d};
    }
    case 'apertar':{
      if(kind==='computador'){
        maybeCoin(a,'k:computador',.7);
        const q=R();
        if(q<.25)return {r:'bip'};
        if(q<.6)return {r:'cor'};
        return {r:'tela'};
      }
      return {r:'nada'};
    }
    case 'desenhar':{
      a.curio=clamp(a.curio+.08);a.n.social=clamp(a.n.social+.05);
      if(kind==='mural'||kind==='quadro'){
        drawOnMural(a,kind);
        maybeCoin(a,'k:'+kind,.9);maybeCoin(a,'v:desenhar',.6);
        return {r:'desenhou'};
      }
      return {r:'nada'};
    }
    case 'escrever':{
      a.curio=clamp(a.curio+.06);a.n.social=clamp(a.n.social+.05);
      if(kind==='mural'||kind==='quadro'){
        const txt=writeOnMural(a,kind);
        maybeCoin(a,'k:'+kind,.7);maybeCoin(a,'v:escrever',.75);
        return {r:'escreveu',txt};
      }
      return {r:'nada'};
    }
    case 'rezar':{
      if(kind!=='totem')return {r:'nada'};
      const tr=W.tribes.find(tr=>tr.id===a.tribeId);
      a.n.social=clamp(a.n.social+.08);a.n.saude=clamp(a.n.saude+.015);
      if(tr&&tr.faith){
        tr.faith.piety=clamp((tr.faith.piety||0)+.05);
        W.stats.rituals=(W.stats.rituals||0)+1;
        const p=pick(tr.faith.prayers&&tr.faith.prayers.length?tr.faith.prayers:[{word:tr.faith.name,gloss:'o espírito'}]);
        say(a,`${pick(['Eu peço ao','Falo com','Escuto'])} <b>${p.word}</b>, ${p.gloss}.`,'think');
        if(R()<.35)ev('🕯️',`${nameTag(a)} fez uma prece ao <b>${tr.faith.name}</b> (${tr.faith.gloss}).`);
      }
      return {r:'rezou'};
    }
    case 'pesquisar':{
      if(kind!=='computador')return {r:'nada'};
      maybeCoin(a,'k:computador',.6);
      maybeCoin(a,'v:pesquisar',1);
      a.research=(a.research||0)+1;a.researchT=W.t;
      const topic=pickResearchTopic(a);
      const first=!a.knowledge[topic[0]];
      a.knowledge[topic[0]]=true;
      a.curio=clamp(a.curio+.05);a.n.social=clamp(a.n.social+.02);
      applyInternet(a,topic[0],first);
      if(first)ev('🔎',`${nameTag(a)} pesquisou na internet e aprendeu sobre <b>${topic[0]}</b>.`);
      return {r:'pesquisou',topic:topic[0],first};
    }
    case 'minerar':{
      if(kind!=='minerio')return {r:'nada'};
      maybeCoin(a,'k:minerio',.7);maybeCoin(a,'v:minerar',.6);
      const pick=a.hands.includes('picareta'),mach=a.hands.includes('machado');
      if(!pick&&!mach)return {r:'duro'};
      const n=pick?rint(2,3):1;
      removeThing(t);
      for(let i=0;i<n;i++)spawnItem('mineral',t.x,t.z);
      a.curio=clamp(a.curio+.06);
      if(!a.recipes.mineral){
        a.recipes.mineral={items:{minerio:1}};
        a.inventions.push({kind:'mineral',name:a.lex['k:mineral']||null,t:W.t,txt:K.mineral.g});
        W.stats.inventions++;UI&&UI.onInvent&&UI.onInvent(a);
      }
      return {r:'minerou',got:'mineral',n};
    }
    case 'pescar':{
      if(kind!=='agua'&&kind!=='represa')return {r:'nada'};
      if(!a.recipes.pesca){a.recipes.pesca={innate:false};a.inventions.push({kind:'pesca',name:a.lex['k:pesca']||null,t:W.t,txt:'pegar peixe com as mãos'});W.stats.inventions++;ev('🎣',`${nameTag(a)} aprendeu a <b>pescar</b> com as próprias mãos.`,a);UI&&UI.onInvent&&UI.onInvent(a)}
      const good=(a.sp.swim?.8:a.sp.curio>.7?.55:.35);
      if(R()<good){
        a.stats.fished=(a.stats.fished||0)+1;
        if(a.hands.length<a.sp.cap){giveHand(a,'peixe');return {r:'pescou',got:'peixe'}}
        feed(a,.28);a.n.sede=clamp(a.n.sede+.04);return {r:'pescou',ate:true};
      }
      return {r:'nada'};
    }
    case 'colher':{
      if(kind!=='plantacao')return {r:'nada'};
      if((t.data.ripe|0)>0){
        t.data.ripe--;t.data.growT=0;
        V&&V.onChange(t);
        const got=t.data.crop||'baga';
        if(a.hands.length<a.sp.cap)giveHand(a,got);
        else feed(a,.2);
        return {r:'colheu',got};
      }
      return {r:'vazio'};
    }
    case 'combinar':return doCombine(a,s);
  }
  return {};
}

function doDrop(a,s){
  if(s.all){const n=a.hands.length;for(const k of a.hands.slice()){spawnItem(k,a.x,a.z,{})}a.hands.length=0;return {r:'largou',n}}
  const k=s.kind;
  if(!a.hands.includes(k))return {r:'nada'};
  removeFromHand(a,k);
  if(s.cook){
    const fire=W.things.find(t=>!t.gone&&t.kind==='fogo'&&Math.hypot(t.x-a.x,t.z-a.z)<2.7);
    if(fire&&(k==='baga'||k==='cogumelo_m')){
      const nk=k==='baga'?'baga_assada':'cogumelo_assado';
      const it=spawnItem(nk,fire.x,fire.z);it.y=0;a.tried['cozinhar']={res:'assou'};
      say(a,`Olha! ${ref(a,k)} perto do fogo ficou diferente… e cheirosa!`,'invent');
      discoverCook(a);
      return {r:'assou',got:nk};
    }
    if(fire&&k==='cogumelo_v'){spawnItem('cogumelo_assado',fire.x,fire.z);a.tried['cozinhar']={res:'assou'};return {r:'assou',got:'cogumelo_assado',bad:true}}
    a.tried['cozinhar']={res:'nada'};
    spawnItem(k,a.x,a.z);return {r:'nada'};
  }
  if(s.project&&s.dest==='pile'){addToPile(a,k,s.pos.x,s.pos.z);return {r:'empilhou'}}
  const off=s.off||{x:a.x,z:a.z};
  addThing(k,off.x,off.z,{});
  return {r:'largou'};
}
function discoverCook(a){
  if(!a.recipes.cozinhar){a.recipes.cozinhar={txt:'largar comida perto do fogo'};a.inventions.push({kind:'cozinhar',name:null,t:W.t,txt:'esquentar comida no fogo'});
    maybeCoin(a,'v:cozinhar',1);W.stats.inventions++;ev('🍖',`${nameTag(a)} descobriu que comida perto do fogo fica assada.`);UI&&UI.onInvent&&UI.onInvent(a)}
}
function discoverSkin(a){
  if(a.recipes.couro)return;
  a.recipes.couro={from:'bagre'};
  maybeCoin(a,'k:couro',1,'A pele do bagre é grossa! Vou chamar de');
  a.inventions.push({kind:'couro',name:a.lex['k:couro']||null,t:W.t,txt:K.couro.g});
  W.stats.inventions++;
  ev('🐟',`${nameTag(a)} descobriu que a pele do <b>bagre</b> vira <b>couro</b> útil.`);
  UI&&UI.onInvent&&UI.onInvent(a);
}

function addToPile(a,kind,x,z){
  let p=pileAt(x,z);
  if(!p)p=addThing('pilha',x,z,{items:{},by:a});
  p.data.items[kind]=(p.data.items[kind]||0)+1;
  a.stats.built++;
  classify(p,a);
  V&&V.onChange(p);
  maybeCoin(a,'v:empilhar',a.stats.built>=3?.8:0);
}
function classify(p,a){
  if(p.kind!=='pilha'&&p.kind!=='abrigo')return;
  const it=p.data.items;const g=(it.galho||0)+2*(it.tronco||0),f=it.folha||0,l=it.lama||0,pe=(it.pedra||0),cu=(it.cubinho||0);
  const near=nearestPond(p.x,p.z);
  const nr=riverDist(p.x,p.z)<RIVER.width+5;
  const bm=biomeAt(p.x,p.z,hgt(p.x,p.z));
  let nk=null;
  if(p.kind==='abrigo'){
    if(g>=5&&f>=3)nk='cabana';
  }else{
    if(g>=3&&f>=2)nk='abrigo';
    else if(nr&&g>=3&&pe>=2)nk='ponte';
    else if(g>=3&&l>=2&&near.d<7)nk='represa';
    else if(bm===8&&pe>=3&&g>=2)nk='poco';
    else if(pe+cu>=6&&pe>=3)nk='torre';
    else if(pe+cu>=4&&pe>=2)nk='marco';
    else if(cu>=2&&(it.tronco||0)>=2&&f>=1)nk='celeiro';
  }
  if(nk){
    p.kind=nk;p.data.by=a;if(nk==='represa')p.data.fish=3;
    const tr=tribeOf(a);
    if(tr&&(nk==='abrigo'||nk==='cabana')){p.data.tribe=tr.id;p.data.style=tr.culture.style;p.data.roof=CULTURES[tr.faith.element].roof;p.data.house=true}
    V&&V.onChange(p);
    discover(a,nk,p,{items:Object.assign({},it)});
  }
}
function discover(a,kind,thing,rec){
  const first=!a.recipes[kind];
  if(first){
    a.recipes[kind]=rec.items?{items:rec.items}:{dig:3};
    maybeCoin(a,'k:'+kind,1,'Criei algo! Vou chamar de');
    a.inventions.push({kind,name:a.lex['k:'+kind]||null,t:W.t,txt:K[kind].g});
    W.stats.inventions++;W.inventions.push({by:a.id,kind,t:W.t});
    const wd=a.lex['k:'+kind]?wordHTML(a.lex['k:'+kind],K[kind].g):K[kind].g;
    ev(kind==='toca'?'🕳️':kind==='plantacao'?'🌱':kind==='poco'?'💧':'🛠️',`${nameTag(a)} inventou ${/a$/.test(K[kind].g)&&kind!=='marco'&&kind!=='celeiro'?'uma':'um'} <b>${K[kind].g}</b>${a.lex['k:'+kind]?` e chamou de ${wd}`:''}.`,a);
    const TXT={
      toca:'Cavei, cavei e agora tem um buraco fundo só meu! Aqui eu fico protegido.',
      abrigo:'Galhos e folhas juntos formam um cantinho que protege do vento!',
      cabana:'Minha casa cresceu! Ficou alta, com teto de folhas. Cabe até visita.',
      represa:'Galhos e lama na beira da água seguram os peixinhos!',
      ponte:'Deitei madeira por cima da água. Agora dá pra atravessar sem molhar tudo!',
      torre:'Pedra sobre pedra, cada vez mais alto. Daqui de cima eu vejo longe!',
      celeiro:'Fiz um monte oco pra guardar comida. Assim não passa fome no frio.',
      marco:'Pedras empilhadas… ficou bonito. É meu marco!',
      poco:'Cavei até achar água no fundo escuro. Agora a sede não me vence aqui.',
      plantacao:'Fileiras de folhas novas! Daqui a pouco tem comida nascendo aqui.',
    };
    say(a,TXT[kind]||'Fiz uma coisa nova!','invent');
    a.curio=clamp(a.curio-.2);
    UI&&UI.onInvent&&UI.onInvent(a);
  }
}

/* ---- internet: temas livres que eles podem pesquisar ---- */
const RESEARCH=[
 ['direitos dos animais','todo bicho merece comida, abrigo e ser tratado com carinho'],
 ['estrelas','de noite o céu tem pontos que brilham e giram devagar'],
 ['música','sons podem se juntar e virar uma coisa boa de ouvir'],
 ['desenho','riscos podem mostrar o que a gente vê por dentro'],
 ['amizade','dar comida e fazer companhia aproxima os bichos'],
 ['dinossauros','antes de tudo havia bichos enormes que sumiram'],
 ['rio','a água corre do alto pra baixo e sempre acha um caminho'],
 ['montanhas','a pedra sobe tão alto que fura a nuvem'],
 ['cavernas','dentro da montanha tem buracos escuros e pedras que brilham'],
 ['minerais','pedras com veios brilhantes podem virar ferramenta'],
 ['ferramentas','juntar pedra e madeira faz uma coisa mais forte'],
 ['construções','madeira, folha e pedra podem virar casa'],
 ['pesca','peixe fica fundo na água e brilha quando vira'],
 ['plantas','fruta, folha e raiz nascem de sementes pequenas'],
 ['cogumelos','cogumelo gosta de lugar úmido e de madeira velha'],
 ['bichos','cada bicho tem um jeito de viver e de falar'],
 ['internet','a caixa se liga a outras caixas pelo mundo inteiro'],
 ['computadores','a caixa pensa com uns risquinhos acesos'],
 ['lua','de noite tem uma bola de luz que muda de forma'],
 ['nuvens','a água sobe, vira nuvem e volta como chuva'],
 ['chuvas','a nuvem fica pesada e a água cai'],
 ['idiomas','cada bicho fala diferente e pode aprender o do outro'],
 ['escrita','riscos podem guardar palavras'],
 ['receitas','comida quente mata mais fome que comida crua'],
 ['cachoeira','a água cai de um degrau e faz muito barulho'],
 ['taiga','é um lugar frio, cheio de pinheiros e pinhas'],
 ['pântano','é molhado, escuro e cheio de segredo'],
 ['pantanal','a água rasa cobre o chão e enche de plantas'],
 ['inverno','quando o frio chega, a comida some e o chão gela'],
 ['pesca com as mãos','devagar e sem barulho, o peixe chega perto'],
 ['escrita antiga','povos que viveram aqui deixaram riscos e letras nas pedras'],
 ['números','dá pra contar nos dedos e riscar marcas pra não esquecer'],
 ['engenharia','ponte precisa de apoio firme nas duas margens'],
 ['neve','a neve cobre o chão e guarda o calor embaixo'],
 ['tempestades','o trovão é a nuvem rachando de tanta água'],
 ['deserto','areia até onde a vista alcança, e quase ninguém mora lá'],
 ['cerrado','capim alto e moitas, com poucas árvores no meio'],
];
const INTERESTS={
 castor:['rio','construções','ferramentas','pântano'],
 guaxinim:['pesca','plantas','lua'],
 toupeira:['minerais','cavernas','montanhas'],
 marmota:['montanhas','inverno','cavernas'],
 vombate:['construções','plantas','receitas'],
 porco_espinho:['plantas','inverno','cogumelos'],
 porco_india:['plantas','amizade','chuvas'],
 esquilo:['plantas','idiomas','estrelas'],
 nutria:['pesca','rio','pantanal'],
 cuica:['plantas','estrelas','música'],
 capivara:['pantanal','plantas','pesca'],
 pug:['bichos','amizade','direitos dos animais'],
 besouro_rinoceronte:['ferramentas','minerais','construções'],
 serra_pau:['pântano','plantas','cogumelos'],
 sapo:['pântano','chuvas','pesca'],
 besouro_tartaruga:['pântano','plantas','construções'],
 cigarra_bola:['música','estrelas','plantas'],
 rola_bosta:['bichos','plantas','chuvas'],
 prea:['plantas','pantanal','amizade'],
 lontra:['pesca','rio','amizade'],
 joaninha:['plantas','direitos dos animais','desenho'],
 besouro_fungo:['cogumelos','pântano','plantas'],
 tatu:['cavernas','minerais','escrita antiga'],
 coruja:['estrelas','escrita antiga','lua'],
 cotia:['plantas','engenharia','receitas'],
 calango:['deserto','estrelas','bichos'],
 cascavel:['deserto','bichos','lua'],
 escorpiao:['deserto','minerais','cavernas'],
 feneco:['deserto','estrelas','amizade'],
 camelo:['deserto','chuvas','nuvens'],
 paca:['plantas','pesca','receitas'],
 tamandua:['bichos','plantas','minerais'],
 garca:['pesca','pantanal','rio'],
 jaguatirica:['bichos','idiomas','estrelas'],
};
function pickResearchTopic(a){
  const known=a.knowledge||{};
  const fresh=RESEARCH.filter(r=>!known[r[0]]);
  const pool=fresh.length?fresh:RESEARCH;
  const ints=(INTERESTS[a.spk]||[]).filter(t=>pool.some(r=>r[0]===t));
  if(ints.length&&R()<.75){const t=pick(ints);const r=pool.find(x=>x[0]===t);if(r)return r}
  return pick(pool);
}
function applyInternet(a,topic,first){
  const hint=(key,eff)=>{if(!a.mem[key])a.mem[key]={n:1,eff,last:W.t,heard:true}};
  switch(topic){
    case 'peixe':case 'pesca':case 'pesca com as mãos':
      hint('provar:peixe',{fome:.16});
      if(first&&!a.recipes.pesca){a.recipes.pesca={innate:false};say(a,`A caixa mostrou ${ref(a,'peixe')}: esperar na beira, quietinho, e pegar com a mão. Vou pescar!`,'learn')}
      break;
    case 'plantas':
      hint('provar:fruta',{fome:.15});
      if(first&&!a.recipes.plantacao){a.recipes.plantacao={items:{baga:2,lama:1}};say(a,`A caixa mostrou ${ref(a,'plantacao')}: enterrar sementes na lama e esperar crescer.`,'learn')}
      break;
    case 'cogumelos':hint('provar:cogumelo_m',{fome:.15});break;
    case 'pantanal':hint('provar:junco',{fome:.08});break;
    case 'taiga':hint('provar:pinha',{fome:.09});break;
    case 'rio':
      hint('provar:agua',{sede:.12});
      if(first&&!a.recipes.ponte){a.recipes.ponte={items:{galho:3,tronco:1,pedra:2}};say(a,`A caixa mostrou ${ref(a,'ponte')}: madeira e pedra por cima da água.`,'learn')}
      break;
    case 'chuvas':hint('provar:agua',{sede:.12});break;
    case 'fogo':case 'cavernas':case 'montanhas':case 'inverno':hint('ficar:'+(topic==='fogo'?'fogo':'caverna'),{calor:.12});break;
    case 'construções':
      if(!a.recipes.abrigo){a.recipes.abrigo={items:{galho:3,folha:2}};say(a,`A caixa me mostrou ${ref(a,'abrigo')}: galhos e folhas fazem um teto.`,'learn')}
      else if(!a.recipes.cabana){a.recipes.cabana={items:{galho:5,folha:3}};say(a,`A caixa mostrou ${ref(a,'cabana')}: mais galhos e um teto grosso de folhas.`,'learn')}
      else if(!a.recipes.torre){a.recipes.torre={items:{pedra:6}};say(a,`A caixa mostrou ${ref(a,'torre')}: só pedra, uma em cima da outra.`,'learn')}
      else if(!a.recipes.marco){a.recipes.marco={items:{pedra:4}};say(a,`A caixa mostrou ${ref(a,'marco')}: um montinho de pedras para marcar o caminho.`,'learn')}
      break;
    case 'ferramentas':
      if(first&&!a.recipes.machado){a.recipes.machado={items:{galho:1,pedra:1}};say(a,`Aprendi na caixa: ${ref(a,'galho')} com ${ref(a,'pedra')} vira ${ref(a,'machado')}!`,'learn')}
      break;
    case 'minerais':
      hint('minerar:minerio',{});
      if(first&&!a.recipes.torre){a.recipes.torre={items:{pedra:6}};say(a,`A caixa mostrou ${ref(a,'torre')}: pedra sobre pedra até ficar alta.`,'learn')}
      break;
    case 'receitas':
      if(first&&!a.recipes.cozinhar){a.recipes.cozinhar={txt:'largar comida perto do fogo'};say(a,'A comida fica melhor perto do fogo. A caixa ensinou.','learn')}
      break;
    case 'escrita antiga':
      a.knowledge['escrita antiga']=true;
      if(first)say(a,'A caixa mostrou letras de um povo que já morou aqui. Os riscos nas pedras querem dizer algo.','learn');
      break;
    case 'números':
      a.knowledge['números']=true;
      if(!a.recipes.numeros){a.recipes.numeros=true;say(a,'Contar com riscos! Um risco, dois riscos, três… agora dá pra lembrar quantos são.','invent')}
      break;
    case 'engenharia':
      if(!a.recipes.ponte){a.recipes.ponte={items:{galho:3,tronco:1,pedra:2}};say(a,`A caixa mostrou ${ref(a,'ponte')}: apoio firme nas duas margens.`,'learn')}
      else if(!a.recipes.celeiro&&R()<.5){a.recipes.celeiro={items:{tronco:2,galho:3,folha:2}};say(a,`Aprendi ${ref(a,'celeiro')}: guardar comida num lugar seco e alto.`,'learn')}
      break;
    case 'neve':case 'tempestades':hint('ficar:caverna',{calor:.1});break;
    case 'deserto':
      hint('provar:agua',{sede:.1});hint('provar:cacto',{fome:.08});
      if(first&&!a.recipes.poco){a.recipes.poco={items:{pedra:3,galho:2}};say(a,'No deserto a água some. A caixa mostrou como fazer um poço: cavar fundo e forrar de pedra.','learn')}
      break;
    case 'cerrado':hint('provar:capim',{fome:.1});break;
    case 'bichos':case 'amizade':case 'direitos dos animais':a.n.social=clamp(a.n.social+.04);break;
    case 'música':case 'estrelas':case 'desenho':a.curio=clamp(a.curio+.04);break;
  }
}


function haveParts(a,x,y,pos){
  const hands=a.hands.slice();const used=[];
  const need=[x,y];
  const take=[];
  for(const k of need){
    const i=hands.indexOf(k);
    if(i>=0){hands.splice(i,1);take.push({src:'hand',k});continue}
    let found=null;
    for(const t of W.things){if(t.gone||t.kind!==k||used.includes(t))continue;if(Math.hypot(t.x-a.x,t.z-a.z)<1.9||(pos&&Math.hypot(t.x-pos.x,t.z-pos.z)<1.9&&Math.hypot(t.x-a.x,t.z-a.z)<2.6)){found=t;break}}
    if(found){used.push(found);take.push({src:'ground',k,t:found});continue}
    if(k==='pedra'){const p=(pos&&pileAt(pos.x,pos.z))||pileAt(a.x,a.z);if(p&&(p.data.items.pedra||0)>0){take.push({src:'pile',k,p});continue}}
    if(k==='lama'){const patch=W.things.find(t=>!t.gone&&t.kind==='lama'&&t.data.patch&&Math.hypot(t.x-a.x,t.z-a.z)<2);if(patch){take.push({src:'patch',k});continue}}
    return null;
  }
  return take;
}
function doCombine(a,s){
  const x=s.x,y=s.y;const key=comboKey(x,y);
  const take=haveParts(a,x,y,s.pos);
  if(!take){a.tried[key]=a.tried[key]||{res:'nada'};return {r:'faltou',novel:0}}
  const consume=()=>{for(const tk of take){if(tk.src==='hand')removeFromHand(a,tk.k);else if(tk.src==='ground')removeThing(tk.t)}};
  let res='nada',made=null;
  if(key==='pedra+pedra'){
    res='faisca';
    if(V)V.spark(a.x+Math.cos(a.yaw)*.5,a.z+Math.sin(a.yaw)*.5);
    const ig=sparkIgnite(a,s);
    a.tried[key]={res:ig?'fogo':'faisca'};
    return {r:ig?'fogo':'faisca',spark:true,fire:ig};
  }
  if(key==='galho+pedra'){consume();giveHand(a,'machado');made='machado';res='machado'}
  else if(key==='folha+lama'){consume();giveHand(a,'curativo');made='curativo';res='curativo'}
  else if(key==='machado+mineral'){consume();giveHand(a,'picareta');made='picareta';res='picareta'}
  else if(key==='couro+folha'||key==='couro+couro'){consume();giveHand(a,'roupa');made='roupa';res='roupa'}
  else if(key==='bronze+couro'){consume();giveHand(a,'armadura');made='armadura';res='armadura'}
  else if(key==='bronze+galho'||key==='bronze+tronco'){consume();giveHand(a,'lanca');made='lanca';res='lanca'}
  else if(key==='baga+lama'||key==='fruta+lama'){
    consume();res='plantio';
    if(!a.recipes.plantacao){
      a.recipes.plantacao={items:{baga:2,lama:1}};
      a.inventions.push({kind:'plantacao',name:a.lex['k:plantacao']||null,t:W.t,txt:K.plantacao.g});
      W.stats.inventions++;W.inventions.push({by:a.id,kind:'plantacao',t:W.t});
      say(a,'Enterrei uma semente na lama! Se eu cuidar, vai nascer mais comida aqui.','invent');
      ev('🌱',`${nameTag(a)} descobriu como <b>plantar</b>: semente na lama úmida vira comida.`,a);
      UI&&UI.onInvent&&UI.onInvent(a);
    }
  }
  else if(key==='mineral+mineral'){
    const fire=W.things.find(t=>!t.gone&&t.kind==='fogo'&&Math.hypot(t.x-a.x,t.z-a.z)<5);
    if(fire){consume();giveHand(a,'bronze');made='bronze';res='bronze';a.n.calor=clamp(a.n.calor+.03)}
    else {res='nada';if(!a.tried['mineral+mineral']||R()<.3)say(a,'A pedra brilhante não mudou nada. Talvez precise de calor.','think')}
  }
  a.tried[key]={res};
  if(made&&!a.recipes[made]){
    a.recipes[made]={items:{[x]:1,[y]:1}};
    maybeCoin(a,'k:'+made,1,'Fiz uma coisa nova! Vou chamar de');
    a.inventions.push({kind:made,name:a.lex['k:'+made]||null,t:W.t,txt:K[made].g});
    W.stats.inventions++;W.inventions.push({by:a.id,kind:made,t:W.t});
    const NM={machado:'um <b>machado</b>',curativo:'um <b>curativo</b>',picareta:'uma <b>picareta</b>',roupa:'uma <b>roupa de couro</b>',armadura:'uma <b>armadura</b>',lanca:'uma <b>lança</b>',bronze:'o <b>bronze</b>'};
    ev('🛠️',`${nameTag(a)} inventou ${NM[made]||('<b>'+K[made].g+'</b>')}${a.lex['k:'+made]?' e chamou de '+wordHTML(a.lex['k:'+made],K[made].g):''}.`);
    a.curio=clamp(a.curio-.2);UI&&UI.onInvent&&UI.onInvent(a);
  }
  maybeCoin(a,'v:combinar',a.exp>6?.4:0);
  return {r:res,got:made};
}

/* ---- fogo ---- */
function sparkIgnite(a,s){
  const x=a.x,z=a.z;
  const rainMul=W.rain>0?.15:1;
  // alvo: pilha/abrigo/folha/galho perto
  const cands=[];
  for(const t of W.things){if(t.gone)continue;const k=K[t.kind];if(!k.flam)continue;const d=Math.hypot(t.x-x,t.z-z);if(d<1.8)cands.push({t,d,p:k.flam*(t.kind==='arvore'?.3:1)*rainMul})}
  cands.sort((p,q)=>p.d-q.d);
  for(const c of cands){
    if(R()<c.p){
      if(c.t.kind==='pilha'||c.t.kind==='abrigo'||c.t.kind==='galho'||c.t.kind==='folha'||c.t.kind==='tronco'){
        return lightThing(c.t,a,true);
      }
    }
  }
  const cell=cellAt(x,z);
  if(cell&&cell.st===0&&cell.f>0&&R()<(.4+.4*(1-W.rain))*rainMul*cell.f+0.05){
    burnCell(cell,a);
    ev('🔥',`${nameTag(a)} bateu duas pedras e <b>pôs fogo no capim sem querer</b>!`);
    W.stats.fires++;
    a.fireAcc=true;
    return {wild:true};
  }
  return null;
}
function lightThing(t,a,accident){
  const it=t.data.items||{};
  const wasKind=t.kind;
  const fuel=14+8*((it.galho||0)+2*(it.tronco||0)+.4*(it.folha||0))+(wasKind==='galho'||wasKind==='folha'?6:0);
  const cell=cellAt(t.x,t.z);
  const contained=(it.pedra||0)>=3||!cell||cell.st===3||cell.st===2||cell.f<.15;
  const where={x:t.x,z:t.z};
  removeThing(t);
  const f=addThing('fogo',where.x,where.z,{fuel,contained,by:a,from:wasKind,t0:W.t});
  W.stats.fires++;
  const intent=(a.project&&a.project.type==='fogueira')||(a.recipes.fogo&&a.fireIntent);
  if(wasKind==='abrigo')ev('🔥',`O abrigo pegou fogo por causa de uma faísca de ${nameTag(a)}.`);
  else if(contained){
    ev('🔥',(intent?`${nameTag(a)} acendeu uma <b>fogueira</b> de propósito.`:`${nameTag(a)} acendeu uma <b>fogueira sem querer</b>.`)+' O fogo ficou contido.');
  }else{
    ev('🔥',`${nameTag(a)} acendeu uma fogueira <b>sem controle</b>: o capim em volta vai queimar!`);
    burnCell(cell,a);
  }
  // inventou fogo
  if(!a.recipes.fogo){
    a.recipes.fogo={items:{pedra:2}};
    a.inventions.push({kind:'fogo',name:null,t:W.t,txt:'fogo (bater duas pedras perto de coisa seca)'});
    W.stats.inventions++;W.inventions.push({by:a.id,kind:'fogo',t:W.t});
    maybeCoin(a,'k:fogo',1,'Saiu uma coisa laranja que dança! Vou chamar de');
    a.curio=clamp(a.curio-.25);
    UI&&UI.onInvent&&UI.onInvent(a);
  }
  a.fireIntent=false;
  return {item:f,contained};
}
function burnCell(c,by){
  if(!c||c.st!==0||c.f<=0)return false;
  c.st=1;c.bt=rnd(7,12);c.by=by;W.burning.push(c);V&&V.paintCell(c);return true;
}

/* =====================  REAÇÕES (pensamentos pós-experiência)  ===================== */
function react(a,s,l,res){
  const e=l.eff;const v=s.verb;const k=s.kind;
  res=res||{};
  const r=res.r;
  const R_=k&&K[k]?ref(a,k):'isso';
  if(s.dream)dreamAct(a,s.dream);
  // nomear coisas após interação
  if(k&&K[k]&&(v==='provar'||v==='pegar'||v==='sacudir'||v==='roer'||v==='olhar'||v==='apertar'||v==='desenhar'||v==='escrever'||v==='minerar')&&(l.first||l.r.n===2)){
    maybeCoin(a,'k:'+k,l.first?.55:1);
  }
  if(k==='agua'&&v==='provar')maybeCoin(a,'k:agua',l.first?.7:1);
  if(v==='cavar')maybeCoin(a,'v:cavar',l.r.n>=3?.8:0);
  if(v==='sacudir')maybeCoin(a,'v:sacudir',l.r.n>=3?.6:0);
  if(v==='roer')maybeCoin(a,'v:roer',l.r.n>=2?.8:0);
  if(s.key==='dormir:chao'||s.key.startsWith('dormir:'))maybeCoin(a,'v:dormir',l.r.n>=2?.7:0);
  if(s.t==='sleep'){
    if(e.energia>.15){
      if(a.heat.warm>.3||/toca|abrigo|fogo/.test(s.key))say(a,`Dormi bem. Dormir ${s.key.endsWith('fogo')?'perto do calor':'protegido'} é muito melhor.`,'learn');
      else if(e.calor<-.1)say(a,'Acordei com frio. Dormir no chão aberto gela.','learn');
      else say(a,'Descansei. Minha energia voltou.','feel');
    }
    return;
  }
  if(s.t==='stay'){
    if(!k)return;
    if(s.play){
      a.n.social=clamp(a.n.social+.05);
      say(a,pick(['Isso! De novo!','Corri até cansar e valeu a pena.','Por um instante eu só fui bicho.']),'feel');
    }else if(e.calor>.05){say(a,`O calor de ${ref(a,k)} me deixa bem. Vou lembrar disso.`,'learn');if(k==='fogo')dreamAct(a,'fogo')}
    else if(e.saude<-.05)say(a,`Aí! ${ref(a,k)} queima! Preciso ficar mais longe.`,'alert');
    else if(k==='marco'||k==='represa'||k==='abrigo'||k==='toca')say(a,`Gosto de ficar perto de ${ref(a,k)}.`,'feel');
    return;
  }
  if(s.t==='talk')return;
  if(v==='provar'){
    if(r==='veneno')say(a,`Eca… ${R_} me fez passar mal. Nunca mais!`,'alert');
    else if(r==='vazio')say(a,`${R_} não tem mais nada pra comer.`,'think');
    else if(r==='bebeu')say(a,e.sede>.1?`Ahh! ${R_} mata a sede. Preciso lembrar onde fica.`:'Não estava com tanta sede.','learn');
    else if(r==='curou')say(a,`Minha dor sumiu! ${R_} cura.`,'learn');
    else if(r==='comeu'){
      if(l.first&&(e.fome>.03||e.sede>.03))dreamAct(a,'comida');
      if(e.fome>.1)say(a,pick([`Humm! ${R_} é bom e enche a barriga.`,`${R_} mata a fome. Vou lembrar!`,`Gostoso! Quero mais ${R_}.`]),'learn');
      else say(a,`${R_} é gostoso, mas não estava com muita fome.`,'think');
    }else if(r==='dura')say(a,`Ai, meu dente. ${R_} é duro e não dá pra comer.`,'think');
    else if(r==='cheiroso')say(a,pick([`${R_} cheira tão bem… fico até mais leve.`,`Que cheirinho bom. ${R_} me deixa animado.`]),'feel');
    else if(r==='fraco')say(a,`${R_} é só um gostinho. Não enche a barriga.`,'think');
    else say(a,`Nada de mais em ${R_}. Não parece comida.`,'think');
    return;
  }
  if(v==='pegar'){
    if(r==='pegou')say(a,pick([`Peguei ${ref(a,res.got||k)}. É leve.`,`Estou carregando ${ref(a,res.got||k)}.`]),'think');
    return;
  }
  if(v==='sacudir'||v==='roer'){
    if(r==='caiu')say(a,v==='roer'?`Roí e caiu madeira! ${ref(a,res.got)}!`:`Sacudi e caiu ${ref(a,'galho')}! Dá pra usar isso?`,'learn');
    else say(a,`${R_} não deu nada agora.`,'think');
    return;
  }
  if(v==='cavar'){
    if(r==='achou')say(a,`Cavei e achei ${ref(a,res.got)}!`,'learn');
    else if(a.lastDig&&a.lastDig.cell&&a.lastDig.cell.digs>=2)say(a,'O buraco está ficando fundo…','think');
    else say(a,'Só terra. Mas é gostoso cavar.','think');
    return;
  }
  if(v==='largar'){return}
  if(v==='olhar'||v==='apertar'){
    if(k!=='computador')return;
    if(r==='tela')say(a,`A caixa acendeu. Tem letrinhas e desenhos dentro! É como um olho de vidro.`,'learn');
    else if(r==='cor')say(a,`Apertei e a caixa mudou de cor! Ela responde quando eu toco.`,'invent');
    else if(r==='bip')say(a,`Apertei e ela fez um som estranho: bip! Meu pelo todo arrepiou.`,'alert');
    return;
  }
  if(v==='desenhar'){
    if(k==='mural'){say(a,pick(['Deixei um risco na parede. Ficou torto, mas é meu.','Risquei a parede escura. Ninguém tinha feito isso antes.','Meu desenho não parece nada. Mas eu sei o que é.']),'feel');dreamAct(a,'desenho');}
    else say(a,'Rabisco no chão mesmo.','think');
    return;
  }
  if(v==='escrever'){
    if(k==='mural'){
      const w=res.txt?wordHTML(res.txt,'minha palavra'):'…';
      say(a,pick([`Escrevi ${w} na parede! Será que alguém entende?`,`As letras ficaram juntas: ${w}. Foi o que deu pra fazer.`,`Guardei ${w} no mural. Quero que os outros vejam.`]),'learn');
    } else say(a,'Não dá pra escrever aqui.','think');
    return;
  }
  if(v==='pesquisar'){
    if(k!=='computador')return;
    const t=res.topic||'coisas';
    const found=RESEARCH.find(x=>x[0]===t);
    const tx=found?found[1]:'tem muita coisa interessante';
    say(a,pick([`A caixa me mostrou sobre ${t}: ${tx}.`,`Pesquisei sobre ${t}. ${tx}.`,`A internet sabe de tudo: ${tx}.`]),'learn');
    return;
  }
  if(v==='minerar'){
    if(r==='duro')say(a,`${R_} é duro demais. Preciso de algo mais forte que minha pata.`,'think');
    else if(r==='minerou')say(a,pick([`Bati forte e saiu ${ref(a,'mineral')}! Brilha.`,`A pedra se abriu e achei ${ref(a,'mineral')}.`,`Minério! Isso deve servir pra alguma coisa.`]),'learn');
    return;
  }
  if(v==='combinar'){
    const A=ref(a,s.x),B=ref(a,s.y);
    if(r==='fogo'){
      const cont=res.fire&&res.fire.contained;
      say(a,cont?`Faíscas! E aquilo pegou: apareceu ${ref(a,'fogo')} só no montinho!`:res.fire?`Faíscas! Apareceu ${ref(a,'fogo')}… e ela está correndo pelo chão!`:'Faíscas e fogo!','invent');
    }else if(r==='faisca')say(a,`Bati ${ref(a,'pedra')} com ${ref(a,'pedra')} e saiu uma luzinha! Mas nada pegou.`,'learn');
    else if(r==='machado')say(a,`Juntei ${A} com ${B} e agora tenho ${ref(a,'machado')}! Parece forte.`,'invent');
    else if(r==='curativo')say(a,`${A} com ${B} viraram uma pasta. Será que ajuda a curar?`,'invent');
    else if(r==='faltou')say(a,'Faltou uma das partes.','think');
    else say(a,`Juntei ${A} com ${B}, mas nada aconteceu.`,'think');
    maybeCoin(a,'v:faiscar',r==='fogo'||r==='faisca'?.9:0);
    return;
  }
}

/* =====================  CONVERSA  ===================== */
function mixPhon(h,s){
  for(const c of s.phon.c)if(!h.phon.c.includes(c)&&R()<.45)h.phon.c.push(c);
  for(const v of s.phon.v)if(!h.phon.v.includes(v)&&R()<.45)h.phon.v.push(v);
  for(const e of s.phon.e)if(!h.phon.e.includes(e)&&R()<.35)h.phon.e.push(e);
}
function blendWords(w1,w2){
  const a=w1.slice(0,Math.max(2,Math.ceil(w1.length/2)));
  let b=w2.slice(Math.floor(w2.length/2));
  let w=a+b;
  if(w===w1||w===w2)w=a+pick(['n','r','l','s'])+b;
  return w;
}
/* ---- compreensão: ninguém usa uma palavra que ainda não entendeu ---- */
function hearWord(h,word,key,src){
  if(!word)return null;
  if(!h.known)h.known={};
  let kn=h.known[word];
  if(!kn)kn=h.known[word]={key,src:src.id,heard:0,und:0,last:W.t};
  if(kn.key!==key)return kn;
  kn.heard++;kn.last=W.t;
  return kn;
}
function understands(h,word,key){const kn=h.known&&h.known[word];return !!kn&&kn.key===key&&kn.und>=2}
function learnMeaning(h,word,key,src,gain){
  const kn=hearWord(h,word,key,src);
  if(!kn||kn.key!==key)return false;
  kn.und+=(gain||1);
  if(kn.und<2)return false;
  if(!h.lex[key]){
    h.lex[key]=word;h.words.add(word);W.words.add(word);
    say(h,`Entendi! ${nameTag(src)} chama isso de ${wordHTML(word,gloss(key))}. Vou usar também.`,'learn');
    dreamAct(h,'lingua');
    UI&&UI.onLex&&UI.onLex(h);
    return true;
  }
  return false;
}
function mixLexicons(h,s,c){
  const w=s.lex[c],hw=h.lex[c];
  if(!w||!hw||w===hw)return false;
  const mix=blendWords(hw,w);
  h.lex[c]=mix;s.lex[c]=mix;h.words.add(mix);s.words.add(mix);W.words.add(mix);
  mixPhon(h,s);mixPhon(s,h);
  W.stats.mixes=(W.stats.mixes||0)+1;
  if(h.tribeId&&s.tribeId&&h.tribeId!==s.tribeId){
    const ht=W.tribes.find(x=>x.id===h.tribeId),st=W.tribes.find(x=>x.id===s.tribeId);
    if(ht&&st){
      ht.langMixes=(ht.langMixes||0)+1;st.langMixes=(st.langMixes||0)+1;
      W.langEvents=W.langEvents||[];
      W.langEvents.push({t:W.t,type:'mistura',a:ht.id,b:st.id,aName:ht.name,bName:st.name,word:mix,gloss:gloss(c)});
      if(W.langEvents.length>60)W.langEvents.shift();
    }
  }
  ev('🌀',`${nameTag(h)} e ${nameTag(s)} já se entendem. Misturaram as palavras: ${gloss(c)} agora é ${wordHTML(mix,gloss(c))}.`);
  say(h,`Eu entendia ${wordHTML(hw,gloss(c))}, ${nameTag(s)} dizia ${wordHTML(w,gloss(c))}. Juntamos: ${wordHTML(mix,gloss(c))}.`,'name');
  UI&&UI.onLex&&UI.onLex(h);UI&&UI.onLex&&UI.onLex(s);
  return true;
}
function shareSelf(s,h){
  const P=s.pers;if(!P)return;
  const kind=pick(['dream','belief','quirk','trait']);
  if(kind==='dream'&&P.dream)say(s,P.dream.done?`Já consegui ${P.dream.label}. Agora quero outra coisa.`:`Eu quero ${P.dream.label}. É o que eu mais penso.`,'talk');
  else if(kind==='belief')say(s,`Eu acho que ${P.belief}. Você acha também?`,'talk');
  else if(kind==='quirk'){const q=quirkOf(s);if(q)say(s,q.line,'talk')}
  else{const tl=TRAIT_LINES[P.trait];if(tl)say(s,pick(tl),'talk')}
}
function converse(a,b){
  if(!b||b.faint>0)return;
  a.stats.talks++;
  for(const [s,h] of [[a,b],[b,a]]){
    h.n.social=clamp(h.n.social+.35);h.curio=clamp(h.curio+.05);
    const shn=sharedLex(s,h).n;
    bumpOpinion(h,s,.05+Math.min(.1,shn*.03)+(((TRAITS[(h.pers&&h.pers.trait)||'']||{}).talk)||0)*.1);
    // nome do outro
    if(s.name&&h.lex['a:'+s.id]!==s.name){h.lex['a:'+s.id]=s.name;say(h,`Ele se chama ${wordHTML(s.name,s.sp.label.toLowerCase())}. Gostei desse nome!`,'name')}
    else if(!h.lex['a:'+s.id]&&!s.name){const w=coin(h);h.lex['a:'+s.id]=w;say(h,`Vou chamar ${otherRef(h,s)} de ${wordHTML(w,s.sp.label.toLowerCase())}.`,'name')}
    // palavra nova: primeiro ouvir, depois repetir, depois entender; só então adotar/misturar
    const cs=shuffle(Object.keys(s.lex).filter(k=>/^[kv]:/.test(k))).slice(0,2);
    for(const c of cs){
      if(!s.lex[c])continue;
      const w=s.lex[c],g=gloss(c);
      if(h.lex[c]===w){
        // já falam igual
      }else if(!h.known||!h.known[w]){
        hearWord(h,w,c,s);
        say(h,pick([`${nameTag(s)} disse ${wordHTML(w,g)}. Ainda não sei o que é.`,`Ouvi ${wordHTML(w,g)}. Será que é ${g}?`,`${nameTag(s)} fala ${wordHTML(w,g)} e mostra. Vou tentar entender.`]),'think');
        if(R()<.75){
          say(h,`${wordHTML(w,g)}?`,'talk');
          say(s,pick(['Isso!','É isso mesmo!','Sim, isso.'])+` ${wordHTML(w,g)}.`,'talk');
          learnMeaning(h,w,c,s,2);
        }
      }else if(!understands(h,w,c)){
        if(R()<.65){
          say(h,`${wordHTML(w,g)}?`,'talk');
          say(s,pick(['Isso!','Sim!'])+` ${wordHTML(w,g)}.`,'talk');
          learnMeaning(h,w,c,s,2);
        }
      }else if(h.lex[c]&&h.lex[c]!==w&&R()<.62){
        // só misturam línguas depois de já se entenderem
        mixLexicons(h,s,c);
      }
    }
    // expansão: palavras que h já entende podem virar uma língua comum
    const mixable=[];
    for(const c of Object.keys(s.lex)){
      if(!/^[kv]:/.test(c))continue;
      const w=s.lex[c];
      if(understands(h,w,c)&&h.lex[c]&&h.lex[c]!==w)mixable.push(c);
    }
    if(mixable.length&&R()<.5)mixLexicons(h,s,pick(mixable));
    // avisos de perigo e dicas
    for(const key in s.mem){
      const r=s.mem[key];if(h.mem[key]||r.n<1)continue;
      const [v,k]=key.split(':');
      if(r.eff.saude<-.1&&(v==='provar'||v==='ficar')){
        h.mem[key]={n:1,eff:{saude:r.eff.saude*.6,fome:r.eff.fome*.5||0},last:W.t,heard:true};
        say(h,`${nameTag(s)} me avisou: ${v==='ficar'?'chegar muito perto de':'provar'} ${ref(h,k)} machuca.`,'learn');
        if(k==='fogo')h.fear.fire=clamp(h.fear.fire+.3);
        break;
      }
      if(r.eff.fome>.18&&v==='provar'&&K[k]&&R()<.7){
        h.mem[key]={n:1,eff:{fome:r.eff.fome*.7},last:W.t,heard:true};
        say(h,`${nameTag(s)} disse que ${ref(h,k)} enche a barriga.`,'learn');break;
      }
    }
    // aprender receitas e coisas da internet com o outro
    for(const kind in s.recipes){
      if(h.recipes[kind]||R()>=.3)continue;
      h.recipes[kind]=s.recipes[kind];
      const label=K[kind]?ref(h,kind):(VERBG[kind]||kind);
      say(h,`${nameTag(s)} me ensinou a fazer ${label}! Agora eu também sei.`,'learn');
      UI&&UI.onInvent&&UI.onInvent(h);
      break;
    }
    for(const topic in s.knowledge){
      if(h.knowledge[topic]||R()>=.22)continue;
      h.knowledge[topic]=true;
      say(h,`${nameTag(s)} contou o que viu na internet sobre ${topic}. Agora eu sei também.`,'learn');
      break;
    }
  }
  if(a.pers&&R()<.3)shareSelf(a,b);
  if(b.pers&&R()<.3)shareSelf(b,a);
  if(((a.opinion||{})[b.id]||{v:0}).v>.2)dreamAct(a,'amigo');
  if(((b.opinion||{})[a.id]||{v:0}).v>.2)dreamAct(b,'amigo');
  maybeCoin(a,'v:conversar',a.stats.talks>=2?.6:0);
  ev('💬',`${nameTag(a)} e ${nameTag(b)} conversaram.`);
  say(a,pick([`Oi, ${nameTag(b)}!`,`${nameTag(b)}! Vem cá!`,`Oi! Eu estava pensando em você.`]),'talk');
  say(b,pick([`Oi, ${nameTag(a)}!`,`Oi! Tudo bem?`,`Você por aqui!`]),'talk');
  if(((a.opinion||{})[b.id]||{v:0}).v>.6)say(a,`Gosto de conversar com ${nameTag(b)}.`,'talk');
}

/* =====================  FÍSICA DO MUNDO  ===================== */
function heatInfo(x,z){
  let warm=0,burn=false;
  for(const t of W.things){if(t.gone||t.kind!=='fogo')continue;const d=Math.hypot(t.x-x,t.z-z);if(d<1.0)burn=true;if(d<5.5)warm=Math.max(warm,1-d/5.5)}
  for(const c of W.burning){const d=Math.hypot(c.cx-x,c.cz-z);if(d<1.7)burn=true;if(d<5)warm=Math.max(warm,.8*(1-d/5))}
  return {warm,burn};
}
function shelterAt(a){
  for(const t of W.things){if(t.gone)continue;if((t.kind==='toca'||t.kind==='abrigo'||t.kind==='cabana'||t.kind==='celeiro'||t.kind==='caverna')&&Math.hypot(t.x-a.x,t.z-a.z)<1.4)return t.kind}
  return null;
}
function stepAnimal(a,dt){
  a.age+=dt;
  if(a.taken){if(W.t>=a.taken.until)returnFromWolves(a);return}
  if(a.faint>0){
    a.faint-=dt;a.state='faint';
    a.n.energia=clamp(a.n.energia+dt*.01);
    if(a.faint<=0){a.n.saude=.52;a.state='idle';a.plan=null;say(a,'Acordei… tudo girava. Preciso me cuidar melhor.','alert')}
    return;
  }
  const h=a.heat=heatInfo(a.x,a.z);
  const sh=shelterAt(a);
  const asleep=a.state==='sleep';
  const n=a.n;
  const outsideOcean=!!(a.sp.marine&&OCEAN_ZONE&&!isOcean(a.x,a.z));
  const underwaterLand=!!(!a.sp.marine&&!a.sp.swim&&OCEAN_ZONE&&isOcean(a.x,a.z)&&coastDistance(a.x,a.z)<-3);
  const breathless=outsideOcean||underwaterLand;
  if(OCEAN_ZONE){
    const drain=outsideOcean?(a.spk==='caranguejo'?.025:.045):underwaterLand?.075:0;
    a.oxygen=clamp((a.oxygen==null?1:a.oxygen)+(breathless?-drain:.16)*dt);
    if(breathless){
      if(a.airThoughtT==null){
        a.airThoughtT=W.t;
        say(a,outsideOcean?'Estou na beira do mar; vou explorar um pouco e depois volto.':'A água ficou funda. Preciso voltar para a margem.','think');
      }
      const returnThreshold=outsideOcean?.48:.42;
      if(a.oxygen<=returnThreshold){
        const key=outsideOcean?'return-ocean':'return-land';
        if(!a.plan||!a.plan.meta||a.plan.meta.key!==key){
          const target=outsideOcean?oceanReturnPoint(a.x,a.z):landReturnPoint(a.x,a.z);
          if(target){
            a.project=null;a.fleeing=false;
            startPlan(a,[{t:'goto',x:target.x,z:target.z,r:1}],{key});
          }
        }
        if(!a.breathWarning){
          a.breathWarning=true;
          say(a,outsideOcean?'Estou ficando sem ar! Voltando para o mar!':'Estou ficando sem ar! Voltando para terra!','alert');
        }
      }
      if(a.oxygen<=0){n.saude=clamp(n.saude-dt*.012);a.pain=Math.max(a.pain,.2)}
    }else{
      a.airThoughtT=null;a.breathWarning=false;
    }
  }
  n.fome=clamp(n.fome-dt*(asleep?.0013:.0027));
  if(!a.sp.marine)n.sede=clamp(n.sede-dt*(asleep?.0018:.0035));
  if(asleep)n.energia=clamp(n.energia+dt*.018*(sh?1.6:1));
  else n.energia=clamp(n.energia-dt*(.0016+(a.state==='move'?.0006:0)));
  n.social=clamp(n.social-dt*.002);
  let tgt=clamp(ambient()+(sh?.3:0)+h.warm*.8-(W.rain>0&&!sh?.14:0)-(W.snow||0)*.5+(a.hands.some(k=>k==='roupa'||k==='armadura')?.09:0));
  if(W.weather&&W.weather.kind==='geada'&&!sh)tgt-=.12;
  n.calor=clamp(n.calor+(tgt-n.calor)*dt*(tgt<n.calor?.022:.06));
  if(W.weather&&W.weather.kind==='granizo'&&!sh){n.saude=clamp(n.saude-dt*.0018);if(a.pain<.25)a.pain=.25}
  a.curio=clamp(a.curio+dt*.004*a.sp.curio);
  // dano
  if(h.burn&&sh!=='toca'){
    n.saude=clamp(n.saude-dt*.14*a.sp.tough);a.pain=1.2;
    a.stats.burned+=dt;
  }
  if(n.fome<.04)n.saude=clamp(n.saude-dt*.004);
  if(n.sede<.04)n.saude=clamp(n.saude-dt*.006);
  if(n.calor<.18)n.saude=clamp(n.saude-dt*.004);
  if(n.fome>.25&&n.sede>.25&&n.calor>.3)n.saude=clamp(n.saude+dt*(asleep?.006:.003));
  if(a.pain>0)a.pain-=dt;
  // dor de fogo aprende
  if(h.burn&&sh!=='toca'){
    a.lessons.burned=true;
    if(!a.burnT||W.t-a.burnT>6){
      a.burnT=W.t;
      const key='ficar:fogo';let r=a.mem[key];if(!r)r=a.mem[key]={n:0,eff:{},last:W.t};
      r.eff.saude=Math.min(r.eff.saude||0,0)-.12;r.n++;
      a.fear.fire=clamp(a.fear.fire+.4);
      say(a,`AI! Queima! ${ref(a,'fogo')} dói muito!`,'alert');
      UI&&UI.onMem&&UI.onMem(a);
    }
  }
  a.fear.fire=clamp(a.fear.fire-dt*.002);
  // reflexo de fuga
  const fireSense=a.fireNear;
  const wildFlee=(fireSense&&fireSense.d<(a.fear.fire>.2?6:3.2)&&W.burning.length>0&&!a.fleeing&&sh!=='toca');
  if((h.burn||wildFlee)&&sh!=='toca'){
    if(!a.fleeing||a.fleeT<W.t-3){
      const src=a.fireNear||{x:a.x+1,z:a.z};
      const an=Math.atan2(a.z-src.z,a.x-src.x)+rnd(-.5,.5);
      const d=rnd(7,11);
      startPlan(a,[{t:'goto',x:clamp(a.x+Math.cos(an)*d,-EDGE,EDGE),z:clamp(a.z+Math.sin(an)*d,-EDGE,EDGE),r:1.5}],{key:'fugir'});
      a.fleeing=true;a.fleeT=W.t;
      if(!wildFlee||R()<.5)say(a,pick(['Fogo! Preciso correr!','Está quente demais! Fugindo!','Sai daqui, sai daqui!']),'alert');
    }
  }
  if(a.fleeing&&(!a.plan||a.plan.meta.key!=='fugir')){a.fleeing=false}
  // bichinhos menores fogem do pug
  let predNear=null;
  if(a.sp.tough<1.2){
    for(const o of W.animals){
      if(o===a||!o.sp.pred||o.faint>0)continue;
      const dd=hyp(a,o);
      if(dd<5.5){predNear=o;break}
    }
  }
  if(predNear&&!a.fleeing&&!sh&&R()<.5){
    const an=Math.atan2(a.z-predNear.z,a.x-predNear.x)+rnd(-.5,.5);
    const d=rnd(8,12);
    startPlan(a,[{t:'goto',x:clamp(a.x+Math.cos(an)*d,-EDGE,EDGE),z:clamp(a.z+Math.sin(an)*d,-EDGE,EDGE),r:1.5}],{key:'fugir'});
    a.fleeing=true;a.fleeT=W.t;
    bumpOpinion(a,predNear,-.2);
    say(a,pick([`${nameTag(predNear)}! Vou correr!`,`Um ${predNear.sp.label.toLowerCase()} atrás de mim!`,`Sai, sai, sai!`]),'alert');
  }
  // Lobos: quem tem uma arma enfrenta; quem não tem corre.
  a.fighting=false;
  if(W.wolves.length&&W.crisis&&W.crisis.phase!=='none'){
    let wolf=null,wd=1e9;
    for(const w of W.wolves){if(w.state==='down'||w.gone)continue;const dd=Math.hypot(w.x-a.x,w.z-a.z);if(dd<wd){wd=dd;wolf=w}}
    if(wolf&&wd<9){
      a.fear.wolf=clamp((a.fear.wolf||0)+dt*.2);
      const weapon=['lanca','machado','picareta','bronze','armadura'].find(k=>a.hands.includes(k));
      if(weapon&&wolf.state!=='down'){
        a.fighting=true;a.fightWolfId=wolf.id;a.fightWeapon=weapon;
        const damage=weapon==='lanca'?1.35:weapon==='machado'?1:weapon==='picareta'?.8:.5;
        wolf.hp-=dt*damage;
        if(!a.wolfHitAnimT||W.t-a.wolfHitAnimT>.9){
          a.wolfHitAnimT=W.t;wolf.hitT=W.t;
        }
        if(!a.wolfHitT||W.t-a.wolfHitT>10){
          a.wolfHitT=W.t;
          const thoughts={
            lanca:['A ponta da lança alcança! Vai embora, lobo!','Mantenho a lança entre o lobo e a tribo.'],
            machado:['Meu machado vai fazer esse lobo recuar!','Ergui o machado. Não vou deixar o lobo chegar perto.'],
            picareta:['Vou afastar o lobo com a picareta!','A ponta da picareta brilha quando avanço.'],
            bronze:['Vou usar o bronze para espantar o lobo!'],
            armadura:['Minha armadura me protege. Vou segurar a posição!'],
          };
          say(a,pick(thoughts[weapon]),'alert');
        }
        if(wolf.hp<=0)wolfDown(wolf,a);
      }else if(!a.fleeing&&R()<dt*1.2){
        const an=Math.atan2(a.z-wolf.z,a.x-wolf.x)+rnd(-.4,.4);
        const d=rnd(9,15);
        startPlan(a,[{t:'goto',x:clamp(a.x+Math.cos(an)*d,-EDGE,EDGE),z:clamp(a.z+Math.sin(an)*d,-EDGE,EDGE),r:1.5}],{key:'fugir-lobo'});
        a.fleeing=true;a.fleeT=W.t;
        say(a,pick(['Lobo! Corre!','Aqueles olhos amarelos… vou me esconder!','A tribo! Vamos para trás das estacas!']),'alert');
      }
    }
  }
  // desmaio
  if(n.saude<=.01){a.faint=25;a.plan=null;a.cur=null;a.state='faint';
    if(!W.events.some(e=>e.icon==='💫'&&W.t-e.t<120))ev('💫',`${nameTag(a)} desmaiou de exaustão e vai descansar um pouco.`,a);
    say(a,'Tudo escureceu…','alert');return}
  // monólogo e desejo
  a.wishT-=dt;if(a.wishT<=0){a.wishT=2.5;updateWish(a);maybeStartRecipeProject(a)}
  a.muse-=dt;if(a.muse<=0){a.muse=rnd(14,26);musing(a)}
  a.thoughtT-=dt;if(a.thoughtT<=0){a.thoughtT=rnd(30,68);thinkNow(a)}
  // nome próprio
  if(!a.name&&a.age>110&&a.exp>=7&&Object.keys(a.lex).length>=1)selfName(a);
  runPlan(a,dt);
}
function musing(a){
  if(a.state==='sleep'||a.fleeing)return;
  const n=a.n;let s=null;
  const outsideOcean=a.sp.marine&&OCEAN_ZONE&&!isOcean(a.x,a.z);
  const underwaterLand=!a.sp.marine&&!a.sp.swim&&OCEAN_ZONE&&isOcean(a.x,a.z)&&coastDistance(a.x,a.z)<-3;
  if(outsideOcean)s=pick(['A beira do mar é diferente. Vou explorar mais um pouco.','Tem coisas interessantes na areia molhada.']);
  else if(underwaterLand)s=pick(['A água ficou funda. Preciso voltar para a margem.','Não consigo respirar debaixo d’água. Vou voltar para terra.']);
  else if(daylight()<.15&&n.calor<.5)s=pick(['Está escuro e frio. Queria algo quente.','A noite é fria. Por que esfria quando escurece?']);
  else if(W.snow>.35)s=pick(['Branco por todo lado. A neve queima de frio.','Pegadas na neve… o chão ficou macio e gelado.']);
  else if(W.flood>.3&&(biomeAt(a.x,a.z)===5||biomeAt(a.x,a.z)===6))s=pick(['A água subiu no pantanal. O capim está debaixo dela.','Cheia de novo. Onde a gente pisa, a água responde.']);
  else if(W.rain>0)s=pick(['Água caindo do céu… tudo fica molhado.','Chuva! Será que tem lugar seco?']);
  else if(W.wolves.length)s=pick(['Os lobos estão por aí. Sinto cheiro de mato e de pelo.','Aqueles uivos… a tribo precisa de um plano.']);
  else if(n.fome<.35)s=pick(['Minha barriga faz barulho.','Preciso comer alguma coisa.']);
  else if(n.sede<.35)s='Minha boca está seca.';
  else if(n.social<.3)s='Estou sozinho demais. Cadê os outros?';
  else if(a.hands.length)s=`Estou segurando ${ref(a,a.hands[0])}. Pra que será que serve?`;
  else if(a.name&&tribeOf(a)&&R()<.45){const tr=tribeOf(a);s=pick([`Na tribo ${tr.name}, o ${tr.faith.name} escuta a gente.`,`Cada marca no totem é uma história de ${tr.name}.`])}
  else if(a.name&&R()<.4)s=pick([`Eu sou ${a.name}. É bom ter um nome.`,`Quanta coisa eu já aprendi, ${a.name}.`]);
  else s=pick(['Quantas coisas diferentes existem aqui…','Será que tudo isso tem um jeito de ser usado?','Cada dia aprendo algo novo.','O que será que tem do outro lado?']);
  say(a,s,'think');
}
function updateWish(a){
  const n=a.n;let text=null,tag='';
  const outsideOcean=a.sp.marine&&OCEAN_ZONE&&!isOcean(a.x,a.z);
  const underwaterLand=!a.sp.marine&&!a.sp.swim&&OCEAN_ZONE&&isOcean(a.x,a.z)&&coastDistance(a.x,a.z)<-3;
  if(outsideOcean&&a.oxygen<.65){
    text='Preciso voltar ao mar para respirar.';tag='respirar';
  }else if(underwaterLand&&a.oxygen<.65){
    text='Preciso voltar para a margem para respirar.';tag='respirar';
  }
  const low=['fome','sede','energia','calor'].sort((p,q)=>n[p]-n[q])[0];
  if(!text&&n[low]<.35){
    if(low==='fome'){
      const food=Object.keys(a.mem).filter(k=>k.startsWith('provar:')&&a.mem[k].eff.fome>.1).map(k=>k.split(':')[1])[0];
      text=food?`Quero achar mais ${ref(a,food)} pra comer.`:'Quero descobrir o que dá pra comer.';tag='fome';
    }else if(low==='sede'){
      text=a.mem['provar:agua']&&a.mem['provar:agua'].eff.sede>.1?`Quero beber ${ref(a,'agua')}.`:'Quero encontrar algo pra molhar a boca.';tag='sede';
    }else if(low==='energia'){
      text=a.recipes.toca||a.recipes.abrigo?`Quero fazer ${ref(a,a.recipes.toca?'toca':'abrigo')} pra dormir bem.`:'Quero um canto seguro e quentinho pra dormir.';tag='dormir';
    }else{
      text=a.recipes.fogo?(a.lessons.burned?`Quero fazer ${ref(a,'fogo')} sem queimar tudo: chão pelado e pedras em volta.`:`Quero fazer ${ref(a,'fogo')} de novo pra me esquentar.`):'Quero ficar quentinho. Existe algo que esquente?';tag='calor';
    }
  }else if(!text&&a.project){
    const nm={montinho:'um montinho para testar',fogueira:ref(a,'fogo'),abrigo:ref(a,'abrigo'),toca:ref(a,'toca'),marco:ref(a,'marco'),represa:ref(a,'represa')}[a.project.type]||'algo';
    text=`Estou construindo ${nm}.`;tag='inventar';
  }else if(!text&&a.lessons.burned&&!a.recipes.fogo)text=`Quero entender de onde vem ${ref(a,'fogo')}.`;
  else if(!text&&a.recipes.fogo&&a.lessons.burned&&R()<.5)text=`Quero aprender a controlar ${ref(a,'fogo')}.`;
  else if(!text&&a.hands.length){text=`O que acontece se eu juntar ${ref(a,a.hands[0])} com outra coisa?`;tag='inventar'}
  else if(!text&&a.recipes.machado&&R()<.5)text=`Quero usar ${ref(a,'machado')} pra pegar mais madeira.`;
  else if(!text){
    const parts=[...knownParts(a)];
    const untried=[];for(let i=0;i<parts.length;i++)for(let j=i;j<parts.length;j++)if(!a.tried[comboKey(parts[i],parts[j])])untried.push([parts[i],parts[j]]);
    if(untried.length){const [x,y]=pick(untried);text=`Quero ver o que dá juntar ${ref(a,x)} com ${ref(a,y)}.`;tag='inventar'}
    else text='Quero inventar algo novo, mas ainda não sei o quê.';
  }
  if(text&&text!==a.wish.text){a.wish={text,tag};UI&&UI.onWish&&UI.onWish(a)}
  // ideias
  const ideas=[];
  const parts=[...knownParts(a)];
  for(let i=0;i<parts.length&&ideas.length<3;i++)for(let j=i;j<parts.length&&ideas.length<3;j++){
    const k=comboKey(parts[i],parts[j]);const tr=a.tried[k];
    if(!tr)ideas.push({st:'?',txt:`${ref(a,parts[i])} + ${ref(a,parts[j])}`,note:'ainda não testei'});
  }
  a.ideas=ideas;
}

/* =====================  TRIBOS, FÉ E LOBOS  ===================== */
const CULTURES={
  fogo:{label:'do fogo',gloss:'o calor que transforma',roof:0},
  agua:{label:'da água',gloss:'a água que leva e traz',roof:1},
  pedra:{label:'da pedra',gloss:'a pedra que guarda a memória',roof:2},
  lua:{label:'da lua',gloss:'a luz que vigia a noite',roof:3},
  floresta:{label:'da floresta',gloss:'a mata que dá e toma',roof:4},
  lobo:{label:'do lobo',gloss:'o uivo que ronda o escuro',roof:5},
};
function tribeOf(a){return a&&a.tribeId?W.tribes.find(t=>t.id===a.tribeId):null}
function tribeIsAquatic(tr){
  if(!tr)return false;
  if(tr.aquatic!=null)return !!tr.aquatic;
  const members=(tr.members||[]).map(id=>W.animals.find(a=>a.id===id)).filter(Boolean);
  return members.length>0&&members.every(a=>a.sp.marine);
}
function inventNumerals(tr){
  if(!tr||tr.numerals)return;
  const base=W.animals.find(a=>tr.members.includes(a.id))||W.animals[0];
  if(!base)return;
  tr.numerals=[1,2,3,4,5].map(()=>coin(base,2));
  ev('🔢',`A tribo <b>${tr.name}</b> inventou números: ${tr.numerals.map((w,i)=>`${i+1} ${w}`).join(' · ')}.`);
  UI&&UI.onTribe&&UI.onTribe(tr);
}
function joinTribe(a,tr){
  if(!a||!tr||!!a.sp.marine!==tribeIsAquatic(tr))return false;
  const old=tribeOf(a);
  if(old&&old.id===tr.id)return false;
  if(old){
    const stay=.35+(old.faith.piety||0)*.4+old.members.length*.06;
    if(R()<stay){
      if(R()<.4)say(a,`Pensei em ir com ${tr.name}, mas ${old.name} é meu povo. Fico onde estou.`,'think');
      return false;
    }
    old.members=old.members.filter(id=>id!==a.id);
  }
  a.tribeId=tr.id;
  if(!tr.members.includes(a.id))tr.members.push(a.id);
  a.n.social=clamp(a.n.social+.25);a.exp+=1;
  say(a,old?`Deixei <b>${old.name}</b>. Agora meu povo é <b>${tr.name}</b>.`:`Vou morar com <b>${tr.name}</b>: eles falam parecido comigo.`,'invent');
  ev('🏕️',`${nameTag(a)} entrou na tribo <b>${tr.name}</b>${old?` e deixou ${old.name}`:''}.`,a);
  UI&&UI.onTribe&&UI.onTribe(tr);
  return true;
}
function maybeRecruitTribes(){
  if(!W.tribes.length)return;
  const loners=W.animals.filter(a=>!a.taken&&a.faint<=0&&!a.tribeId);
  for(const a of shuffle(loners).slice(0,14)){
    let best=null,bs=-1;
    for(const tr of W.tribes){
      if(tr.members.length>=7)continue;
      if(!!a.sp.marine!==tribeIsAquatic(tr))continue;
      if(Math.hypot(a.x-tr.center.x,a.z-tr.center.z)>70)continue;
      const buddy=W.animals.find(x=>x.id!==a.id&&tr.members.includes(x.id));
      const sh=buddy?sharedLex(a,buddy).n:0;
      if(sh<1)continue;
      const sc=sh+a.sp.soc*.8+(tr.members.length<4?.6:0);
      if(sc>bs){bs=sc;best=tr}
    }
    if(best&&R()<.4)joinTribe(a,best);
  }
  if(W.tribes.length>1&&W.tribes.some(t=>t.members.length>2)&&R()<.2){
    const tr=pick(W.tribes.filter(t=>t.members.length>2));
    if(tr){
      const mem=tr.members.map(id=>W.animals.find(a=>a.id===id)).filter(a=>a&&!a.taken);
      if(mem.length>2){
        const a=pick(mem);
        const other=W.tribes.find(t=>t.id!==tr.id&&Math.hypot(t.center.x-a.x,t.center.z-a.z)<60);
        if(other)joinTribe(a,other);
      }
    }
  }
}
function updateGates(dt){
  for(const tr of W.tribes){
    const gate=W.things.find(t=>!t.gone&&t.kind==='portao'&&t.data.tribe===tr.id);
    if(!gate)continue;
    const near=W.animals.some(a=>a.tribeId===tr.id&&!a.taken&&Math.hypot(a.x-gate.x,a.z-gate.z)<4.8);
    const target=near?1:0;
    gate.data.open=clamp((gate.data.open||0)+(target-(gate.data.open||0))*Math.min(1,dt*3));
  }
}
function separateHabitatTribes(){
  for(const tr of W.tribes){
    const aquatic=tribeIsAquatic(tr);
    tr.members=tr.members.filter(id=>{
      const a=W.animals.find(x=>x.id===id);
      if(!a)return false;
      if(!!a.sp.marine!==aquatic){
        if(a.tribeId===tr.id)a.tribeId=null;
        return false;
      }
      return true;
    });
  }
}
function sharedLex(a,b){
  let n=0;const words=[];
  for(const k in a.lex){if(!/^[kva]:/.test(k)||a.lex[k]!==b.lex[k])continue;n++;words.push(a.lex[k])}
  return {n,words};
}
function dryTribeSpot(cx,cz){
  for(let i=0;i<80;i++){
    const an=rnd(0,TAU),d=i<20?rnd(2,10):rnd(10,26);
    const x=clamp(cx+Math.cos(an)*d,-EDGE+12,EDGE-12),z=clamp(cz+Math.sin(an)*d,-EDGE+12,EDGE-12);
    if(inWater(x,z,1.2))continue;
    if(biomeAt(x,z,hgt(x,z))===7)continue;
    if(W.things.some(t=>!t.gone&&(t.kind==='cerca'||t.kind==='computador'||t.kind==='mural'||t.kind==='quadro')&&Math.hypot(t.x-x,t.z-z)<11))continue;
    return {x,z};
  }
  return {x:clamp(cx,-EDGE+12,EDGE-12),z:clamp(cz,-EDGE+12,EDGE-12)};
}
function marineTribeSpot(cx,cz){
  if(!OCEAN_ZONE)return dryTribeSpot(cx,cz);
  for(let i=0;i<36;i++){
    const an=rnd(0,TAU),d=i===0?0:rnd(8,30);
    const x=clamp(cx+Math.cos(an)*d,-EDGE+12,EDGE-12);
    const z=clamp(cz+Math.sin(an)*d,-EDGE+12,EDGE-12);
    if(!isOcean(x,z)||coastDistance(x,z)>-12)continue;
    if(W.things.some(t=>!t.gone&&t.kind==='coral'&&Math.hypot(t.x-x,t.z-z)<12))continue;
    return {x,z};
  }
  const x=clamp(cx,-EDGE+12,EDGE-12),z=clamp(cz,-EDGE+12,EDGE-12),boundary=oceanBoundaryAt(x,z);
  if(OCEAN_ZONE.side==='west')return {x:Math.min(x,boundary-14),z};
  if(OCEAN_ZONE.side==='east')return {x:Math.max(x,-boundary+14),z};
  if(OCEAN_ZONE.side==='north')return {x,z:Math.min(z,boundary-14)};
  return {x,z:Math.max(z,-boundary+14)};
}
function formTribe(group){
  const aquatic=!!OCEAN_ZONE&&group.length>0&&group.every(a=>a.sp.marine);
  const habitatCount=W.tribes.filter(tr=>tribeIsAquatic(tr)===aquatic).length;
  if(habitatCount>=(aquatic?1:4))return null;
  let cx=0,cz=0;for(const a of group){cx+=a.x;cz+=a.z}cx/=group.length;cz/=group.length;
  const center=aquatic?marineTribeSpot(cx,cz):dryTribeSpot(cx,cz);
  const score={fogo:0,agua:aquatic?10:1,pedra:0,lua:0,floresta:1,lobo:0};
  const shared=new Set();
  for(const a of group){
    if(a.recipes.fogo||a.fear.fire>.35)score.fogo+=2;
    if(a.sp.swim)score.agua+=1.5;
    if(a.recipes.torre||a.recipes.picareta||a.recipes.mineral)score.pedra+=2;
    if(a.knowledge.estrelas||a.knowledge.lua||a.spk==='cigarra_bola'||a.spk==='cuica')score.lua+=1.5;
    if(a.lessons.wolf||a.taken)score.lobo+=3;
    for(const b of group){if(b!==a){const sh=sharedLex(a,b);sh.words.forEach(w=>shared.add(w))}}
  }
  const element=Object.keys(score).sort((p,q)=>score[q]-score[p])[0];
  const cl=CULTURES[element];
  const words=[...shared];
  const wname=words.length?pick(words):coin(group[0],3);
  const tname=wname[0].toUpperCase()+wname.slice(1);
  const id=W.tribeNid++;
  let stock=null,gate=null,totem=null,hearth=null,gateAn=null;
  const houseIds=[],reefIds=[];
  const style=(wname.length+element.length+group.length)%3;
  let houseMat='recife';
  if(aquatic){
    for(let i=0;i<6;i++){
      const an=i*TAU/6+rnd(-.18,.18),d=rnd(3,5);
      const reef=addThing('coral',center.x+Math.cos(an)*d,center.z+Math.sin(an)*d,{tribe:id,reef:true,hue:i%4});
      reefIds.push(reef.id);
    }
  }else{
    stock=addThing('cerca',center.x,center.z,{tribe:id,r:5.6,gate:rnd(0,TAU)});
    gateAn=stock.data.gate;
    gate=addThing('portao',center.x+Math.cos(gateAn)*5.6,center.z+Math.sin(gateAn)*5.6,{tribe:id,gate:gateAn,open:0});
    totem=addThing('totem',center.x+1.7,center.z+1.4,{tribe:id,element});
    hearth=addThing('fogo',center.x,center.z,{tribe:id,contained:true,fuel:1e9,hearth:true,by:group[0],t0:W.t});
    addThing('mineral',center.x+1.1,center.z-.6,{});
    addThing('mineral',center.x+1.55,center.z+.45,{});
    const vbm=biomeAt(center.x,center.z);
    houseMat=(vbm===8||vbm===9)?'arenito':(vbm===3||vbm===7?'pedra':'madeira');
    for(let i=0;i<3;i++){
      const an=i*TAU/3+rnd(-.35,.35),d=rnd(2.3,3.5);
      const x=center.x+Math.cos(an)*d,z=center.z+Math.sin(an)*d;
      const h=addThing('casa',x,z,{tribe:id,style,roof:cl.roof,house:true,mat:houseMat,by:group[0]});
      houseIds.push(h.id);
    }
  }
  const faithWord=coin(group[0],3);
  const tr={id,name:tname,members:group.map(a=>a.id),center,lang:words.slice(0,18),
    aquatic,culture:{element,style,label:aquatic?'do recife':cl.label,social:group.reduce((s,a)=>s+a.sp.soc,0)/group.length},
    faith:{element,name:faithWord,gloss:aquatic?'a vida que floresce sob as ondas':cl.gloss,piety:.2,prayers:[{word:faithWord,gloss:'o espírito '+(aquatic?'a vida que floresce sob as ondas':cl.gloss)}]},
    stockadeId:stock?stock.id:null,gateId:gate?gate.id:null,totemId:totem?totem.id:null,hearthId:hearth?hearth.id:null,
    houseIds,houses:houseIds.slice(),reefIds,mat:houseMat,village:0,gateAn,
    langBorn:W.t,langDead:0,langMixes:0,lastHouse:W.t,created:W.t};
  W.tribes.push(tr);W.stats.tribes=(W.stats.tribes||0)+1;
  W.langEvents=W.langEvents||[];
  W.langEvents.push({t:W.t,type:'nasceu',a:id,aName:tname,mat:houseMat});
  if(W.langEvents.length>60)W.langEvents.shift();
  for(const a of group){
    a.tribeId=id;a.exp+=2;a.n.social=clamp(a.n.social+.25);
    say(a,aquatic?`Somos <b>${tname}</b>, o povo do recife. Vamos ficar juntos sob as ondas.`:`Somos <b>${tname}</b>, o povo ${cl.label}. Vamos morar juntos atrás das estacas.`,'invent');
  }
  const matName={madeira:'madeira',pedra:'pedra',arenito:'arenito'}[houseMat];
  ev(aquatic?'🪸':'🏕️',aquatic?`Nasceu a tribo aquática <b>${tname}</b> (${group.length} bichos). Corais formam uma colônia no fundo do mar.`:`Nasceu a tribo <b>${tname}</b> (${group.length} bichos, cultura ${cl.label}). Cercaram um pedaço de chão com estacas e ergueram casas de ${matName}.`);
  UI&&UI.onTribe&&UI.onTribe(tr);
  return tr;
}
function maybeFormTribes(){
  if(W.animals.length<3||W.tribes.length>=5)return;
  const free=W.animals.filter(a=>!a.tribeId&&!a.taken&&a.faint<=0&&Object.keys(a.lex).length>=2);
  for(const a of shuffle(free)){
    if(a.tribeId)continue;
    const mates=free.filter(b=>b!==a&&!b.tribeId&&!!b.sp.marine===!!a.sp.marine&&hyp(a,b)<75&&sharedLex(a,b).n>=2);
    if(mates.length<2)continue;
    const group=[a,...mates.slice(0,Math.min(6,rint(2,4)))];
    formTribe(group);
    if(W.tribes.length>=5)break;
  }
}
function tribeFaithShift(tr,element,why){
  if(!tr||!CULTURES[element])return;
  const cl=CULTURES[element];
  tr.faith.element=element;tr.faith.gloss=cl.gloss;tr.faith.piety=clamp(tr.faith.piety+.15);
  const w=coin(W.animals.find(a=>tr.members.includes(a.id))||W.animals[0],3);
  tr.faith.prayers.push({word:w,gloss:cl.gloss});
  if(tr.faith.prayers.length>5)tr.faith.prayers.shift();
  ev('🕯️',`A fé de <b>${tr.name}</b> mudou: agora seguem o <b>${element}</b> (${why}).`);
  UI&&UI.onTribe&&UI.onTribe(tr);
}
function tribeWeapons(tr){
  const mem=tr.members.map(id=>W.animals.find(a=>a.id===id)).filter(a=>a&&!a.taken);
  let n=0;for(const a of mem)if(a.hands.some(k=>k==='lanca'||k==='armadura'||k==='bronze'||k==='machado'||k==='picareta'))n++;
  return {mem,n};
}
function decideCrisis(tr){
  const {mem,n:weapons}=tribeWeapons(tr);
  if(!mem.length)return null;
  const brave=mem.reduce((s,a)=>s+a.sp.tough,0)/mem.length;
  const food=W.things.filter(t=>!t.gone&&((t.kind==='pilha'&&t.data.items)||t.kind==='peixe'||t.kind==='bagre')&&Math.hypot(t.x-tr.center.x,t.z-tr.center.z)<30).length;
  const faith=tr.faith.piety||0;
  const weights={luta:.18+weapons*.5+brave*.35,acordo:.35+Math.min(food,6)*.1,sacrificio:.04+faith*.55,fuga:.9};
  let tot=0;for(const k in weights)tot+=weights[k];let r=R()*tot,type='fuga';
  for(const k in weights){r-=weights[k];if(r<=0){type=k;break}}
  const d={tribe:tr.id,type,t:W.t,text:''};
  if(type==='luta'){
    d.text=`decidiram <b>lutar</b> contra os lobos`;tr.faith.piety=clamp(faith+.05);
    for(const a of mem){if(a.hands.includes('lanca')||a.hands.includes('armadura'))a.lessons.brave=true;say(a,pick(['Não vou correr. Tenho uma lança.','A tribo fica. Vamos espantar os lobos!']),'alert')}
  }else if(type==='acordo'){
    d.text=`decidiram <b>negociar</b>: deixar comida e não brigar`;
    say(pick(mem),'Os lobos querem comida. Podemos deixar parte da nossa e eles vão embora.','think');
  }else if(type==='sacrificio'){
    const chosen=pick(mem.filter(a=>!a.taken))||mem[0];
    chosen.taken={until:W.t+3*W.dayLen,tribe:tr.id,why:'lobo'};
    chosen.state='taken';chosen.plan=null;chosen.cur=null;
    d.text=`ofereceram <b>${nameOf(chosen)}</b> aos lobos`;
    d.chosen=chosen.id;
    W.stats.sacrifices=(W.stats.sacrifices||0)+1;
    ev('🐺',`${nameTag(chosen)} foi oferecido aos lobos por <b>${tr.name}</b>. Deve voltar em três dias — e talvez tenha aprendido algo com eles.`);
    tribeFaithShift(tr,'lobo','um sacrifício foi aceito');
    say(chosen,pick(['Eu vou. Alguém precisa ir.','Se é pra salvar a tribo… eu vou.']),'alert');
  }else{
    d.text='decidiram <b>fugir e se esconder</b>';
  }
  W.crisis.decisions.push(d);
  ev(type==='luta'?'⚔️':type==='acordo'?'🤝':type==='sacrificio'?'🕯️':'🏃',`Em <b>${tr.name}</b>, os bichos ${d.text}.`);
  return d;
}
function spawnWolves(){
  const tr=W.tribes[0];
  const cx=tr?tr.center.x:0,cz=tr?tr.center.z:0;
  const an=rnd(0,TAU);
  const x=clamp(cx+Math.cos(an)*(HALF-14),-EDGE,EDGE),z=clamp(cz+Math.sin(an)*(HALF-14),-EDGE,EDGE);
  W.wolfNid=W.wolfNid||1;
  for(let i=0;i<3;i++){
    W.wolves.push({id:W.wolfNid++,x:x+Math.cos(an+1.5)*i*1.5,z:z+Math.sin(an+1.5)*i*1.5,yaw:an+Math.PI,hp:7,state:'raid',eatCd:0,target:null,wander:rnd(0,TAU)});
  }
}
function startCrisis(){
  W.crisis={nextDay:W.crisis.nextDay||dayNum()+10,phase:'raid',raidEnd:W.t+W.dayLen*.7,decisions:[],stolen:0,history:(W.crisis&&W.crisis.history)||[]};
  spawnWolves();
  W.stats.crises=(W.stats.crises||0)+1;
  ev('🐺','<b>Três lobos</b> saíram da mata. Vieram comer e saquear. Os bichos precisam decidir o que fazer.');
  if(!W.tribes.length){
    ev('😨','Nenhuma tribo formada: cada bicho vai ter que se esconder sozinho.');
    for(const a of W.animals)if(R()<.8){a.fear.wolf=1;say(a,pick(['Lobos! Vou correr!','Onde eu me escondo?','Aquilo é grande demais!']),'alert')}
  }else for(const tr of W.tribes)decideCrisis(tr);
}
function wolfDown(w,by){
  w.hp=0;w.state='down';
  const weapon=by&&['lanca','machado','picareta','bronze','armadura'].find(k=>by.hands.includes(k));
  const weaponName={lanca:'uma lança',machado:'um machado',picareta:'uma picareta',bronze:'uma barra de bronze',armadura:'um golpe protegido pela armadura'};
  ev('⚔️',`${by?nameTag(by)+' derrubou':'Derrubaram'} um lobo com ${weaponName[weapon]||'um golpe'}.`);
}
function wolfSteal(w){
  if((W.crisis.stolen||0)>=8)return;
  let best=null,bd=1e9;
  for(const t of W.things){
    if(t.gone)continue;
    const isFood=(t.kind==='pilha'&&t.data.items&&Object.keys(t.data.items).length)||t.kind==='peixe'||t.kind==='bagre';
    if(!isFood)continue;
    const d=Math.hypot(t.x-w.x,t.z-w.z);if(d<bd){bd=d;best=t}
  }
  if(!best||bd>2.2)return;
  if(best.kind==='pilha'){
    const ks=Object.keys(best.data.items);const k=pick(ks);
    best.data.items[k]--;
    if(best.data.items[k]<=0)delete best.data.items[k];
    if(!Object.keys(best.data.items).length)removeThing(best);else V&&V.onChange(best);
  }else removeThing(best);
  W.crisis.stolen=(W.crisis.stolen||0)+1;w.eatCd=7;
  if(W.crisis.stolen===1)ev('🐺','Os lobos estão <b>saqueando comida</b> dos montinhos e das águas.');
}
function updateWolves(dt){
  if(!W.crisis||W.crisis.phase==='none')return;
  for(const w of W.wolves){
    if(w.state==='down'){w.downT=(w.downT||0)+dt;continue}
    w.eatCd=(w.eatCd||0)-dt;
    if(W.crisis.phase==='retreat'){
      const tr=W.tribes[0];const tx=tr?tr.center.x:0,tz=tr?tr.center.z:0;
      const an=Math.atan2(w.z-tz,w.x-tx);w.yaw=an;
      w.x+=Math.cos(an)*3.6*dt;w.z+=Math.sin(an)*3.6*dt;
      if(Math.abs(w.x)>HALF-6||Math.abs(w.z)>HALF-6)w.gone=true;
      continue;
    }
    if(w.eatCd<=0){
      let best=null,bd=1e9;
      for(const t of W.things){
        if(t.gone)continue;
        const isFood=(t.kind==='pilha'&&t.data.items&&Object.keys(t.data.items).length)||t.kind==='peixe'||t.kind==='bagre';
        if(!isFood)continue;
        const d=Math.hypot(t.x-w.x,t.z-w.z);if(d<bd){bd=d;best=t}
      }
      if(best){w.tx=best.x;w.tz=best.z}
      else if(W.tribes.length){const tr=pick(W.tribes);w.tx=tr.center.x;w.tz=tr.center.z}
      else {w.wander+=rnd(-.8,.8);w.tx=w.x+Math.cos(w.wander)*12;w.tz=w.z+Math.sin(w.wander)*12}
    }
    if(w.tx!==undefined&&w.tz!==undefined){
      const dx=w.tx-w.x,dz=w.tz-w.z,d=Math.hypot(dx,dz);
      if(d>.8){
        const an=Math.atan2(dz,dx);w.yaw=an;const sp=3.4*dt;
        w.x+=Math.cos(an)*sp;w.z+=Math.sin(an)*sp;
      }else if(w.eatCd<=0)wolfSteal(w);
    }
  }
  W.wolves=W.wolves.filter(w=>!w.gone&&!(w.state==='down'&&(w.downT||0)>4));
  if(W.crisis.phase==='raid'&&W.t>=W.crisis.raidEnd){
    W.crisis.phase='retreat';W.crisis.retreatEnd=W.t+60;
    // lutadores expulsam os lobos mais cedo
    if(W.crisis.decisions&&W.crisis.decisions.some(d=>d.type==='luta')){W.crisis.retreatEnd=W.t+8;ev('🐺','Os lobos recuaram diante das lanças da tribo.')}
    else ev('🐺',`Os lobos terminaram de saquear e estão indo embora. ${W.wolfEvery>0?('Vão voltar em '+W.wolfEvery+' dia(s).'):'Talvez não voltem mais.'}`);
  }
  if(W.crisis.phase==='retreat'&&W.t>=(W.crisis.retreatEnd||W.t+1))endCrisis();
}
function endCrisis(){
  W.wolves=[];
  W.crisis.phase='none';
  W.crisis.nextDay=W.wolfEvery>0?dayNum()+W.wolfEvery:1e9;
  W.crisis.history=W.crisis.history||[];
  W.crisis.history.push({day:dayNum(),decisions:W.crisis.decisions||[],stolen:W.crisis.stolen||0});
  if(W.crisis.history.length>8)W.crisis.history.shift();
  ev('🌲',`Os lobos sumiram na mata. A floresta respira de novo.${W.wolfEvery>0?(' Eles voltam em '+W.wolfEvery+' dia(s).'):' E não parecem voltar.'}`);
}
function returnFromWolves(a){
  a.taken=null;a.state='idle';a.plan=null;a.cur=null;a.faint=0;
  const tr=tribeOf(a);
  if(tr){const s=tribeIsAquatic(tr)?marineTribeSpot(tr.center.x,tr.center.z):dryTribeSpot(tr.center.x,tr.center.z);a.x=s.x;a.z=s.z}else{const s=freePos();a.x=s.x;a.z=s.z}
  a.y=hgt(a.x,a.z);
  const w=coin(a,3);a.lex['k:lobo']=w;
  a.known= a.known||{};
  a.lessons.wolf=true;a.fear.wolf=clamp((a.fear.wolf||0)-.25);
  a.exp+=3;a.n.saude=clamp(a.n.saude-.1);
  if(!a.recipes.lanca&&R()<.7){a.recipes.lanca={items:{galho:1,bronze:1}};say(a,'Os lobos me mostraram como uma ponta longa fere. Posso fazer uma lança.','invent')}
  say(a,`Voltei. Os lobos não me comeram — me ensinaram. Agora sei o nome deles: <b>${w}</b>.`,'name');
  ev('🐺',`${nameTag(a)} <b>voltou dos lobos</b> três dias depois, com uma palavra nova: <b>${w}</b>.`,a);
  if(tr)tribeFaithShift(tr,'lobo',`${nameOf(a)} voltou dos lobos`);
  UI&&UI.onInvent&&UI.onInvent(a);
}
function composeSong(tr){
  const mem=(tr?tr.members.map(id=>W.animals.find(a=>a.id===id)).filter(a=>a&&!a.taken):W.animals.filter(a=>!a.taken));
  if(!mem.length)return null;
  const by=pick(mem);
  let words=(tr&&tr.lang&&tr.lang.length)?tr.lang.slice():[];
  if(!words.length)words=Object.keys(by.lex).filter(k=>/^[kva]:/.test(k)).map(k=>by.lex[k]);
  if(!words.length)words=[coin(by,2)];
  const h=s=>{let x=7;for(const c of String(s))x=(x*31+c.charCodeAt(0))>>>0;return x};
  const name=(words[h(words[0]+by.id)%words.length]||words[0])+' '+(words[h(by.id+'x')%words.length]||words[0]);
  const PENT=[0,3,5,7,10];
  const notes=[];
  for(let i=0;i<12;i++){
    const w=words[(i+h(name))%words.length]||name;
    notes.push(48+(h(w+i)%2)*12+PENT[h(w+'n'+i)%5]);
  }
  const song={tribe:tr?tr.id:null,tribeName:tr?tr.name:null,name,words:words.slice(0,3),notes,by:by.id,byName:by.name||by.sp.label.toLowerCase(),day:dayNum(),t:W.t};
  W.songs=W.songs||[];W.songs.push(song);if(W.songs.length>24)W.songs.shift();
  by.songs=by.songs||[];by.songs.push({name,day:song.day});if(by.songs.length>6)by.songs.shift();
  W.stats.songs=(W.stats.songs||0)+1;
  ev('🎵',`${nameTag(by)} fez uma música ${tr?('na língua de <b>'+tr.name+'</b>'):'só pra si'}: “<b>${name}</b>”.`);
  UI&&UI.onSong&&UI.onSong(song);
  return song;
}
function maybeCompose(dt){
  W.songT=(W.songT!=null?W.songT:100)-dt;
  if(W.songT>0)return;
  W.songT=rnd(120,260);
  const tr=W.tribes.length&&R()<.8?pick(W.tribes):null;
  composeSong(tr);
}
/* bichos novos chegam pelo limite do mapa, se o jogador permitiu */
function spawnArrival(){
  const roster=(CFG&&CFG.species&&CFG.species.length?CFG.species:SPECIES_ORDER).filter(s=>SP[s]);
  if(!roster.length)return null;
  const spk=pick(roster);
  const dry=!!SP[spk].dry;
  let p=null;
  for(let i=0;i<70&&!p;i++){
    const an=rnd(0,TAU),d=rnd(HALF-28,HALF-8);
    const x=clamp(Math.cos(an)*d,-EDGE,EDGE),z=clamp(Math.sin(an)*d,-EDGE,EDGE);
    if(inWater(x,z,1.4))continue;
    const bm=biomeAt(x,z,hgt(x,z));
    if(bm===7)continue;
    if(dry&&bm!==8)continue;
    if(!dry&&bm===8&&roster.some(s=>SP[s].dry))continue;
    p={x,z};
  }
  if(!p)p={x:rnd(-20,20),z:rnd(-20,20)};
  const a=makeAnimal(spk,p.x,p.z);
  V&&V.onAnimal&&V.onAnimal(a);
  UI&&UI.onAnimals&&UI.onAnimals();
  W.arrivals=(W.arrivals||0)+1;
  ev('🐾',`Um <b>${SP[spk].label.toLowerCase()}</b> novo chegou à floresta. Agora são ${W.animals.length} bichos.`);
  return a;
}
function updateTribes(dt){
  W.tribeT=(W.tribeT||12)-dt;
  if(W.tribeT<=0){
    W.tribeT=12;separateHabitatTribes();maybeFormTribes();maybeRecruitTribes();
    // tribos que já sabem escrever acabam inventando números sozinhas
    for(const tr of W.tribes){
      if(tr.numerals||R()>.3)continue;
      const mem=tr.members.map(id=>W.animals.find(a=>a.id===id)).filter(Boolean);
      if(mem.some(a=>a.knowledge['escrita antiga']||a.knowledge['números']||a.knowledge.escrita))inventNumerals(tr);
    }
  }
  updateGates(dt);
  updateWolves(dt);
  maybeCompose(dt);
}
function floodAt(x,z){
  if(!W||W.flood<.12)return false;
  const h=hgt(x,z);
  if(h>.95)return false;
  const bm=biomeAt(x,z,h);
  return bm===5||bm===6;
}
function updateSeasons(dt){
  const day=dayNum(),yl=W.yearLen||16,cy=((day-1)%yl)+1;
  const winter=cy>=yl-3; // os últimos três dias do ano trazem neve
  const snowT=(winter||(W.weather&&W.weather.kind==='geada'))?1:0;
  const prev=W.snow||0;
  W.snow=clamp(prev+(snowT-prev)*dt*(snowT?.012:.008));
  if(prev<.5&&W.snow>=.5){W.stats.winters=(W.stats.winters||0)+1;ev('❄️','<b>A neve chegou.</b> O chão ficou branco e o frio aperta. Quem tem abrigo vai passar melhor.');}
  if(prev>=.5&&W.snow<.5)ev('🌤️','A neve derreteu. O verde voltou a aparecer.');
  // cheia do pantanal: dias de chuva e água subindo
  const floodSeason=cy>=4&&cy<=8;
  const target=floodSeason?(W.rain>0?.95:.7):(W.rain>0?.18:0);
  const pf=W.flood||0;
  W.flood=clamp(pf+(target-pf)*dt*(target>pf?.004:.002));
  if(pf<.25&&W.flood>=.25){W.stats.floods=(W.stats.floods||0)+1;ev('🌊','<b>O pantanal encheu.</b> A água rasa cobre o capim e os bichos andam devagar por ali.');}
  if(pf>=.25&&W.flood<.25)ev('🌿','As águas baixaram no pantanal.');
}

/* clima: tempestades, neblina, geada, seca e granizo vêm e vão */
function updateClimate(dt){
  if(!W.weather)W.weather={kind:'limpo',until:0,next:rnd(50,110)};
  const w=W.weather;
  if(w.kind!=='limpo'&&W.t>w.until){
    const old=w.kind;
    w.kind='limpo';w.until=0;w.next=rnd(70,160);
    V&&V.onWeather&&V.onWeather('limpo');
    if(old==='seca')W.nextRain=Math.min(W.nextRain,W.t+18);
    if(old==='tempestade'||old==='granizo')ev('🌤️','O tempo abriu. A floresta respira aliviada.');
    if(old==='neblina')ev('🌫️','A neblina se desfez. Agora dá pra ver longe de novo.');
    if(old==='geada')ev('🌤️','A geada derreteu ao sol da manhã.');
    if(old==='seca')ev('🌧️','Depois da seca, o cheiro de chuva volta ao ar.');
    return;
  }
  if(w.kind==='limpo'){
    w.next-=dt;
    if(w.next>0)return;
    const k=pick(['tempestade','neblina','geada','seca','granizo']);
    w.kind=k;w.until=W.t+rnd(50,120);w.next=9999;
    V&&V.onWeather&&V.onWeather(k);
    const MSG={
      tempestade:'<b>Tempestade!</b> O céu fecha, o vento dobra as árvores e os raios caem.',
      neblina:'<b>Neblina.</b> A mata some de vista; os bichos só percebem o que está perto.',
      geada:'<b>Geada.</b> O chão vira gelo e o frio aperta mesmo de dia.',
      seca:'<b>Seca.</b> O rio baixa, as poças somem e a comida fica mais difícil.',
      granizo:'<b>Granizo!</b> Pedrinhas de gelo batem nas folhas e nas costas de quem está fora.',
    };
    ev(k==='tempestade'?'⛈️':k==='neblina'?'🌫️':k==='geada'?'❄️':k==='seca'?'☀️':'🧊',MSG[k]);
    if(k==='tempestade'){W.rain=Math.max(W.rain,90);W.nextRain=Math.max(W.nextRain,120);V&&V.onRain(true)}
    if(k==='granizo'){W.rain=Math.max(W.rain,50);V&&V.onRain(true)}
    if(k==='seca'){W.rain=0;V&&V.onRain(false);W.nextRain=Math.max(W.nextRain,50)}
    if(k==='geada')W.nextRain=Math.max(W.nextRain,40);
    W.stats.weather=(W.stats.weather||0)+1;
    return;
  }
  // efeitos contínuos
  if(w.kind==='tempestade'&&R()<dt*.035){
    const trees=W.things.filter(t=>!t.gone&&t.kind==='arvore'&&!t.data.charred);
    const tr=pick(trees);
    if(tr){const c=cellAt(tr.x,tr.z);if(c){burnCell(c,null);V&&V.spark(tr.x,tr.z);ev('⚡','Um raio acendeu uma árvore na tempestade!');W.stats.fires++}}
  }
}

/* ---- loop do mundo ---- */
function worldTick(dt){
  W.t+=dt;
  updateSeasons(dt);
  updateClimate(dt);
  if(!W.crisis)W.crisis={nextDay:dayNum()+10,phase:'none',raidEnd:0,decisions:[],history:[]};
  if(W.crisis.phase==='none'&&dayNum()>=W.crisis.nextDay)startCrisis();
  // chegadas de bichos combinadas pelo jogador (respeitando o limite)
  if((W.arriveEvery|0)>0&&dayNum()>=W.arriveNext){
    W.arriveNext=dayNum()+W.arriveEvery;
    if(W.animals.length<(W.animalCap||80))spawnArrival();
  }
  // chuva
  if(W.rain>0){W.rain-=dt;if(W.rain<=0){W.rain=0;ev('☀️','A chuva parou.');V&&V.onRain(false)}}
  else{W.nextRain-=dt;if(W.nextRain<=0){W.rain=rnd(35,65);W.nextRain=rnd(70,150);ev('🌧️','Começou a chover.');V&&V.onRain(true);
    if(R()<.4){const trees=W.things.filter(t=>!t.gone&&t.kind==='arvore');const tr=pick(trees);if(tr){const c=cellAt(tr.x,tr.z);c&&burnCell(c,null);V&&V.spark(tr.x,tr.z);ev('⚡','Um raio acertou uma árvore!');W.stats.fires++}}}}
  // fogo
  const fires=W.things.filter(t=>!t.gone&&t.kind==='fogo');
  for(const f of fires){
    f.data.fuel-=dt*(W.rain>0?3.5:1);
    const cell=cellAt(f.x,f.z);
    if(!f.data.contained&&cell&&cell.st===0)burnCell(cell,f.data.by);
    // ignita abrigos próximos
    for(const t of W.things){if(t.gone||t===f||(t.kind!=='abrigo'&&t.kind!=='pilha'))continue;if(Math.hypot(t.x-f.x,t.z-f.z)<1.6&&R()<dt*.25){ev('🔥',`${K[t.kind].g==='abrigo'?'O abrigo':'Um montinho'} pegou fogo!`);lightThing(t,f.data.by||W.animals[0],true);break}}
    if(f.data.fuel<=0){removeThing(f);const c=cellAt(f.x,f.z);if(c&&c.st===0){c.st=2;c.f=0;c.rg=rnd(100,160);V&&V.paintCell(c)}V&&V.ash&&V.ash(f.x,f.z);}
  }
  // células queimando
  for(let i=W.burning.length-1;i>=0;i--){
    const c=W.burning[i];
    c.bt-=dt*(W.rain>0?2.5:1);
    if(c.bt<=0){c.st=2;c.f=0;c.rg=rnd(100,170);W.burning.splice(i,1);V&&V.paintCell(c);continue}
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      if(!dx&&!dy)continue;
      const nx=c.ix+dx,ny=c.iy+dy;
      if(nx<0||ny<0||nx>=GN||ny>=GN)continue;
      const n=W.cells[ny*GN+nx];
      if(n.st===0&&n.f>0&&R()<dt*.2*n.f*(W.rain>0?.2:1)*((dx&&dy)?.6:1))burnCell(n,c.by);
    }
  }
  // objetos em células queimando
  W.regT+=dt;
  if(W.burning.length){
    for(const t of W.things){
      if(t.gone)continue;const k=K[t.kind];if(!k.flam&&t.kind!=='arvore')continue;
      const c=cellAt(t.x,t.z);if(!c||c.st!==1)continue;
      if(t.kind==='arvore'){t.data.burn+=dt;if(t.data.burn>3&&!t.data.charred){t.data.charred=true;t.data.br=0;W.stats.trees++;V&&V.onChange(t)}}
      else if(t.kind==='moita'){t.data.burn+=dt;if(t.data.burn>2){removeThing(t)}}
      else if(t.kind==='fogo'||t.kind==='toca')continue;
      else if(R()<dt*.5){if(t.kind==='abrigo'&&!W.events.some(e=>e.icon==='🔥'&&/abrigo/.test(e.html)&&W.t-e.t<180))ev('🔥','Um abrigo queimou no incêndio.');removeThing(t)}
    }
  }
  // regeneração
  if(W.regT>=5){
    const rdt=W.regT;W.regT=0;
    for(const c of W.cells){if((c.st===2||c.st===3)&&c.rg>0){c.rg-=rdt;if(c.rg<=0){c.st=0;c.f=rnd(.35,.7);c.digs=0;V&&V.paintCell(c)}}}
    for(const t of W.things){
      if(t.gone)continue;
      if(t.kind==='moita'&&!t.data.burn){t.data.rg+=rdt;if(t.data.rg>=14&&t.data.b<5){t.data.rg=0;t.data.b++;V&&V.onChange(t)}}
      if(t.kind==='arvore'&&!t.data.charred){t.data.rg+=rdt;if(t.data.rg>=45&&t.data.br<3){t.data.rg=0;t.data.br++}}
      if(t.kind==='represa'){t.data.rg=(t.data.rg||0)+rdt;if(t.data.rg>=25&&t.data.fish<3){t.data.rg=0;t.data.fish++}}
      if(t.kind==='plantacao'&&(t.data.ripe|0)<3){t.data.growT=(t.data.growT||0)+rdt;if(t.data.growT>=18){t.data.growT=0;t.data.ripe=(t.data.ripe|0)+1;V&&V.onChange(t)}}
    }
    // as tribos juntam pedras brilhantes perto da fogueira para testar o bronze
    for(const tr of W.tribes){
      const n=W.things.reduce((s,t)=>s+(!t.gone&&t.kind==='mineral'&&Math.hypot(t.x-tr.center.x,t.z-tr.center.z)<3.2?1:0),0);
      if(n<2&&R()<.3)addThing('mineral',tr.center.x+1.25+rnd(-.15,.15),tr.center.z-.35+rnd(-.15,.15),{});
    }
    const cnt=k=>W.things.reduce((n,t)=>n+(!t.gone&&t.kind===k),0);
    // as plantas se espalham sozinhas: uma semente cai perto da planta mãe
    const trySpread=(kind,cap,chance,test)=>{
      if(W.weather&&W.weather.kind==='seca'&&R()<.6)return;
      if(R()>chance||cnt(kind)>=cap)return;
      const src=W.things.filter(t=>!t.gone&&t.kind===kind);
      if(!src.length)return;
      const tr=pick(src),a=rnd(0,TAU),d=rnd(1.6,6.5);
      const x=tr.x+Math.cos(a)*d,z=tr.z+Math.sin(a)*d;
      if(Math.abs(x)>EDGE-1||Math.abs(z)>EDGE-1)return;
      if(test&&!test(x,z))return;
      if(kind==='moita')addThing(kind,x,z,{b:rint(1,3),rg:0,burn:0});
      else addThing(kind,x,z,{});
    };
    trySpread('flor',210,.55,(x,z)=>!inWater(x,z,1.1));
    trySpread('capim',180,.55,(x,z)=>!inWater(x,z,1.1));
    trySpread('moita',160,.46,(x,z)=>!inWater(x,z,1.4));
    trySpread('fruta',85,.42,(x,z)=>!inWater(x,z,1.2));
    trySpread('samambaia',95,.38,(x,z)=>!inWater(x,z,1.2));
    trySpread('junco',160,.36,(x,z)=>inWater(x,z,2.8)||wetAt(x,z)>.2);
    trySpread('cogumelo_m',60,.32,(x,z)=>!inWater(x,z,1.1));
    trySpread('cogumelo_v',60,.32,(x,z)=>!inWater(x,z,1.1));
    trySpread('pinha',85,.32,(x,z)=>!inWater(x,z,1.1));
    trySpread('raiz',50,.24,(x,z)=>!inWater(x,z,1.1));
    if(cnt('monte')<60&&R()<.8){const p=freePos();addThing('monte',p.x,p.z,{})}
    if(cnt('galho')<85&&R()<.75){const tr=pick(W.things.filter(t=>!t.gone&&t.kind==='arvore'&&!t.data.charred));if(tr)spawnItem('galho',tr.x,tr.z)}
    if(cnt('folha')<85&&R()<.75){const tr=pick(W.things.filter(t=>!t.gone&&t.kind==='arvore'&&!t.data.charred));if(tr)spawnItem('folha',tr.x,tr.z)}
    if(cnt('cogumelo_m')+cnt('cogumelo_v')<90&&R()<.5){const tr=pick(W.things.filter(t=>!t.gone&&t.kind==='arvore'));if(tr){const q=spawnItem(R()<.5?'cogumelo_m':'cogumelo_v',tr.x,tr.z);if(inPond(q.x,q.z,1.4))removeThing(q)}}
    if(cnt('fruta')<70&&R()<.45){const tr=pick(W.things.filter(t=>!t.gone&&t.kind==='arvore'&&!t.data.charred));if(tr){const q=spawnItem('fruta',tr.x,tr.z);if(inPond(q.x,q.z,1.3))removeThing(q)}}
    if(PONDS.length&&cnt('peixe')<55&&R()<.5){const p=pick(PONDS);const an=rnd(0,TAU),d=p.r*rnd(.2,.9);addThing('peixe',p.x+Math.cos(an)*d,p.z+Math.sin(an)*d,{ph:rnd(0,TAU)})}
    if(PONDS.length&&cnt('bagre')<16&&R()<.35){const p=pick(PONDS);const an=rnd(0,TAU),d=p.r*rnd(.2,.8);addThing('bagre',p.x+Math.cos(an)*d,p.z+Math.sin(an)*d,{ph:rnd(0,TAU)})}
    const sea=W.oceanCells||[];
    const countOcean=kind=>W.things.reduce((n,t)=>n+(!t.gone&&t.kind===kind&&isOcean(t.x,t.z)?1:0),0);
    if(sea.length&&countOcean('peixe')<76&&R()<.65){const c=pick(sea);addThing('peixe',c.cx+rnd(-.7,.7),c.cz+rnd(-.7,.7),{ph:rnd(0,TAU)})}
    if(sea.length&&countOcean('alga')<120&&R()<.55){const c=pick(sea);addThing('alga',c.cx+rnd(-.7,.7),c.cz+rnd(-.7,.7),{ph:rnd(0,TAU)})}
    if(sea.length&&countOcean('concha')<52&&R()<.3){const c=pick(sea);addThing('concha',c.cx+rnd(-.7,.7),c.cz+rnd(-.7,.7),{})}
    const freshAlgae=W.things.reduce((n,t)=>n+(!t.gone&&t.kind==='alga'&&!isOcean(t.x,t.z)&&(inPond(t.x,t.z)||inRiver(t.x,t.z))?1:0),0);
    if(freshAlgae<90&&R()<.5){
      const wetlands=PONDS.filter(p=>p.marsh),p=pick(wetlands.length?wetlands:PONDS);
      if(p){const a=rnd(0,TAU),d=p.r*rnd(.2,.8);addThing('alga',p.x+Math.cos(a)*d,p.z+Math.sin(a)*d,{ph:rnd(0,TAU)})}
      else{const z=rnd(-HALF+12,HALF-12);addThing('alga',riverX(z),z,{ph:rnd(0,TAU)})}
    }
    if(cnt('junco')<120&&R()<.45){const p=freePos();if(wetAt(p.x,p.z)>.1||inWater(p.x,p.z,2.4))addThing('junco',p.x,p.z,{})}
    // não deixar montinhos e abrigos esquecidos entupirem o mundo (e o save)
    if(cnt('pilha')>170){
      const old=W.things.find(t=>{
        if(t.gone||t.kind!=='pilha')return false;
        const its=t.data.items||{};let n=0;for(const k in its)n+=its[k];
        if(n>1)return false;
        for(const a of W.animals){
          if(a.project&&a.project.pos&&Math.hypot(a.project.pos.x-t.x,a.project.pos.z-t.z)<3)return false;
          if(Math.hypot(a.x-t.x,a.z-t.z)<22)return false;
        }
        return true;
      });
      if(old)removeThing(old);
    }
    if(cnt('abrigo')>32){
      const old=W.things.find(t=>{
        if(t.gone||t.kind!=='abrigo')return false;
        for(const a of W.animals){
          if(a.project&&a.project.pos&&Math.hypot(a.project.pos.x-t.x,a.project.pos.z-t.z)<3)return false;
          if(Math.hypot(a.x-t.x,a.z-t.z)<40)return false;
        }
        return true;
      });
      if(old)removeThing(old);
    }
    if(W.things.length>1500){W.things=W.things.filter(t=>!t.gone)}
  }
  W.percT+=dt;
  if(W.percT>=.5){W.percT=0;for(const a of W.animals)perceive(a)}
  updateTribes(dt);
  for(const a of W.animals)stepAnimal(a,dt);
  // sincroniza passeio: todo bicho boia na superfície quando está na água
  for(const a of W.animals){
    const y=hgt(a.x,a.z),pond=inPond(a.x,a.z,.92);
    const shallowMarsh=!!(pond&&pond.marsh)||(floodAt(a.x,a.z)&&W.flood>.5);
    const wet=inWater(a.x,a.z,.92)||floodAt(a.x,a.z)&&W.flood>.5;
    a.y=wet?Math.max(y,shallowMarsh?WATER_Y-.13+Math.min(.18,W.flood*.18):WATER_Y+.02):y;
  }
  updateCampaign();
}
