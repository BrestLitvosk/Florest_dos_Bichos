'use strict';
/* ============================================================
   FLORESTA — boot, loop, save/load
   ============================================================ */

const SAVE_KEY='florestaViva.save.v1';
const SAVE_VERSION=3;
const STEP=.05;

let speed=1, paused=false, lastSpeed=1;
let saveReady=false;

/* ---------------- save / load ---------------- */
function cleanThingData(t){
  const d={};
  for(const k in t.data){if(k==='by'||k==='pond')continue;d[k]=t.data[k]}
  return d;
}
function serializeWorld(){
  const data={
    v:SAVE_VERSION, ts:Date.now(), seed:W.seed, t:W.t, dayLen:W.dayLen, rain:W.rain, nextRain:W.nextRain,
    nid:W.nid, regT:W.regT, percT:W.percT, stats:W.stats,
    names:[...W.names], words:[...W.words], inventions:W.inventions.slice(-200),
    events:W.events.slice(-80),
    mural:W.mural||{marks:[]},quadro:W.quadro||{marks:[]},
    tribes:W.tribes||[],tribeNid:W.tribeNid||1,wolves:W.wolves||[],wolfNid:W.wolfNid||1,
    crisis:W.crisis||null,snow:W.snow||0,flood:W.flood||0,yearLen:W.yearLen||16,
    weather:W.weather||{kind:'limpo',until:0,next:80},
    cfg:CFG,gn:GN,biomesV:2,rosterV:2,faunaV:2,wolfEvery:W.wolfEvery||0,wolfFirst:W.wolfFirst||0,
    arriveEvery:W.arriveEvery||0,animalCap:W.animalCap||80,arriveNext:W.arriveNext||0,arrivals:W.arrivals||0,
    songs:(W.songs||[]).slice(-24),songT:W.songT||0,
    // células compactas: só os números que mudam, sem objetos repetidos
    cellsV:2,
    cellSt:W.cells.map(c=>c.st),
    cellF:W.cells.map(c=>+c.f.toFixed(2)),
    cellDigs:W.cells.map(c=>c.digs),
    cellRg:W.cells.map(c=>Math.round(c.rg)),
    cellSh:W.cells.map(c=>+c.sh.toFixed(2)),
    burning:W.burning.map(c=>[c.ix,c.iy]),
    things:W.things.filter(t=>!t.gone).map(t=>({id:t.id,kind:t.kind,x:t.x,z:t.z,data:cleanThingData(t)})),
    animals:W.animals.map(a=>{
      const seen=[];for(const id in a.seen)if(a.seen[id]&&!a.seen[id].gone)seen.push(+id);
      const others=[];for(const id in a.others)others.push({id:+id,t:a.others[id].t});
      const ld=a.lastDig&&a.lastDig.cell?{x:a.lastDig.x,z:a.lastDig.z,t:a.lastDig.t,ix:a.lastDig.cell.ix,iy:a.lastDig.cell.iy}:null;
      return {
        id:a.id,spk:a.spk,name:a.name,x:a.x,z:a.z,yaw:a.yaw,n:{...a.n},
        curio:a.curio,hands:a.hands.slice(),handT:a.handT,mem:a.mem,lex:a.lex,
        words:[...a.words],kinds:[...a.kinds],phon:a.phon,seen,others,
        tried:a.tried,recipes:a.recipes,inventions:a.inventions,lessons:a.lessons,fear:a.fear,
        known:a.known,knowledge:a.knowledge,research:a.research,
        age:a.age,exp:a.exp,log:a.log.slice(-60),wish:a.wish,ideas:a.ideas,
        project:a.project,stats:a.stats,vc:a.vc,lastDig:ld,faint:a.faint,
        songs:(a.songs||[]).slice(-6),
        tribeId:a.tribeId||null,taken:a.taken||null,ruinT:a.ruinT||0,
        pers:a.pers||null,opinion:a.opinion||{},thoughtT:a.thoughtT||0,dreamT:a.dreamT||0,
      };
    }),
    meta:{
      selected:UI&&UI.selectedId?UI.selectedId():null,
      follow:V?V.getFollow():false,
      speed, paused,
    },
  };
  return data;
}
function deserializeWorld(data){
  if(!data||data.v!==SAVE_VERSION)throw new Error('save incompatível');
  R=mulberry32(((Date.now()>>>0)^0x9e3779b9)>>>0);
  W={
    seed:data.seed,t:data.t,dayLen:data.dayLen||240,rain:data.rain||0,nextRain:data.nextRain||120,
    things:[],byId:{},animals:[],cells:[],burning:[],events:data.events||[],nid:data.nid||1,regT:data.regT||0,percT:0,
    mural:data.mural||{marks:[]},quadro:data.quadro||{marks:[]},
    tribes:data.tribes||[],tribeNid:data.tribeNid||1,wolves:data.wolves||[],wolfNid:data.wolfNid||1,
    crisis:data.crisis||null,snow:data.snow||0,flood:data.flood||0,yearLen:data.yearLen||16,tribeT:12,
    weather:data.weather||{kind:'limpo',until:0,next:rnd(50,110)},
    wolfEvery:data.wolfEvery!=null?data.wolfEvery:(CFG?CFG.wolfDays:10),
    wolfFirst:data.wolfFirst!=null?data.wolfFirst:(CFG?CFG.wolfFirst:10),
    arriveEvery:data.arriveEvery!=null?data.arriveEvery:(CFG?CFG.arriveEvery:0),
    animalCap:data.animalCap||(CFG?CFG.animalCap:80),
    arriveNext:data.arriveNext||1e9,arrivals:data.arrivals||0,
    songs:data.songs||[],songT:data.songT||0,
    stats:data.stats||{fires:0,words:0,inventions:0,trees:0,mixes:0},
    names:new Set(data.names||[]),words:new Set(data.words||[]),inventions:data.inventions||[],
  };
  W.stats.mixes=W.stats.mixes||0;W.stats.crises=W.stats.crises||0;W.stats.sacrifices=W.stats.sacrifices||0;W.stats.tribes=W.stats.tribes||0;
  let migrated=false;
  const compact=Array.isArray(data.cellSt)&&data.cellSt.length===GN*GN;
  const gridOk=compact||(Array.isArray(data.cells)&&data.cells.length===GN*GN);
  if(compact){
    for(let iy=0;iy<GN;iy++)for(let ix=0;ix<GN;ix++){
      const i=iy*GN+ix;
      const cx=-HALF+ix*CELL+CELL/2,cz=-HALF+iy*CELL+CELL/2;
      const h0=hgt(cx,cz);
      W.cells.push({ix,iy,cx,cz,st:data.cellSt[i],f:data.cellF?data.cellF[i]:1,bt:0,digs:data.cellDigs?data.cellDigs[i]:0,rg:data.cellRg?data.cellRg[i]:0,sh:data.cellSh?data.cellSh[i]:.5,h:h0,bm:biomeAt(cx,cz,h0),tb:0,by:null});
    }
  }else if(gridOk){
    W.cells=data.cells.map(c=>({ix:c.ix,iy:c.iy,cx:c.cx,cz:c.cz,st:c.st,f:c.f,bt:c.bt,digs:c.digs,rg:c.rg,sh:c.sh,h:c.h,bm:c.bm!=null?c.bm:biomeAt(c.cx,c.cz,c.h),tb:0,by:null}));
  }else{
    // save de mapa antigo: reconstrói o terreno no tamanho novo (e enche a área nova)
    migrated=true;
    for(let iy=0;iy<GN;iy++)for(let ix=0;ix<GN;ix++){
      const cx=-HALF+ix*CELL+CELL/2,cz=-HALF+iy*CELL+CELL/2;
      const h0=hgt(cx,cz);
      const pnd=inPond(cx,cz,1.12)||inRiver(cx,cz,1.15);
      W.cells.push({ix,iy,cx,cz,st:pnd?4:0,f:pnd?0:rnd(.55,1),bt:0,digs:0,rg:0,sh:R(),h:h0,bm:biomeAt(cx,cz,h0),tb:0,by:null});
    }
  }
  for(const st of data.things||[]){
    const d=Object.assign({},st.data||{});
    if(st.kind==='agua'){const p=PONDS.find(p=>Math.abs(p.x-st.x)<.01&&Math.abs(p.z-st.z)<.01);if(p)d.pond=p}
    const t={id:st.id,kind:st.kind,x:st.x,z:st.z,data:d,gone:false};
    W.things.push(t);W.byId[t.id]=t;
  }
  for(const b of data.burning||[]){
    const c=W.cells[b[1]*GN+b[0]];
    if(c&&c.st===1){c.by=null;W.burning.push(c)}
  }
  for(const sa of data.animals||[]){
    const spk=SP[sa.spk]?sa.spk:'castor';
    const a={
      id:sa.id,spk,sp:SP[spk],x:sa.x,z:sa.z,yaw:sa.yaw||0,y:hgt(sa.x,sa.z),
      name:sa.name||null,lex:sa.lex||{},words:new Set(sa.words||[]),phon:sa.phon||{c:['k','p','t'],v:['a','o','i'],e:['n','s']},
      n:Object.assign({fome:.6,sede:.6,energia:.6,calor:.6,saude:1,social:.5},sa.n||{}),
      curio:sa.curio!=null?sa.curio:.6,
      hands:sa.hands||[],handT:sa.handT||0,mem:sa.mem||{},seen:{},kinds:new Set(sa.kinds||[]),others:{},
      tried:sa.tried||{},recipes:sa.recipes||{},inventions:sa.inventions||[],
      lessons:sa.lessons||{burned:false},fear:Object.assign({fire:0,wolf:0},sa.fear||{}),
      known:sa.known||{},knowledge:sa.knowledge||{},research:sa.research||0,
      tribeId:sa.tribeId||null,taken:sa.taken||null,mind:null,ruinT:sa.ruinT||0,
      pers:sa.pers||null,opinion:sa.opinion||{},thoughtT:sa.thoughtT||0,dreamT:sa.dreamT||0,lastThinkT:0,
      plan:null,cur:null,state:sa.taken?'taken':sa.faint>0?'faint':'idle',idle:rnd(.3,1.2),age:sa.age||0,exp:sa.exp||0,
      log:sa.log||[],bubble:null,wish:sa.wish||{text:'…',tag:''},ideas:sa.ideas||[],project:sa.project||null,
      stats:Object.assign({eaten:0,drank:0,slept:0,dug:0,burned:0,built:0,talks:0,fished:0},sa.stats||{}),
      songs:sa.songs||[],gateT:0,
      vc:sa.vc||{},wishT:0,muse:rnd(8,16),lastCand:'',pain:0,heat:{warm:0,burn:false},
      lastDig:null,walk:0,faint:sa.faint||0,fleeing:false,fleeT:0,burnT:0,fireNear:null,
    };
    for(const id of sa.seen||[]){if(W.byId[id])a.seen[id]=W.byId[id]}
    if(sa.lastDig){
      const c=W.cells[(sa.lastDig.iy||0)*GN+(sa.lastDig.ix||0)];
      if(c)a.lastDig={x:sa.lastDig.x,z:sa.lastDig.z,t:sa.lastDig.t,cell:c};
    }
    W.animals.push(a);
    if(!a.pers||!a.pers.dream)initSelf(a);
  }
  for(const sa of data.animals||[]){
    const a=W.animals.find(x=>x.id===sa.id);if(!a)continue;
    for(const o of sa.others||[]){
      const other=W.animals.find(x=>x.id===o.id);
      if(other)a.others[o.id]={o:other,t:o.t};
    }
  }
  // mundos antigos recebem os bichos novos (paca, tamanduá, garça, jaguatirica) uma vez só
  if(!(data.faunaV>=2)){
    for(const spk of ['paca','tamandua','garca','jaguatirica']){
      if(!SP[spk]||W.animals.some(a=>a.spk===spk))continue;
      let x,z;
      if(spk==='garca'&&PONDS.length){const p=pick(PONDS),an=rnd(0,TAU);x=p.x+Math.cos(an)*(p.r+1.2);z=p.z+Math.sin(an)*(p.r+1.2)}
      else{const an=rnd(0,TAU),rr=rnd(8,24);x=Math.cos(an)*rr;z=Math.sin(an)*rr}
      makeAnimal(spk,x,z);
    }
  }
  if(!W.things.some(t=>!t.gone&&t.kind==='mural'))addThing('mural',-6,5,{});
  if(!W.things.some(t=>!t.gone&&t.kind==='quadro'))addThing('quadro',7,-5,{});
  ensureWaterThings();
  if(!W.crisis)W.crisis={nextDay:W.wolfFirst>0?W.wolfFirst:1e9,phase:'none',raidEnd:0,decisions:[],history:[]};
  if(W.crisis.phase!=='none'&&!W.wolves.length)W.crisis.phase='none';
  W.tribes=W.tribes.filter(tr=>Array.isArray(tr.members));
  W.tribeNid=Math.max(W.tribeNid||1,...W.tribes.map(t=>t.id+1),2);
  for(const tr of W.tribes){
    tr.center=tr.center||{x:0,z:0};tr.members=tr.members.filter(id=>W.animals.some(a=>a.id===id));
    tr.faith=tr.faith||{element:'floresta',name:'ka',gloss:'a mata que dá e toma',piety:.2,prayers:[]};
    tr.culture=tr.culture||{element:'floresta',style:0,label:'da floresta'};
    // tribos antigas ganham portão e números
    const stock=W.things.find(t=>!t.gone&&t.id===tr.stockadeId);
    if(!W.things.some(t=>!t.gone&&t.kind==='portao'&&t.data&&t.data.tribe===tr.id)){
      const ga=stock&&stock.data&&stock.data.gate!=null?stock.data.gate:0;
      const g=addThing('portao',tr.center.x+Math.cos(ga)*5.6,tr.center.z+Math.sin(ga)*5.6,{tribe:tr.id,gate:ga,open:0});
      tr.gateId=g.id;
    }
  }
  W.tribes=W.tribes.filter(tr=>tr.members.length>=2);
  for(const tr of W.tribes){
    if(!W.things.some(t=>!t.gone&&t.kind==='fogo'&&t.data&&t.data.tribe===tr.id)){
      const f=addThing('fogo',tr.center.x,tr.center.z,{tribe:tr.id,contained:true,fuel:1e9,hearth:true,t0:W.t});
      tr.hearthId=f.id;
    }
    // pedras do bronze: duas juntas, no alcance da fogueira
    const stones=W.things.filter(t=>!t.gone&&t.kind==='mineral'&&Math.hypot(t.x-tr.center.x,t.z-tr.center.z)<3.2);
    if(stones.length<2){
      addThing('mineral',tr.center.x+1.1,tr.center.z-.6,{});
      addThing('mineral',tr.center.x+1.55,tr.center.z+.45,{});
    }else if(Math.hypot(stones[0].x-stones[1].x,stones[0].z-stones[1].z)>1.85){
      stones[1].x=tr.center.x+1.55;stones[1].z=tr.center.z+.45;
    }
  }
  if(!(data.rosterV>=2)){
    const roster=(CFG&&CFG.species&&CFG.species.length?CFG.species:SPECIES_ORDER);
    for(const spk of roster){
      if(W.animals.some(a=>a.spk===spk))continue;
      const ang=rnd(0,TAU),rr=rnd(4,8);
      makeAnimal(spk,Math.cos(ang)*rr,Math.sin(ang)*rr);
    }
    // saves antigos ganham mais moradores (só uma vez: fica gravado)
    const target=Math.max(W.animals.length,(CFG&&CFG.animals)||30);
    let ci=0;
    while(W.animals.length<target&&ci<80){
      const spk=roster[(W.animals.length+ci)%roster.length];ci++;
      const ang=rnd(0,TAU),rr=rnd(8,22);
      makeAnimal(spk,Math.cos(ang)*rr,Math.sin(ang)*rr);
    }
  }
  if(migrated)seedExpansion();
  if(!(data.biomesV>=2)){const nb=ensureNewBiomes();W.migratedBiomes=nb}
  else W.migratedBiomes=null;
  teachBoards();
  let maxId=0;
  for(const t of W.things)maxId=Math.max(maxId,t.id);
  W.nid=Math.max(data.nid||1,maxId+1);
  return W;
}
function saveNow(quiet){
  if(!W||!saveReady)return false;
  try{
    localStorage.setItem(SAVE_KEY,JSON.stringify(serializeWorld()));
    const d=new Date();
    UI&&UI.saveInfo&&UI.saveInfo('salvo '+d.toLocaleTimeString('pt-BR'));
    return true;
  }catch(err){
    console.warn('save falhou',err);
    if(!quiet)UI&&UI.toast&&UI.toast('Não consegui salvar (armazenamento cheio?)');
    return false;
  }
}
function readSave(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return null;
    return JSON.parse(raw);
  }catch(err){console.warn('save ilegível',err);return null}
}
function saveDateStr(ts){
  const d=new Date(ts||Date.now());
  return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}

/* ---------------- lobby de novo mundo ---------------- */
const LOBBY_BIOMES=[[0,'floresta'],[2,'savana seca'],[4,'taiga'],[5,'pantanal'],[6,'pântano'],[8,'deserto'],[9,'cerrado']];
function showTutorialPrompt(){
  try{if(localStorage.getItem('florestaTutorial.v1'))return}catch(err){}
  const prompt=document.getElementById('tutorialPrompt');
  if(prompt)prompt.classList.remove('hide');
}
function initTutorial(){
  const prompt=document.getElementById('tutorialPrompt'),steps=document.getElementById('tutorialSteps');
  if(!prompt||!steps)return;
  const yes=document.getElementById('tutorialYes'),no=document.getElementById('tutorialNo');
  const close=document.getElementById('tutorialClose'),prev=document.getElementById('tutorialPrev'),next=document.getElementById('tutorialNext');
  const title=document.getElementById('tutorialTitle'),text=document.getElementById('tutorialText');
  const pages=[
    ['1 · escolha um bicho','Toque ou clique em um bicho para ver seus desejos e pensamentos.'],
    ['2 · controle a câmera','Arraste para girar. Use dois dedos para mover e afastar ou aproximar.'],
    ['3 · explore os painéis','Abra cultura, bichos, lobos e música pela barra superior.'],
  ];
  let page=0;
  const mark=()=>{try{localStorage.setItem('florestaTutorial.v1','chosen')}catch(err){}}
  const render=()=>{
    title.textContent=pages[page][0];text.textContent=pages[page][1];prev.disabled=page===0;
    next.textContent=page===pages.length-1?'entendi':'próximo';
    [...steps.querySelectorAll('.tutorialDots span')].forEach((dot,i)=>dot.classList.toggle('on',i===page));
  };
  yes.onclick=()=>{prompt.classList.add('hide');steps.classList.remove('hide');mark();page=0;render()};
  no.onclick=()=>{prompt.classList.add('hide');mark()};
  close.onclick=()=>{steps.classList.add('hide')};
  prev.onclick=()=>{if(page>0){page--;render()}};
  next.onclick=()=>{if(page<pages.length-1){page++;render()}else steps.classList.add('hide')};
}
function openLobby(els,mode){
  const $=s=>document.querySelector(s);
  const lobby=$('#lobby'),specWrap=$('#lobbySpecies'),biomeWrap=$('#lobbyBiomes'),sizeWrap=$('#lobbySize');
  const animalsIn=$('#lobbyAnimals'),animalsOut=$('#lobbyAnimalsOut'),wolfDays=$('#lobbyWolfDays'),wolfFirst=$('#lobbyWolfFirst');
  const arriveEvery=$('#lobbyArrive'),animalCapIn=$('#lobbyCap');
  const btnStart=$('#lobbyStart'),btnBack=$('#lobbyCancel');
  const state=Object.assign(defaultCfg(),CFG||{});
  if(!state.species||!state.species.length)state.species=SPECIES_ORDER.slice();
  lobby.classList.remove('hide');
  btnBack.classList.toggle('hide',mode==='first');
  btnStart.textContent=mode==='first'?'começar a floresta':'criar mundo novo (apaga o save)';

  animalsIn.value=state.animals||30;animalsOut.textContent=animalsIn.value;
  animalsIn.oninput=()=>{animalsOut.textContent=animalsIn.value};
  wolfDays.value=state.wolfDays!=null?state.wolfDays:10;
  wolfFirst.value=state.wolfFirst!=null?state.wolfFirst:10;
  if(arriveEvery)arriveEvery.value=state.arriveEvery!=null?state.arriveEvery:0;
  if(animalCapIn)animalCapIn.value=state.animalCap!=null?state.animalCap:80;

  sizeWrap.innerHTML='';
  for(const k in SIZES){
    const b=document.createElement('button');
    b.type='button';b.dataset.size=k;b.innerHTML=`${SIZES[k].label}<small>${SIZES[k].gn}×${SIZES[k].gn}</small>`;
    b.classList.toggle('on',k===state.size);
    b.onclick=()=>{sizeWrap.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))};
    sizeWrap.appendChild(b);
  }
  specWrap.innerHTML='';
  for(const spk of SPECIES_ORDER){
    const b=document.createElement('button');
    b.type='button';b.className='lchip';b.dataset.spk=spk;b.textContent=SP[spk].label;
    b.classList.toggle('on',state.species.includes(spk));
    if(SP[spk].dry)b.title='bicho do deserto';
    b.onclick=()=>{
      b.classList.toggle('on');
      if(!specWrap.querySelector('.lchip.on'))b.classList.add('on');
    };
    specWrap.appendChild(b);
  }
  biomeWrap.innerHTML='';
  for(const [id,label] of LOBBY_BIOMES){
    const b=document.createElement('button');
    b.type='button';b.className='lchip';b.dataset.biome=id;b.textContent=label;
    b.classList.toggle('on',(state.biomes||[]).includes(id));
    b.onclick=()=>{
      b.classList.toggle('on');
      if(!biomeWrap.querySelector('.lchip.on'))b.classList.add('on');
    };
    biomeWrap.appendChild(b);
  }

  btnStart.onclick=()=>{
    const sizeEl=sizeWrap.querySelector('button.on');
    const cfg={
      size:sizeEl?sizeEl.dataset.size:'medio',
      animals:clamp(+animalsIn.value||30,4,100),
      wolfDays:clamp(+wolfDays.value||0,0,90),
      wolfFirst:clamp(+wolfFirst.value||0,0,90),
      arriveEvery:arriveEvery?clamp(+arriveEvery.value||0,0,60):0,
      animalCap:animalCapIn?clamp(+animalCapIn.value||80,4,200):80,
      biomes:[...biomeWrap.querySelectorAll('.lchip.on')].map(b=>+b.dataset.biome),
      species:[...specWrap.querySelectorAll('.lchip.on')].map(b=>b.dataset.spk),
    };
    saveCfg(cfg);applyWorldConfig(cfg);state.size=cfg.size;
    lobby.classList.add('hide');
    if(mode==='first'){
    startRun(els,null);
    setTimeout(()=>showTutorialPrompt(),900);
    return;
  }
    W=newWorld((Math.random()*1e9)|0);
    V.bindWorld(W);UI.bindWorld(W);
    setTimeout(()=>showTutorialPrompt(),900);
    V.setFollow(false);
    const bf=document.getElementById('btnFollow');
    if(bf){bf.classList.remove('on');bf.textContent='seguir'}
    saveNow();
    UI.toast(`Mundo novo: mapa ${SIZES[cfg.size].label} (${GN}×${GN}), ${W.animals.length} bichos${cfg.wolfDays>0?', lobos a cada '+cfg.wolfDays+' dia(s)':', sem lobos'}.`);
  };
  btnBack.onclick=()=>{lobby.classList.add('hide')};
}

/* ---------------- boot ---------------- */
let uiT=0;
function boot(){
  const els={canvas:document.getElementById('world'),intro:document.getElementById('intro'),introMsg:document.getElementById('introMsg')};
  const saved=readSave();
  let cfg=loadCfg();
  if(saved){
    if(saved.cfg)cfg=Object.assign({},cfg||{},saved.cfg);
    else if(saved.gn)cfg=Object.assign({},cfg||{},{size:sizeForGN(saved.gn)});
    else cfg=Object.assign({},cfg||{},{size:'medio'});
  }
  if(cfg&&Array.isArray(cfg.species)){
    for(const spk of ['paca','tamandua','garca','jaguatirica'])if(SP[spk]&&!cfg.species.includes(spk))cfg.species.push(spk);
  }
  applyWorldConfig(cfg);
  if(!saved){
    if(els.intro)els.intro.style.display='none';
    openLobby(els,'first');return;
  }
  startRun(els,saved);
}
function startRun(els,saved){
  const canvas=els.canvas,intro=els.intro,introMsg=els.introMsg;
  let loaded=false;
  if(saved){
    try{W=deserializeWorld(saved);loaded=true}
    catch(err){console.warn('não consegui carregar o save:',err);W=null}
  }
  if(!W)W=newWorld((Math.random()*1e9)|0);

  V=initView(canvas);
  UI=initUI();
  V.bindWorld(W);
  UI.bindWorld(W);

  // restaura seleção / câmera / velocidade
  if(loaded&&saved.meta){
    const m=saved.meta;
    if(m.selected&&W.animals.some(a=>a.id===m.selected))UI.select(m.selected);
    if(m.follow&&V.setFollow){V.setFollow(true);document.getElementById('btnFollow').classList.add('on');document.getElementById('btnFollow').textContent='seguindo'}
    if(typeof m.speed==='number'&&m.speed>0){speed=m.speed;lastSpeed=speed}
    paused=!!m.paused;
    document.querySelectorAll('#speedBtns button').forEach(b=>b.classList.toggle('on',+b.dataset.sp===(paused?0:speed)));
  }


  UI.toast(loaded?('Save carregado. O mundo continuou de onde parou.'+(W.migratedBiomes&&(W.migratedBiomes.cactos||W.migratedBiomes.animals)?` O deserto apareceu: ${W.migratedBiomes.animals} bichos do deserto e ${W.migratedBiomes.cactos} cactos.`:'')):`${W.animals.length} bichos acordaram numa floresta enorme. Clique em um deles.`);
  UI.saveInfo(loaded?('save de '+saveDateStr(saved.ts)):'sem save ainda');
  saveReady=true;
  if(!loaded)saveNow(true);
  UI.clock();

  /* ------- controles ------- */
  const speedBtns=[...document.querySelectorAll('#speedBtns button')];
  function setSpeed(n){
    if(n===0){if(!paused){lastSpeed=speed||1}paused=true}
    else{paused=false;speed=n;lastSpeed=n}
    speedBtns.forEach(b=>b.classList.toggle('on',+b.dataset.sp===(paused?0:speed)));
  }
  speedBtns.forEach(b=>b.addEventListener('click',()=>setSpeed(+b.dataset.sp)));

  const btnFollow=document.getElementById('btnFollow');
  btnFollow.addEventListener('click',()=>{
    const on=!V.getFollow();
    V.setFollow(on);
    btnFollow.classList.toggle('on',on);
    btnFollow.textContent=on?'seguindo':'seguir';
    if(on&&UI.selectedId())V.selectAnimal(UI.selectedId());
  });

  document.getElementById('btnNew').addEventListener('click',()=>openLobby(els,'new'));

  document.getElementById('btnExport').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(serializeWorld())],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='floresta-save-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),3000);
    UI.toast('Save exportado.');
  });
  const fileIn=document.getElementById('fileIn');
  document.getElementById('btnImport').addEventListener('click',()=>fileIn.click());
  fileIn.addEventListener('change',()=>{
    const f=fileIn.files&&fileIn.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const data=JSON.parse(r.result);
        W=deserializeWorld(data);
        V.bindWorld(W);UI.bindWorld(W);
        V.setFollow(false);btnFollow.classList.remove('on');btnFollow.textContent='seguir';
        saveNow();UI.toast('Save importado: '+saveDateStr(data.ts));
      }catch(err){console.warn(err);UI.toast('Arquivo de save inválido.')
      }finally{fileIn.value=''}
    };
    r.readAsText(f);
  });

  addEventListener('keydown',e=>{
    if(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))return;
    if(e.code==='Space'){e.preventDefault();setSpeed(paused?lastSpeed||1:0)}
    else if(e.key==='f'||e.key==='F'){btnFollow.click()}
    else if(e.key==='1')setSpeed(1);
    else if(e.key==='2')setSpeed(2);
    else if(e.key==='3')setSpeed(4);
    else if(e.key==='4')setSpeed(8);
  });

  /* ------- autosave ------- */
  setInterval(()=>saveNow(true),15000);
  addEventListener('pagehide',()=>saveNow(true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow(true)});

  /* ------- loop ------- */
  let last=performance.now(),acc=0;
  function frame(now){
    const real=Math.min(.1,(now-last)/1000);last=now;
    if(!paused&&speed>0){
      acc+=real*speed;
      let guard=0;
      while(acc>=STEP&&guard<60){worldTick(STEP);acc-=STEP;guard++}
      if(guard>=60)acc=0;
    }
    V.tick(real);V.render();
    uiT+=real;
    if(uiT>=.28){uiT=0;UI.refresh();UI.clock()}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__floresta={get W(){return W},get V(){return V},get UI(){return UI},save:saveNow,serialize:serializeWorld,load:deserializeWorld,setSpeed};
}

initTutorial();
boot();
