'use strict';
/* ============================================================
   FLORESTA — HUD
   ============================================================ */

function initUI(){
  const $=s=>document.querySelector(s);
  const rosterList=$('#rosterList');
  const dName=$('#dName'),dSub=$('#dSub');
  const wishEl=$('#wish'),thoughtsEl=$('#thoughts'),lexEl=$('#lex'),handsEl=$('#hands');
  const ideasEl=$('#ideas'),memEl=$('#mem'),inventEl=$('#invent');
  const feelEl=$('#feel'),wantsEl=$('#wants');
  const langsEl=$('#langs'),webEl=$('#web'),webInfoEl=$('#webInfo');
  const toolsEl=$('#tools'),tribeBoxEl=$('#tribeBox'),relationshipsEl=$('#relationships'),actionsEl=$('#actions');
  const gearBoxEl=$('#gearBox'),musicBoxEl=$('#musicBox'),mindBoxEl=$('#mindBox'),ruinsBoxEl=$('#ruinsBox');
  const musicBar=$('#musicBar'),musicNowEl=$('#musicNow');
  const persEl=$('#pers'),persDreamEl=$('#persDream');
  const tickerEl=$('#ticker'),evListEl=$('#evList'),toastEl=$('#toast');
  const dayLabel=$('#dayLabel'),clockLabel=$('#clockLabel'),weatherLabel=$('#weatherLabel'),crisisLabel=$('#crisisLabel');
  const saveInfo=$('#saveInfo');
  const codex=$('#codex'),galleryCanvas=$('#galleryCanvas'),boardMeta=$('#boardMeta');
  const computerWindow=$('#computerWindow');
  const journeyList=$('#journeyList');
  const suggestionForm=$('#suggestionForm'),suggestionStatus=$('#suggestionStatus');

  let selectedId=null;
  let cardEls=new Map();
  let bound=false;
  let toastTimer=null;
  let webTopic=null;
  let activeBoard='mural';
  let codexOpen=false;
  let computerOpen=false,computerApp='search';
  const uiPanels=JSON.parse(localStorage.getItem('florestaPanels.v1')||'{}');
  const COLORS=['#eaf2e8','#f2cf75','#eb9384','#a8d8b0','#a9cbee','#d9b8f5'];

  const STATE_LABEL={idle:'pensando',move:'andando',do:'fazendo',sleep:'dormindo',talk:'conversando',stay:'descansando',faint:'desmaiado'};

  function animal(){return W?W.animals.find(a=>a.id===selectedId):null}
  function fmtTime(t){
    const h=((t/W.dayLen)*24)%24,hh=Math.floor(h),mm=Math.floor((h-hh)*60);
    return String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
  }
  function statusOf(a){
    if(a.faint>0)return 'desmaiado';
    if(a.fleeing)return 'fugindo';
    const st=STATE_LABEL[a.state]||a.state;
    const step=a.plan&&a.plan.steps[a.plan.i];
    if(a.state==='do'&&step){
      if(step.verb==='combinar')return 'experimentando';
      if(step.verb==='largar')return step.cook?'esquentando comida':'largando';
      return VERB_ING[step.verb]||st;
    }
    return st;
  }
  function esc(s){return String(s)}
  function htmlEscape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function who(id){const a=W&&W.animals.find(x=>x.id===id);return a?(a.name||a.sp.label.toLowerCase()):'alguém'}

  /* ---------- painéis ---------- */
  const PANELS={roster:'lista de bichos',detail:'detalhe do bicho',ticker:'eventos'};
  function applyPanels(){
    for(const p in PANELS)document.body.classList.toggle('no-'+p,uiPanels[p]===false);
    document.querySelectorAll('#hudMenu input[data-panel]').forEach(i=>{i.checked=uiPanels[i.dataset.panel]!==false});
  }
  function setPanel(p,on){
    uiPanels[p]=!!on;
    localStorage.setItem('florestaPanels.v1',JSON.stringify(uiPanels));
    applyPanels();
  }
  document.querySelectorAll('.panelClose').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.panel,false)));
  document.querySelectorAll('#hudMenu input[data-panel]').forEach(inp=>{
    inp.addEventListener('change',()=>setPanel(inp.dataset.panel,inp.checked));
  });
  const hudMenu=$('#hudMenu');
  const btnHud=$('#btnHud');
  if(btnHud)btnHud.addEventListener('click',()=>hudMenu.classList.toggle('hide'));
  document.addEventListener('pointerdown',e=>{
    if(!hudMenu.classList.contains('hide')&&!hudMenu.contains(e.target)&&e.target!==btnHud)hudMenu.classList.add('hide');
  },true);
  applyPanels();

  /* ---------- cultura ---------- */
  const TOOL_KEYS=['machado','picareta','curativo','roupa','armadura','lanca','bronze'];
  const BUILD_KEYS=['fogo','toca','abrigo','cabana','torre','marco','celeiro','represa','ponte'];
  function openCodex(tab){
    codex.classList.remove('hide');
    codexOpen=true;
    hudMenu.classList.add('hide');
    setTab(tab||'boards');
  }
  function openGallery(kind){
    activeBoard=kind==='quadro'?'quadro':'mural';
    codex.querySelectorAll('.boardPick button').forEach(x=>x.classList.toggle('on',x.dataset.board===activeBoard));
    openCodex('boards');
  }
  function closeCodex(){codex.classList.add('hide');codexOpen=false}
  function openComputer(){
    computerWindow.classList.remove('hide');
    computerOpen=true;
    setComputerApp(computerApp);
  }
  function closeComputer(){computerWindow.classList.add('hide');computerOpen=false}
  function setComputerApp(app){
    if(!['search','audio','gallery'].includes(app))return;
    computerApp=app;
    computerWindow.querySelectorAll('[data-computer-app]').forEach(button=>button.classList.toggle('on',button.dataset.computerApp===app));
    computerWindow.querySelectorAll('[data-computer-page]').forEach(page=>page.classList.toggle('hide',page.dataset.computerPage!==app));
    renderComputer(app);
  }
  function setTab(tab){
    codex.querySelectorAll('#codexTabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
    codex.querySelectorAll('.tabPane').forEach(p=>p.classList.toggle('hide',p.dataset.pane!==tab));
    renderCodex(tab);
  }
  function drawBoard(kind){
    const c=galleryCanvas,x=c.getContext('2d'),CW=c.width,CH=c.height;
    x.fillStyle='#26302a';x.fillRect(0,0,CW,CH);
    x.strokeStyle='#1b231e';x.lineWidth=10;x.strokeRect(6,6,CW-12,CH-12);
    const ms=(W&&W[kind]&&W[kind].marks)||[];
    for(const m of ms){
      const col=COLORS[(m.col||0)%COLORS.length];
      x.strokeStyle=col;x.fillStyle=col;
      if(m.type==='shape'&&m.strokes){
        x.lineWidth=(m.w||4)*1.4;x.lineCap='round';x.lineJoin='round';
        for(const pts of m.strokes){x.beginPath();pts.forEach(([u,v],i)=>{if(i)x.lineTo(u*CW,v*CH);else x.moveTo(u*CW,v*CH)});x.stroke()}
      }else if(m.type==='word'&&m.txt){
        x.save();x.translate((m.x||.5)*CW,(m.y||.5)*CH);x.rotate(m.rot||0);
        x.font='italic 700 '+((m.size||28)*1.5)+'px "Segoe UI", sans-serif';
        x.textAlign='center';x.textBaseline='middle';
        x.globalAlpha=.92;x.fillText(m.txt,0,0);x.restore();x.globalAlpha=1;
      }
    }
    const last=ms[ms.length-1];
    boardMeta.textContent=ms.length?`${ms.length} marca(s) · última de ${who(last.by)} às ${fmtTime(last.t||0)}`:'ainda em branco.';
  }
  function renderWritings(){
    const list=$('#writingsList');
    const rows=[];
    for(const kind of ['mural','quadro']){
      for(const m of (W[kind]&&W[kind].marks)||[]){
        if(m.type!=='word'&&m.type!=='shape')continue;
        rows.push({kind,m});
      }
    }
    rows.sort((p,q)=>(q.m.t||0)-(p.m.t||0));
    if(!rows.length){list.innerHTML='<span class="empty">ninguém escreveu nem desenhou nada ainda.</span>';return}
    list.innerHTML=rows.slice(0,40).map(({kind,m})=>{
      const col=COLORS[(m.col||0)%COLORS.length];
      let body;
      if(m.type==='word')body=`<div class="wbody"><span class="wword" style="color:${col}">${htmlEscape(m.txt||'')}</span></div>`;
      else if(m.meaning){
        const paths=(m.strokes||[]).map(points=>{
          const valid=(points||[]).filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
          if(!valid.length)return '';
          const coords=valid.map(p=>`${Math.max(0,Math.min(1,p[0]))*100},${Math.max(0,Math.min(1,p[1]))*100}`).join(' ');
          return `<polyline points="${coords}" fill="none" stroke="${col}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
        }).join('');
        const label=htmlEscape(m.meaning);
        body=`<div class="wbody"><svg class="wglyph" viewBox="0 0 100 100" role="img" aria-label="${label}">${paths}</svg><div class="wtranslation"><b>Tradução:</b> ${label}</div></div>`;
      }else body='<div class="wbody wtag">desenho livre, sem tradução registrada.</div>';
      return `<div class="wcard"><div class="whead"><span>${m.type==='word'?'palavra':'símbolos'} · ${kind}</span><span class="wtag">${who(m.by)} · dia ${Math.floor((m.t||0)/W.dayLen)+1}</span></div>${body}</div>`;
    }).join('');
  }
  function renderTribes(){
    const list=$('#tribesList');
    if(!W.tribes.length){list.innerHTML='<span class="empty">ainda não nasceu tribo nenhuma. Eles precisam se entender e ficar perto.</span>';return}
    list.innerHTML=W.tribes.map(tr=>{
      const mem=tr.members.map(id=>W.animals.find(a=>a.id===id)).filter(Boolean);
      const names=mem.map(a=>a.name||a.sp.label.toLowerCase());
      const cult=CULTURES[tr.culture&&tr.culture.element]||{};
      const houses=W.things.filter(t=>!t.gone&&t.data&&t.data.tribe===tr.id&&t.data.house).length;
      const reefs=W.things.filter(t=>!t.gone&&t.kind==='coral'&&t.data&&t.data.tribe===tr.id).length;
      const gate=W.things.find(t=>!t.gone&&t.kind==='portao'&&t.data&&t.data.tribe===tr.id);
      const nums=tr.numerals?`números: ${tr.numerals.map((w,i)=>`${i+1} ${w}`).join(' · ')}`:'ainda não contam';
      const settlement=tr.aquatic?`${reefs} corais · colônia submersa`:`${houses} casa(s) · cercado em ${Math.round(tr.center.x)}, ${Math.round(tr.center.z)}`;
      const gateInfo=tr.aquatic?'habitat: recife':`portão: ${gate?(gate.data.open>.5?'aberto':'trancado'):'—'}`;
      const stores=tr.stores||{food:0,wood:0,stone:0};
      const resources=`reservas: comida ${stores.food.toFixed(1)} · madeira ${stores.wood.toFixed(1)} · minerais ${stores.stone.toFixed(1)}`;
      const sites=tr.sites||{};
      const sitesLine=['food','wood','stone'].map((key,i)=>{
        const site=sites[key];return site?`${['alimento','madeira','minerais'][i]} (${Math.round(site.x)}, ${Math.round(site.z)})`:null;
      }).filter(Boolean).join(' · ');
      const statusText={friendly:'amizade e comércio',enemy:'inimizade',neutral:'sem acordo'};
      const diplomacy=(W.diplomacy||[]).filter(r=>r.a===tr.id||r.b===tr.id).map(r=>{
        const other=W.tribes.find(x=>x.id===(r.a===tr.id?r.b:r.a));
        return other?`${other.name}: ${statusText[r.status]||r.status}`:null;
      }).filter(Boolean).join(' · ');
      return `<div class="wcard tribeCard"><div class="tname">${tr.name}</div>
        <div class="tline">cultura ${tr.culture.label||cult.label||'?'} · ${mem.length} membro(s) · ${settlement}</div>
        <div class="tline">${gateInfo} · ${nums}</div>
        <div class="tline">${resources}</div>
        ${sitesLine?`<div class="tline">pontos ricos: ${sitesLine}</div>`:''}
        ${diplomacy?`<div class="tline">relações: ${diplomacy}</div>`:''}
        ${tr.soundChanges?`<div class="tline">Lei de Grimm: ${tr.soundChanges} mudança(s) sonora(s)</div>`:''}
        ${tr.inscription?`<div class="tline">inscrição da ruína: “${tr.inscription}”</div>`:''}
        <div class="tline">falam: ${(tr.lang||[]).slice(0,6).join(' · ')||'—'}</div>
        <div class="tline">${names.join(' · ')}</div>
        <div class="fait">fé: ${tr.faith.name} (${tr.faith.gloss}) · devoção ${(tr.faith.piety*100).toFixed(0)}%</div></div>`;
    }).join('');
  }
  const CRISIS_LABEL={luta:'⚔️ lutaram',acordo:'🤝 negociaram',sacrificio:'🕯️ sacrificaram',fuga:'🏃 fugiram'};
  function renderFaith(){
    const list=$('#faithList');
    if(!W.tribes.length){list.innerHTML='<span class="empty">sem tribo, cada bicho inventa seus próprios espíritos.</span>';return}
    const hist=(W.crisis&&W.crisis.history||[]).slice(-4).reverse().map(h=>{
      const ds=(h.decisions||[]).map(d=>{
        const tr=W.tribes.find(t=>t.id===d.tribe);
        return `${tr?tr.name:'tribo '+d.tribe}: ${CRISIS_LABEL[d.type]||d.type}`;
      }).join(' · ');
      return `<div class="wbody">dia ${h.day} — ${ds||'nada'}${h.stolen?` · levaram ${h.stolen}`:''}</div>`;
    }).join('');
    list.innerHTML=W.tribes.map(tr=>{
      const pr=(tr.faith.prayers||[]).map(p=>`<span class="lw">${p.word}</span>`).join(' ');
      const faithCulture=tr.aquatic?'do recife':CULTURES[tr.faith.element]?CULTURES[tr.faith.element].label:tr.faith.element;
      return `<div class="wcard tribeCard"><div class="whead"><span class="tname">${tr.name}</span><span class="wtag">${faithCulture}</span></div>
        <div class="wbody">Adoram <b>${tr.faith.name}</b> — ${tr.faith.gloss}.</div>
        <div class="wbody">devoção: ${(tr.faith.piety*100).toFixed(0)}%</div>
        <div class="wbody"><span class="lwords">${pr||'<span class="empty">sem rezas ainda</span>'}</span></div></div>`;
    }).join('');
    if(hist)list.innerHTML+=`<div class="wcard"><div class="whead">últimos ataques dos lobos</div>${hist}</div>`;
  }
  function renderStudies(){
    const list=$('#studiesList');
    if(!W){list.innerHTML='';return}
    const catalog=RESEARCH.map(([t,d])=>`<div class="studyRow"><span class="sname">${t}</span> <span class="dimtxt">— ${d}</span></div>`).join('');
    const rows=W.animals.map(a=>{
      const ks=Object.keys(a.knowledge||{});
      const tools=TOOL_KEYS.filter(k=>a.recipes&&a.recipes[k]);
      const builds=BUILD_KEYS.filter(k=>a.recipes&&a.recipes[k]);
      const history=Array.isArray(a.researchLog)?a.researchLog.slice().reverse():[];
      const wiki=Array.isArray(a.wikipedia)?a.wikipedia.slice().reverse():[];
      if(!ks.length&&!tools.length&&!builds.length&&!history.length&&!wiki.length)return '';
      return `<div class="studyRow"><div class="sname">${a.name||a.sp.label.toLowerCase()} <span class="dimtxt">(${a.sp.label})</span></div>
        <div class="stopics">${ks.map(k=>`<span class="chip kc" title="${esc((RESEARCH.find(r=>r[0]===k)||[])[1]||'')}">${k}</span>`).join('')||'<span class="empty">nada na internet</span>'}</div>
        ${tools.length?`<div class="stool">ferramentas: ${tools.map(k=>'<span class="toolchip hand">'+(K[k]?K[k].g:k)+'</span>').join(' ')}</div>`:''}
        ${builds.length?`<div class="stool">construções: ${builds.map(k=>'<span class="toolchip">'+(K[k]?K[k].g:k)+'</span>').join(' ')}</div>`:''}
        ${history.length?`<div class="researchHistory"><b>histórico de pesquisas</b>${history.map(item=>{
          const day=Math.floor((item.t||0)/(W.dayLen||240))+1;
          const topic=String(item.topic||'assunto desconhecido').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
          const place=String(item.place||'outro lugar').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
          return `<div class="researchEntry"><span>dia ${day} · ${place}</span><b>${topic}</b></div>`;
        }).join('')}</div>`:''}
        ${wiki.length?`<div class="researchHistory"><b>resumos da Wikipédia</b>${wiki.map(item=>
          `<div class="researchEntry"><span>${Math.floor((item.t||0)/(W.dayLen||240))+1} · ${htmlEscape(item.topic)}</span>${
            item.error?`<b>${htmlEscape(item.error)}</b>`:`<b>${htmlEscape(item.title)}</b><span>${htmlEscape(item.extract)}</span><a href="${htmlEscape(item.url)}" target="_blank" rel="noopener noreferrer">fonte</a>`
          }</div>`).join('')}</div>`:''}
      </div>`;
    }).filter(Boolean).join('');
    list.innerHTML=`<div class="wcard"><div class="whead">o que se pode descobrir na internet</div><div class="wbody" style="max-height:200px;overflow:auto">${catalog}</div></div>`+
      (rows||'<span class="empty">ninguém pesquisou nada ainda.</span>');
  }
  const COMPUTER_ART={
    agua:{sky:'#173b50',ground:'#285d6e',accent:'#8fe3d2',detail:'#d2f3e8'},
    ceu:{sky:'#26304f',ground:'#45416c',accent:'#f2cf75',detail:'#d9e3ff'},
    planta:{sky:'#b6d4ad',ground:'#385d3c',accent:'#92be62',detail:'#e5d58c'},
    fogo:{sky:'#4c3241',ground:'#593c37',accent:'#ffad58',detail:'#ffe1a0'},
    amigo:{sky:'#86b8b0',ground:'#40664e',accent:'#f2cf75',detail:'#f5d6c3'},
    comida:{sky:'#9bc3b2',ground:'#526e42',accent:'#ef9d59',detail:'#f4d57c'},
    ferramenta:{sky:'#9bb2b4',ground:'#55645b',accent:'#e5c27b',detail:'#e7ece0'},
    trilha:{sky:'#a7c7d7',ground:'#53674f',accent:'#f0cd83',detail:'#e0edd1'},
    abstrato:{sky:'#554b75',ground:'#3e6480',accent:'#f2a4b7',detail:'#f2cf75'}
  };
  function computerWikimediaUrl(value,hosts){
    try{
      const url=new URL(value);
      return url.protocol==='https:'&&hosts.includes(url.hostname)?url.href:'';
    }catch(error){
      return '';
    }
  }
  function computerImageMarkup(item){
    if(item.status==='loading')return '<div class="pcImageStatus">Buscando uma imagem na Wikimedia Commons…</div>';
    if(item.status==='error')return `<div class="pcImageStatus pcImageError">${htmlEscape(item.error||'A imagem não pôde ser carregada.')}</div>`;
    if(item.imageUrl){
      const imageUrl=computerWikimediaUrl(item.imageUrl,['thumb.wikimedia.org','upload.wikimedia.org']);
      const sourceUrl=computerWikimediaUrl(item.sourceUrl,['commons.wikimedia.org']);
      if(imageUrl&&sourceUrl){
        return `<a class="pcPhotoLink" href="${htmlEscape(sourceUrl)}" target="_blank" rel="noopener noreferrer"><img class="pcPhoto" data-computer-image="${Number(item.id)}" src="${htmlEscape(imageUrl)}" alt="${htmlEscape(item.title)}" loading="lazy"></a>`;
      }
      return '<div class="pcImageStatus pcImageError">A origem desta imagem não pôde ser validada.</div>';
    }
    return computerPicture(item);
  }
  function computerPicture(item){
    const art=COMPUTER_ART[item.theme]||COMPUTER_ART.abstrato;
    const shift=(item.seed||0)%24;
    let motif;
    if(item.theme==='agua')motif='<path d="M0 64 Q18 53 36 64 T72 64 T108 64 T144 64 T180 64 T216 64 T256 64 V112 H0Z" fill="'+art.accent+'"/><path d="M0 79 Q18 68 36 79 T72 79 T108 79 T144 79 T180 79 T216 79 T256 79" fill="none" stroke="'+art.detail+'" stroke-width="3"/>';
    else if(item.theme==='ceu')motif='<circle cx="'+(56+shift)+'" cy="33" r="15" fill="'+art.accent+'"/><path d="M0 92 L62 48 L112 87 L165 42 L256 96 V112 H0Z" fill="'+art.detail+'"/>';
    else if(item.theme==='planta')motif='<path d="M128 108V37 M128 68Q78 69 70 35Q111 34 128 68 M128 54Q150 20 191 27Q181 61 128 54" fill="none" stroke="'+art.accent+'" stroke-width="7" stroke-linecap="round"/><circle cx="128" cy="31" r="9" fill="'+art.detail+'"/>';
    else if(item.theme==='fogo')motif='<path d="M128 103Q84 86 104 56Q116 43 114 26Q144 44 143 65Q162 52 159 38Q194 74 164 98Q147 109 128 103Z" fill="'+art.accent+'"/><path d="M128 94Q111 77 131 59Q150 78 143 94Z" fill="'+art.detail+'"/>';
    else if(item.theme==='amigo')motif='<circle cx="96" cy="53" r="19" fill="'+art.accent+'"/><circle cx="160" cy="53" r="19" fill="'+art.detail+'"/><path d="M67 103Q69 74 96 74Q123 74 125 103 M131 103Q133 74 160 74Q187 74 189 103" fill="none" stroke="#f4eee0" stroke-width="8" stroke-linecap="round"/>';
    else if(item.theme==='comida')motif='<path d="M128 96Q79 67 104 38Q126 17 151 38Q178 70 128 96Z" fill="'+art.accent+'"/><path d="M128 40Q130 24 147 20" fill="none" stroke="'+art.detail+'" stroke-width="6" stroke-linecap="round"/><circle cx="111" cy="59" r="3" fill="#fff"/>';
    else if(item.theme==='ferramenta')motif='<path d="M88 89L156 30" stroke="'+art.detail+'" stroke-width="12" stroke-linecap="round"/><path d="M139 24L172 18L183 41L161 55Z" fill="'+art.accent+'"/>';
    else motif='<path d="M0 100L58 52L91 79L151 31L256 98V112H0Z" fill="'+art.detail+'"/><circle cx="'+(52+shift)+'" cy="36" r="11" fill="'+art.accent+'"/>';
    return `<svg class="pcArt" viewBox="0 0 256 112" role="img" aria-label="${htmlEscape(item.title)}"><rect width="256" height="112" fill="${art.sky}"/><path d="M0 90Q62 76 126 88T256 83V112H0Z" fill="${art.ground}"/>${motif}</svg>`;
  }
  function renderComputer(app){
    if(!computerOpen||!W)return;
    app=app||computerApp;
    const library=W.computer||{audios:[],images:[],imageSearches:[],clipboard:null};
    if(app==='search'){
      const searches=W.animals.flatMap(a=>(a.researchLog||[]).map(item=>({animal:a,item})))
        .sort((a,b)=>(b.item.t||0)-(a.item.t||0)).slice(0,60);
      const list=$('#computerSearches');
      const historyMarkup=searches.map(({animal:a,item})=>{
        const topic=String(item.topic||'assunto desconhecido'),safeTopic=htmlEscape(topic);
        const wiki=(a.wikipedia||[]).slice().reverse().find(result=>result.topic===topic);
        const fact=RESEARCH.find(row=>row[0]===topic);
        const summary=wiki?(wiki.error?`A Wikipédia não respondeu: ${wiki.error}`:wiki.extract):fact?fact[1]:'A busca foi registrada; o bicho ainda está pensando no que encontrou.';
        const day=Math.floor((item.t||0)/(W.dayLen||240))+1;
        const excerpt=summary.length>280?summary.slice(0,277)+'…':summary;
        return `<article class="pcResult"><div class="pcResultTop"><span>Pesquisa de ${htmlEscape(a.name||a.sp.label)}</span><span>dia ${day}</span></div><b>${safeTopic}</b><p>${htmlEscape(excerpt)}</p></article>`;
      }).join('');
      const imageSearches=(library.imageSearches||[]).slice().reverse().slice(0,18);
      const imageMarkup=imageSearches.map(search=>{
        const results=Array.isArray(search.results)?search.results:[];
        let content='';
        if(search.status==='loading')content='<div class="pcImageStatus">O bicho está pesquisando imagens na Wikimedia Commons…</div>';
        else if(search.status==='error')content=`<div class="pcImageStatus pcImageError">${htmlEscape(search.error||'A pesquisa de imagens falhou.')}</div>`;
        else if(!results.length)content='<div class="pcImageStatus">Nenhuma imagem adequada foi encontrada.</div>';
        else content=`<div class="pcImageResults">${results.map((result,index)=>{
          const imageUrl=computerWikimediaUrl(result.imageUrl,['thumb.wikimedia.org','upload.wikimedia.org']);
          const sourceUrl=computerWikimediaUrl(result.sourceUrl,['commons.wikimedia.org']);
          const licenseUrl=computerWikimediaUrl(result.licenseUrl,['creativecommons.org','www.gnu.org','www.fsf.org']);
          const already=(library.images||[]).some(image=>image.sourceUrl===result.sourceUrl);
          const valid=!!imageUrl&&!!sourceUrl;
          const image=imageUrl&&sourceUrl
            ?`<a href="${htmlEscape(sourceUrl)}" target="_blank" rel="noopener noreferrer"><img class="pcImageThumb" src="${htmlEscape(imageUrl)}" alt="${htmlEscape(result.title)}" loading="lazy"></a>`
            :'<div class="pcImageStatus pcImageError">A origem desta imagem não pôde ser validada.</div>';
          const license=licenseUrl?`<a href="${htmlEscape(licenseUrl)}" target="_blank" rel="noopener noreferrer">${htmlEscape(result.license||'licença')}</a>`:htmlEscape(result.license||'licença não informada');
          return `<article class="pcImageHit">${image}<b>${htmlEscape(result.title)}</b><span>Autor: ${htmlEscape(result.author||'não informado')} · ${license}</span><button data-computer-copy-image="${Number(search.id)}:${index}" ${already||!valid?'disabled':''}>${already?'na galeria':valid?'copiar':'indisponível'}</button></article>`;
        }).join('')}</div>`;
        return `<section class="pcImageSearch"><div class="pcImageSearchHead"><span>Google Imagens · ${htmlEscape(search.byName||'pesquisa dos bichos')}</span><b>${htmlEscape(search.topic||'imagens')}</b><small>dia ${Number(search.day)||0} · resultados da Wikimedia Commons</small></div>${content}</section>`;
      }).join('');
      list.innerHTML=(historyMarkup||(!imageMarkup?'<div class="pcEmpty">Os bichos ainda não pesquisaram. As buscas e imagens aparecerão aqui.</div>':''))+imageMarkup;
      const pasteButton=$('#computerPasteImage');
      if(pasteButton)pasteButton.disabled=!library.clipboard;
      list.querySelectorAll('[data-computer-copy-image]').forEach(button=>button.addEventListener('click',()=>{
        const [searchId,index]=button.dataset.computerCopyImage.split(':').map(Number);
        const search=(library.imageSearches||[]).find(item=>item.id===searchId);
        const result=search&&Array.isArray(search.results)?search.results[index]:null;
        if(!result){toast('Esse resultado não está mais disponível.');return}
        library.clipboard={...result,topic:search.topic,by:search.by,byName:search.byName,day:search.day,t:search.t};
        toast('Imagem copiada. Clique em “Colar na galeria” para guardar o link.');
        renderComputer('search');
      }));
    }else if(app==='audio'){
      const audios=(library.audios||[]).slice().reverse(),list=$('#computerAudios');
      $('#computerAudioCount').textContent=String(audios.length);
      if(!audios.length){list.innerHTML='<div class="pcEmpty">A biblioteca está vazia. Os bichos podem encontrar e guardar áudios enquanto pesquisam.</div>';return}
      list.innerHTML=audios.map(item=>`<article class="pcAudio"><span class="pcAudioIcon">♫</span><div class="pcAudioInfo"><b>${htmlEscape(item.title)}</b><span>${htmlEscape(item.topic)} · ${htmlEscape(item.byName)} · dia ${Number(item.day)||0}</span></div><button data-computer-audio="${Number(item.id)}">ouvir</button></article>`).join('');
      list.querySelectorAll('[data-computer-audio]').forEach(button=>button.addEventListener('click',()=>{
        const item=(library.audios||[]).find(audio=>audio.id===Number(button.dataset.computerAudio));
        if(item)playComputerAudio(item);
      }));
    }else if(app==='gallery'){
      const images=(library.images||[]).slice().reverse(),list=$('#computerGallery');
      $('#computerImageCount').textContent=String(images.length);
      if(!images.length){list.innerHTML='<div class="pcEmpty">A galeria está vazia. Quando pesquisarem, os bichos podem buscar imagens na Wikimedia Commons.</div>';return}
      list.innerHTML=images.map(item=>{
        const sourceUrl=computerWikimediaUrl(item.sourceUrl,['commons.wikimedia.org']);
        const licenseUrl=computerWikimediaUrl(item.licenseUrl,['creativecommons.org','www.gnu.org','www.fsf.org']);
        return `<article class="pcImage">${computerImageMarkup(item)}<b>${htmlEscape(item.title)}</b><div class="pcImageMeta"><span>${htmlEscape(item.topic)} · pesquisa de ${htmlEscape(item.byName)} · dia ${Number(item.day)||0}</span>${sourceUrl&&item.status==='ready'?`<span>Autor: ${htmlEscape(item.author||'Autor não informado')} · licença: ${licenseUrl?`<a href="${htmlEscape(licenseUrl)}" target="_blank" rel="noopener noreferrer">${htmlEscape(item.license||'detalhes')}</a>`:htmlEscape(item.license||'não informada')} · <a href="${htmlEscape(sourceUrl)}" target="_blank" rel="noopener noreferrer">ver origem</a></span>`:''}</div></article>`;
      }).join('');
      list.querySelectorAll('[data-computer-image]').forEach(img=>img.addEventListener('error',()=>{
        const item=images.find(image=>image.id===Number(img.dataset.computerImage));
        if(!item)return;
        item.status='error';
        item.error='A imagem não carregou da Wikimedia Commons. O bicho pode tentar pesquisar esse assunto novamente.';
        renderComputer('gallery');
      }));
    }
  }
  function renderJourney(){
    if(!journeyList)return;
    const campaign=W.campaign||{completed:[],era:0,stories:[]};
    journeyList.replaceChildren();
    const hero=document.createElement('section');hero.className='journeyHero';
    const era=campaignEra(campaign);
    const eraTitle=document.createElement('b');eraTitle.textContent=`Era atual · ${era.name}`;
    const eraDesc=document.createElement('p');eraDesc.textContent=era.desc;
    hero.append(eraTitle,eraDesc);journeyList.appendChild(hero);
    const heading=document.createElement('h3');heading.className='journeyHeading';heading.textContent='Objetivos da floresta';
    journeyList.appendChild(heading);
    CAMPAIGN_GOALS.forEach((goal,index)=>{
      const done=campaign.completed.includes(goal.id),active=index===campaign.completed.length;
      const progress=done?goal.target:active?campaignProgress(goal):0;
      const card=document.createElement('article');card.className=`journeyGoal${done?' done':''}${active?' active':''}`;
      const top=document.createElement('div');top.className='journeyGoalTop';
      const title=document.createElement('b');title.textContent=goal.title;
      const status=document.createElement('span');status.textContent=done?'concluído':active?'em andamento':'bloqueado';
      top.append(title,status);card.appendChild(top);
      const hint=document.createElement('p');hint.textContent=goal.hint;card.appendChild(hint);
      const bar=document.createElement('div');bar.className='journeyBar';
      const fill=document.createElement('i');fill.style.width=`${Math.round(progress/goal.target*100)}%`;
      bar.appendChild(fill);card.appendChild(bar);
      const count=document.createElement('small');count.textContent=`${progress} / ${goal.target}`;card.appendChild(count);
      journeyList.appendChild(card);
    });
    const storyHeading=document.createElement('h3');storyHeading.className='journeyHeading';storyHeading.textContent='Histórias recentes';
    journeyList.appendChild(storyHeading);
    const stories=document.createElement('div');stories.className='journeyStories';
    const recent=(campaign.stories||[]).slice().reverse();
    if(!recent.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='As histórias vão aparecer conforme o mundo muda.';stories.appendChild(empty)}
    for(const story of recent){
      const row=document.createElement('article');row.className='journeyStory';
      const title=document.createElement('b');title.textContent=`${story.icon||'🍃'} Dia ${story.day||1} · ${story.title||'Uma história'}`;
      const text=document.createElement('p');text.textContent=story.text||'';
      row.append(title,text);stories.appendChild(row);
    }
    journeyList.appendChild(stories);
  }
  function renderCodex(tab){
    if(!codexOpen||!W)return;
    tab=tab||codex.querySelector('#codexTabs button.on').dataset.tab;
    if(tab==='boards')drawBoard(activeBoard);
    else if(tab==='writings')renderWritings();
    else if(tab==='tribes')renderTribes();
    else if(tab==='faith')renderFaith();
    else if(tab==='studies')renderStudies();
    else if(tab==='langs')renderLangsFull();
    else if(tab==='ruins')renderRuins();
    else if(tab==='minds')renderMinds();
    else if(tab==='music')renderMusicList();
    else if(tab==='wolves')renderWolves();
    else if(tab==='critters')renderCritters();
    else if(tab==='journey')renderJourney();
  }
  codex.querySelectorAll('#codexTabs button').forEach(b=>b.addEventListener('click',()=>{
    setTab(b.dataset.tab);
    const more=codex.querySelector('.codexMore');
    if(more)more.open=false;
  }));
  suggestionForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const submit=suggestionForm.querySelector('button[type="submit"]');
    const fields={};
    new FormData(suggestionForm).forEach((value,key)=>{fields[key]=value});
    submit.disabled=true;
    suggestionStatus.textContent='Enviando…';
    try{
      const response=await fetch(suggestionForm.action,{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify(fields),
      });
      let result;
      try{result=await response.json()}
      catch(err){console.error('Resposta inválida do serviço de sugestões',err);throw new Error('O serviço retornou uma resposta inválida.')}
      if(!response.ok||!result||(result.success!==true&&result.success!=='true')){
        throw new Error(result&&result.message||`Falha no envio (HTTP ${response.status}).`);
      }
      suggestionForm.reset();
      suggestionStatus.textContent='Sugestão enviada. Obrigado por ajudar a floresta!';
    }catch(err){
      console.error('Não foi possível enviar a sugestão',err);
      suggestionStatus.textContent=err instanceof TypeError
        ?'Não consegui conectar ao serviço. Verifique a conexão e tente novamente.'
        :`Não foi possível enviar: ${err.message}`;
    }finally{
      submit.disabled=false;
    }
  });
  codex.querySelectorAll('.boardPick button').forEach(b=>b.addEventListener('click',()=>{
    activeBoard=b.dataset.board;
    codex.querySelectorAll('.boardPick button').forEach(x=>x.classList.toggle('on',x===b));
    drawBoard(activeBoard);
  }));
  $('#codexClose').addEventListener('click',closeCodex);
  codex.addEventListener('click',e=>{if(e.target===codex)closeCodex()});
  const btnCodex=$('#btnCodex');
  if(btnCodex)btnCodex.addEventListener('click',()=>codexOpen?closeCodex():openCodex('boards'));
  const btnCritters=$('#btnCritters');
  if(btnCritters)btnCritters.addEventListener('click',()=>openCodex('critters'));
  const btnWolves=$('#btnWolves');
  if(btnWolves)btnWolves.addEventListener('click',()=>openCodex('wolves'));
  const btnMusic=$('#btnMusic');
  if(btnMusic)btnMusic.addEventListener('click',()=>toggleMusic());
  $('#computerClose').addEventListener('click',closeComputer);
  computerWindow.addEventListener('click',e=>{if(e.target===computerWindow)closeComputer()});
  computerWindow.querySelectorAll('[data-computer-app]').forEach(button=>button.addEventListener('click',()=>setComputerApp(button.dataset.computerApp)));
  const pasteImageButton=$('#computerPasteImage');
  if(pasteImageButton)pasteImageButton.addEventListener('click',()=>{
    if(!W||!W.computer||!W.computer.clipboard){toast('Copie primeiro um resultado de imagem.');return}
    const clipboard=W.computer.clipboard;
    const existing=(W.computer.images||[]).find(image=>image.sourceUrl===clipboard.sourceUrl);
    if(existing){
      W.computer.clipboard=null;setComputerApp('gallery');toast('Essa imagem já está na galeria.');return;
    }
    try{
      const copied=copyComputerImageToGallery(clipboard,clipboard);
      if(!copied){toast('A galeria está cheia. Remova imagens antes de colar outra.');return}
      W.computer.clipboard=null;setComputerApp('gallery');
      toast('Imagem colada na galeria como link remoto; nenhum arquivo foi baixado.');
    }catch(error){
      toast(error&&error.message?error.message:'Não foi possível colar essa imagem.');
    }
  });
  const mindHelp=$('#mindHelp');
  const neuralModal=$('#neuralModal');
  if(mindHelp&&neuralModal){
    mindHelp.addEventListener('click',()=>neuralModal.classList.remove('hide'));
    const nc=$('#neuralClose');
    if(nc)nc.addEventListener('click',()=>neuralModal.classList.add('hide'));
    neuralModal.addEventListener('click',e=>{if(e.target===neuralModal)neuralModal.classList.add('hide')});
  }
  const musicStopBtn=$('#musicStop'),musicPrevBtn=$('#musicPrev'),musicNextBtn=$('#musicNext');
  if(musicStopBtn)musicStopBtn.addEventListener('click',()=>stopMusic());
  if(musicPrevBtn)musicPrevBtn.addEventListener('click',()=>{if(musicOn)playSongAt(musicIdx-1);else startMusic()});
  if(musicNextBtn)musicNextBtn.addEventListener('click',()=>{if(musicOn)playSongAt(musicIdx+1);else startMusic()});
  document.querySelectorAll('#hudMenu button[data-tab]').forEach(b=>b.addEventListener('click',()=>openCodex(b.dataset.tab)));
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    hudMenu.classList.add('hide');
    if(codexOpen)closeCodex();
    if(computerOpen)closeComputer();
    const sm=$('#shareModal');if(sm)sm.classList.add('hide');
  });
  const shareModal=$('#shareModal');
  const btnShare=$('#btnShare');
  if(btnShare&&shareModal){
    const shareUrl='https://florestadosbichosia.vercel.app';
    btnShare.addEventListener('click',()=>{
      const el=$('#shareUrl');
      if(el)el.textContent=shareUrl;
      shareModal.classList.remove('hide');
    });
    $('#shareClose').addEventListener('click',()=>shareModal.classList.add('hide'));
    shareModal.addEventListener('click',e=>{if(e.target===shareModal)shareModal.classList.add('hide')});
    const copyBtn=$('#shareCopy');
    if(copyBtn)copyBtn.addEventListener('click',()=>{
      const txt='https://florestadosbichosia.vercel.app';
      const done=()=>{const s=$('#shareCopied');if(s){s.textContent='link copiado!';setTimeout(()=>{s.textContent=''},2200)}toast('Link copiado. Mande para os amigos.')};
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(txt).then(done).catch(()=>{
          const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();
          try{document.execCommand('copy');done()}catch(err){}ta.remove();
        });
      }else{
        const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();
        try{document.execCommand('copy');done()}catch(err){}ta.remove();
      }
    });
  }

  /* ---------- lista ---------- */
  function buildRoster(){
    rosterList.innerHTML='';
    cardEls.clear();
    for(const a of W.animals){
      const div=document.createElement('div');
      div.className='card';
      div.dataset.id=a.id;
      div.innerHTML=`
        <div class="av" data-spk="${a.spk||''}" style="background:radial-gradient(circle at 35% 30%,${a.sp.col},#1a1712)">${a.sp.label[0]}</div>
        <div>
          <div class="nm"><span class="nmtxt"></span><span class="sp">${a.sp.label}</span></div>
          <div class="st"><span class="stateTxt"></span><span class="projTxt"></span></div>
          <div class="bars${a.sp.marine?' marine':''}">
            ${NEEDS.map(n=>`<div class="bar b-${n}" title="${NEED_PT[n]}"><i></i></div>`).join('')}
            <div class="bar b-oxygen" title="oxigênio" ${a.sp.marine?'':'hidden'}><i></i></div>
          </div>
        </div>`;
      div.addEventListener('click',()=>select(a.id));
      rosterList.appendChild(div);
      cardEls.set(a.id,div);
    }
    // retratos em segundo plano, uma vez por espécie
    const spks=[...new Set(W.animals.map(a=>a.spk).filter(Boolean))];
    spks.forEach((spk,i)=>setTimeout(()=>{
      if(!V||!V.portrait||!W)return;
      const url=V.portrait(spk);
      if(!url)return;
      rosterList.querySelectorAll(`.av[data-spk="${spk}"]`).forEach(el=>{
        el.classList.add('hasimg');
        el.innerHTML=`<img alt="" src="${url}">`;
      });
    },30+i*45));
  }
  function updateCards(){
    if(!W)return;
    for(const a of W.animals){
      const el=cardEls.get(a.id);if(!el)continue;
      el.classList.toggle('sel',a.id===selectedId);
      el.querySelector('.nmtxt').textContent=a.name||'sem nome';
      el.querySelector('.stateTxt').textContent=statusOf(a);
      const proj=el.querySelector('.projTxt');
      proj.textContent=a.project?('· '+({montinho:'montinho',fogueira:'fogueira',toca:'toca',abrigo:'abrigo'}[a.project.type]||'construindo')):'';
      const bars=el.querySelectorAll('.bar i');
      NEEDS.forEach((n,i)=>{bars[i].style.width=(clamp(a.n[n])*100).toFixed(0)+'%'});
      const oxygenBar=el.querySelector('.b-oxygen');
      const needsOxygen=!!(a.sp.marine||(!a.sp.swim&&OCEAN_ZONE&&isOcean(a.x,a.z)&&coastDistance(a.x,a.z)<-3));
      oxygenBar.hidden=!needsOxygen;
      el.querySelector('.bars').classList.toggle('marine',needsOxygen);
      oxygenBar.querySelector('i').style.width=(clamp(a.oxygen==null?1:a.oxygen)*100).toFixed(0)+'%';
    }
  }

  /* ---------- detalhe ---------- */
  function renderThoughts(a,smoothScroll){
    thoughtsEl.innerHTML='';
    const logs=a.log.slice(-32);
    for(const e of logs){
      const d=document.createElement('div');
      d.className='th t-'+(e.type||'think');
      d.innerHTML=`<span class="tm">${fmtTime(e.t)}</span>${e.html}`;
      thoughtsEl.appendChild(d);
    }
    if(smoothScroll!==false)thoughtsEl.scrollTop=thoughtsEl.scrollHeight;
  }
  function renderWish(a){
    wishEl.innerHTML=a.wish&&a.wish.text?a.wish.text:'…';
  }
  function renderSelf(a){
    if(!persEl||!persDreamEl)return;
    if(!a||!a.pers){persEl.innerHTML='';persDreamEl.innerHTML='';return}
    const P=a.pers,T=TRAITS[P.trait]||{};
    const q=QUIRKS.find(x=>x.k===P.quirk);
    persEl.innerHTML=`<span class="mood gold" title="${T.desc||''}">${T.label||P.trait}</span>`+
      `<span class="mood odd" title="mania dele">${q?q.label:P.quirk}</span>`+
      `<span class="mood ${P.routine==='noite'?'cold':'good'}">${P.routine==='noite'?'noturno':'diurno'}</span>`+
      (P.dreams?`<span class="mood good">${P.dreams} sonho(s) realizado(s)</span>`:'');
    const d=P.dream;
    const values=P.values||{};
    const valueLabels={curiosity:'curiosidade',sociability:'amizade',craft:'invenção',risk:'risco',novelty:'novidade',trade:'troca'};
    const valuesText=Object.keys(valueLabels).map(key=>`${valueLabels[key]} ${Math.round((values[key]||0)*100)}`).join(' · ');
    persDreamEl.innerHTML=(d?`<div class="dreamq${d.done?' done':''}">${d.done?'já realizou':'sonho'}: ${d.label}</div>`:'')+
      `<div class="dim">acha que ${P.belief}.</div><div class="dim">valores: ${valuesText}</div>`;
  }
  const PROJ_NAME={montinho:'montinho',fogueira:'fogueira',toca:'toca',abrigo:'abrigo',represa:'represa',marco:'marco',cabana:'cabana',ponte:'ponte',torre:'torre',celeiro:'celeiro'};
  function feelingsOf(a){
    const f=[],n=a.n;
    if(n.fome<.22)f.push(['faminto','bad']);else if(n.fome<.45)f.push(['com fome','gold']);
    if(n.sede<.22)f.push(['com muita sede','cold']);else if(n.sede<.45)f.push(['com sede','cold']);
    if(n.energia<.2)f.push(['exausto','odd']);else if(n.energia<.4)f.push(['cansado','odd']);
    if(n.calor<.28)f.push(['com frio','cold']);else if(n.calor>.85)f.push(['suando','bad']);
    if(n.saude<.45)f.push(['machucado','bad']);else if(n.saude<.75)f.push(['dolorido','gold']);
    if(n.social<.25)f.push(['sozinho','odd']);else if(n.social>.75)f.push(['enturmado','good']);
    if(a.fear&&a.fear.fire>.4)f.push(['com medo do fogo','bad']);
    if(a.sp.marine&&OCEAN_ZONE&&!isOcean(a.x,a.z))f.push([a.oxygen<.35?'sem ar':'na beira do mar',a.oxygen<.35?'bad':'cold']);
    if(!a.sp.marine&&!a.sp.swim&&OCEAN_ZONE&&isOcean(a.x,a.z)&&coastDistance(a.x,a.z)<-3)f.push([a.oxygen<.35?'sem ar':'na água funda',a.oxygen<.35?'bad':'cold']);
    if(a.pain>0)f.push(['sentindo dor','bad']);
    if(a.project)f.push(['empolgado com o '+(PROJ_NAME[a.project.type]||'projeto'),'good']);
    if(a.curio>.85)f.push(['muito curioso','gold']);
    if(a.hands.length)f.push(['carregando coisas','gold']);
    if(a.lessons&&a.lessons.burned&&a.fear.fire<.3)f.push(['respeita o fogo','odd']);
    if(a.inventions&&a.inventions.length)f.push(['orgulhoso','good']);
    if(!f.length)f.push(['em paz','good']);
    return f.slice(0,7);
  }
  function wantsOf(a){
    const list=[],add=(p,t)=>{p=clamp(p);if(p>.05)list.push({p,t})};
    if(a.project)add(.95,'terminar o '+(PROJ_NAME[a.project.type]||'projeto'));
    add(1-a.n.sede,'beber água');
    add(1-a.n.fome,'comer algo');
    add((1-a.n.energia)*(daylight()<.25?1.15:1),'dormir');
    add(1-a.n.calor,'se esquentar');
    add((1-a.n.social)*.8,'conversar com alguém');
    if(a.sp.marine&&OCEAN_ZONE&&!isOcean(a.x,a.z)&&a.oxygen<.65)add(.82+(1-a.oxygen)*.18,'voltar ao mar para respirar');
    if(!a.sp.marine&&!a.sp.swim&&OCEAN_ZONE&&isOcean(a.x,a.z)&&coastDistance(a.x,a.z)<-3&&a.oxygen<.65)add(.82+(1-a.oxygen)*.18,'voltar à margem para respirar');
    add(a.curio*.7,'explorar e mexer nas coisas');
    if(a.hands.length)add(.5,'usar o que está carregando');
    if(a.n.saude<.6)add(1-a.n.saude,'se cuidar');
    list.sort((x,y)=>y.p-x.p);
    return list.slice(0,3);
  }
  function renderMood(a){
    if(!a){feelEl.innerHTML='';wantsEl.innerHTML='';return}
    feelEl.innerHTML=feelingsOf(a).map(([t,c])=>`<span class="mood ${c}">${t}</span>`).join('');
    wantsEl.innerHTML=wantsOf(a).map(w=>`<div class="want"><span class="wl">${w.t}</span><span class="wb"><i style="width:${(w.p*100).toFixed(0)}%"></i></span></div>`).join('');
  }
  function renderLex(a){
    const known=a.known||{};
    const ws=Object.keys(known);
    const und=ws.filter(w=>known[w].und>=2).length;
    const foot=ws.length?`<span class="empty">ouviu ${ws.length} palavra(s) dos outros, entende ${und}.</span>`:'';
    const keys=Object.keys(a.lex).filter(k=>k==='self'||/^[kva]:/.test(k));
    if(!keys.length){lexEl.innerHTML='<span class="empty">ainda não inventou palavra nenhuma.</span>'+foot;return}
    keys.sort((p,q)=>(p==='self'?-1:q==='self'?1:p.localeCompare(q)));
    lexEl.innerHTML=keys.map(k=>{
      const w=a.lex[k];
      const g=gloss(k);
      return `<span class="chip" title="${g}"><b>${w}</b><span>${g}</span></span>`;
    }).join('')+foot;
  }
  function renderHands(a){
    if(!a.hands.length){handsEl.innerHTML='<span class="empty">mãos vazias</span>';return}
    handsEl.innerHTML=a.hands.map(k=>`<span class="hand">${K[k]?K[k].g:k}</span>`).join('');
  }
  function renderIdeas(a){
    if(!a.ideas||!a.ideas.length){ideasEl.innerHTML='<span class="empty">nenhuma ideia agora.</span>';return}
    ideasEl.innerHTML=a.ideas.map(i=>`<div class="idea"><span class="st">${i.st}</span><span>${i.txt}</span><span class="note">${i.note||''}</span></div>`).join('');
  }
  function memLabel(key){
    const [v,k]=key.split(':');
    if(v==='socializar')return 'conversar com outro bicho';
    if(v==='explorar')return 'explorar a mata';
    if(v==='mexer')return 'mexer nas coisas';
    if(v==='projeto'||v==='empilhar')return 'construir';
    if(v==='dormir')return k==='chao'?'dormir no chão':'dormir em '+(K[k]?K[k].g:k);
    if(v==='combinar')return 'juntar '+(K[k]?K[k].g:k);
    if(v==='comer')return 'comer';
    const vn=VERBG[v]||v;
    const kn=K[k]?K[k].g:k;
    return `${vn} ${kn}`;
  }
  function renderMem(a){
    const rows=Object.keys(a.mem).map(k=>{
      const r=a.mem[k];
      let sc=0;for(const n of NEEDS)sc+=(r.eff[n]||0)*NEED_W[n];
      return {k,r,sc};
    }).sort((p,q)=>Math.abs(q.sc)-Math.abs(p.sc)).slice(0,8);
    if(!rows.length){memEl.innerHTML='<span class="empty">ainda não aprendeu nada.</span>';return}
    memEl.innerHTML=rows.map(({k,r,sc})=>{
      const heard=r.heard?'<span title="ouviu de outro bicho">👂</span> ':'';
      const cls=sc>=0?'up':'dn';
      const sign=sc>=0?'+':'−';
      return `<div class="mrow" title="${r.n} vez(es)"><span class="mk">${heard}${memLabel(k)}</span><span class="${cls}">${sign}${Math.abs(sc).toFixed(2)}</span></div>`;
    }).join('');
  }
  function renderInvent(a){
    if(!a.inventions.length){inventEl.innerHTML='<span class="empty">nada inventado ainda.</span>';return}
    inventEl.innerHTML=a.inventions.slice().reverse().map(inv=>{
      const nm=inv.name?`<span class="nm">${inv.name}</span> `:'';
      return `<div class="inv"><span class="ic">✦</span><div>${nm}<span class="tx">${inv.txt||inv.kind}</span></div></div>`;
    }).join('');
  }
  function renderWeb(a){
    if(!a){webEl.innerHTML='';webInfoEl.innerHTML='';return}
    const ks=Object.keys(a.knowledge||{});
    const wiki=a.wikipedia||[];
    if(!ks.length&&!wiki.length){webEl.innerHTML='<span class="empty">ainda não pesquisou na internet.</span>';webInfoEl.innerHTML='';return}
    webEl.innerHTML=ks.map(k=>`<span class="chip kc${k===webTopic?' on':''}" data-topic="${esc(k)}">${k}</span>`).join('');
    if(!ks.length)webEl.innerHTML='<span class="empty">sem pesquisas registradas ainda.</span>';
    if(!webTopic&&wiki.length)webTopic=wiki[wiki.length-1].topic;
    const result=wiki.slice().reverse().find(item=>item.topic===webTopic);
    if(!webTopic||ks.indexOf(webTopic)<0){
      if(result){
        webInfoEl.innerHTML=result.error
          ?`<b>${htmlEscape(result.topic)}</b> — ${htmlEscape(result.error)}`
          :`<b>${htmlEscape(result.title)}</b> — ${htmlEscape(result.extract)} <a href="${htmlEscape(result.url)}" target="_blank" rel="noopener noreferrer">abrir na Wikipédia</a>`;
      }else webInfoEl.innerHTML='<span class="empty">clique num tema para ver o que ele entendeu.</span>';
    }else{
      const r=RESEARCH.find(x=>x[0]===webTopic);
      webInfoEl.innerHTML=`<b>${htmlEscape(webTopic)}</b> — ${htmlEscape(r?r[1]:'ele guardou essa ideia do jeito dele.')}`+
        (result?(result.error?`<div>Wikipédia: ${htmlEscape(result.error)}</div>`:`<div><b>Wikipédia:</b> ${htmlEscape(result.extract)} <a href="${htmlEscape(result.url)}" target="_blank" rel="noopener noreferrer">fonte</a></div>`):'');
    }
    webEl.querySelectorAll('.chip.kc').forEach(c=>c.addEventListener('click',()=>{
      webTopic=c.dataset.topic;
      webEl.querySelectorAll('.chip.kc').forEach(x=>x.classList.toggle('on',x===c));
      const r=RESEARCH.find(x=>x[0]===webTopic);
      const found=(a.wikipedia||[]).slice().reverse().find(item=>item.topic===webTopic);
      webInfoEl.innerHTML=`<b>${htmlEscape(webTopic)}</b> — ${htmlEscape(r?r[1]:'ele guardou essa ideia do jeito dele.')}`+
        (found?(found.error?`<div>Wikipédia: ${htmlEscape(found.error)}</div>`:`<div><b>Wikipédia:</b> ${htmlEscape(found.extract)} <a href="${htmlEscape(found.url)}" target="_blank" rel="noopener noreferrer">fonte</a></div>`):'');
    }));
  }
  function renderTools(a){
    if(!a){toolsEl.innerHTML='';return}
    const own=TOOL_KEYS.filter(k=>a.recipes&&a.recipes[k]);
    const builds=BUILD_KEYS.filter(k=>a.recipes&&a.recipes[k]);
    if(!own.length&&!builds.length){toolsEl.innerHTML='<span class="empty">nada descoberto ainda.</span>';return}
    const chip=(k,held)=>`<span class="toolchip${held?' hand':''}">${K[k]?K[k].g:k}${held?' ✋':''}</span>`;
    toolsEl.innerHTML=(own.length?own.map(k=>chip(k,a.hands.includes(k))).join(''):'')+
      (builds.length?builds.map(k=>chip(k,false)).join(''):'');
  }
  function labelOfThing(t){return t?(t.kind==='portao'?'portão':t.kind==='ruina'?'ruína':K[t.kind]?K[t.kind].g:t.kind):'algo'}
  function stepLabel(s){
    if(!s)return '';
    if(s.t==='goto')return s.explore?'explorar a mata':'ir até '+(s.th?labelOfThing(s.th):'um ponto');
    if(s.t==='stay')return 'ficar perto de '+(s.th?labelOfThing(s.th):'algo');
    if(s.t==='do'){
      if(s.verb==='combinar')return 'juntar '+(K[s.x]?K[s.x].g:s.x)+' + '+(K[s.y]?K[s.y].g:s.y);
      const vn=VERB_ING[s.verb]||VERBG[s.verb]||s.verb;
      return vn+(s.kind?' '+(K[s.kind]?K[s.kind].g:s.kind):'');
    }
    return s.t;
  }
  function taskLabel(tk){
    if(tk.final==='faiscar')return 'acender o fogo';
    if(tk.act==='cavar')return 'cavar';
    return (tk.n||1)+'× '+(K[tk.kind]?K[tk.kind].g:tk.kind);
  }
  function renderActions(a){
    if(!a){actionsEl.innerHTML='';return}
    let h=`<div class="actNow">${statusOf(a)}</div>`;
    if(a.taken)h+='<div class="actLine">levado pelos lobos</div>';
    else if(a.faint>0)h+='<div class="actLine">desmaiado, recuperando</div>';
    if(a.pers&&a.pers.dream)h+=`<div class="actLine dimtxt">sonho: ${a.pers.dream.label}${a.pers.dream.done?' (feito)':''}</div>`;
    if(a.project){
      const p=a.project;const done=Math.min(p.idx,p.tasks.length);
      h+=`<div class="actLine">projeto: <b>${PROJ_NAME[p.type]||p.type}</b> · ${done}/${p.tasks.length}</div>`;
      h+=`<div class="actSteps">${p.tasks.map((tk,i)=>`<span class="astep${i<p.idx?' done':i===p.idx?' cur':''}">${taskLabel(tk)}</span>`).join('')}</div>`;
    }else if(a.plan&&a.plan.steps&&a.plan.steps.length){
      h+=`<div class="actSteps">${a.plan.steps.map((s,i)=>`<span class="astep${i<(a.plan.i||0)?' done':i===(a.plan.i||0)?' cur':''}">${stepLabel(s)}</span>`).join('')}</div>`;
    }else h+='<div class="actLine dimtxt">sem plano; decide no próximo instante.</div>';
    if(a.mind&&a.mind.cands&&a.mind.cands.length){
      h+='<div class="actLine dimtxt" style="margin-top:4px">o cérebro pesa:</div><div class="mindList">'+
        a.mind.cands.slice(0,4).map(c=>`<div class="mrow"><span class="mk">${(c.k||'').replace(/:/g,' · ')}</span><span class="${c.k===a.mind.pick?'up':'dn'}">${Math.round((c.s||0)*100)}</span></div>`).join('')+'</div>';
    }
    actionsEl.innerHTML=h;
  }
  function renderTribe(a){
    if(!a){tribeBoxEl.innerHTML='';return}
    const tr=tribeOf(a);
    if(!tr){tribeBoxEl.innerHTML='<span class="empty">ainda não vive em tribo.</span>';return}
    const houses=W.things.filter(t=>!t.gone&&t.data&&t.data.tribe===tr.id&&t.data.house).length;
    const reefs=W.things.filter(t=>!t.gone&&t.kind==='coral'&&t.data&&t.data.tribe===tr.id).length;
    const stores=tr.stores||{food:0,wood:0,stone:0};
    const neighbors=(W.diplomacy||[]).filter(r=>r.a===tr.id||r.b===tr.id).map(r=>{
      const other=W.tribes.find(x=>x.id===(r.a===tr.id?r.b:r.a));
      const label=r.status==='friendly'?'amigos e parceiros de comércio':r.status==='enemy'?'inimigos':'ainda sem acordo';
      return other?`${other.name}: ${label}`:null;
    }).filter(Boolean);
    tribeBoxEl.innerHTML=`<div class="tname">${tr.name}</div>
      <div>cultura ${tr.culture.label||'?'} · ${tr.members.length} bichos · ${tr.aquatic?`${reefs} corais no recife`:houses+' casas'}</div>
      <div class="fait">fé em ${tr.faith.name} — ${tr.faith.gloss}</div>
      <div class="dim">devoção ${(tr.faith.piety*100).toFixed(0)}% · falam ${(tr.lang||[]).slice(0,3).join(' · ')||'—'}</div>
      <div class="dim">reservas: comida ${stores.food.toFixed(1)} · madeira ${stores.wood.toFixed(1)} · minerais ${stores.stone.toFixed(1)}</div>
      ${neighbors.length?`<div class="dim">relações: ${neighbors.join(' · ')}</div>`:''}
      ${tr.soundChanges?`<div class="dim">Lei de Grimm: ${tr.soundChanges} mudança(s) na língua</div>`:''}`;
  }
  function renderRelationships(a){
    if(!relationshipsEl)return;
    if(!a){relationshipsEl.innerHTML='';return}
    const rows=Object.keys(a.opinion||{}).map(id=>({
      animal:W.animals.find(other=>other.id===+id),
      value:(a.opinion[id]||{}).v||0,
    })).filter(row=>row.animal).sort((left,right)=>Math.abs(right.value)-Math.abs(left.value)).slice(0,8);
    if(!rows.length){relationshipsEl.innerHTML='<span class="empty">ainda não conhece ninguém o bastante para formar uma opinião.</span>';return}
    relationshipsEl.innerHTML=`<div class="relList">${rows.map(row=>{
      const label=row.value>.45?'amigo':row.value<-.45?'inimigo':row.value>=0?'simpatia':'desconfiança';
      return `<div class="relRow"><span class="rn">${row.animal.name||row.animal.sp.label.toLowerCase()}</span>
        <span class="rv ${row.value>=0?'f':'r'}">${label} · ${Math.round(Math.abs(row.value)*100)}%</span></div>`;
    }).join('')}</div>`;
  }
  function renderLangs(){
    if(!W){langsEl.innerHTML='';return}
    const items=W.animals.map(a=>({a,set:new Set(Object.keys(a.lex||{}).filter(k=>/^[kv]:/.test(k)).map(k=>a.lex[k]))}));
    const used=new Set(),groups=[];
    for(let i=0;i<items.length;i++){
      if(used.has(i))continue;
      const grp=[items[i]];used.add(i);
      for(let j=i+1;j<items.length;j++){
        if(used.has(j))continue;
        let sh=0;for(const w of items[j].set)if(items[i].set.has(w))sh++;
        if(sh>=2){grp.push(items[j]);used.add(j)}
      }
      if(grp.length>=2)groups.push(grp);
    }
    groups.sort((p,q)=>q.length-p.length);
    const mx=(W.stats&&W.stats.mixes)||0;
    let html=`<div class="langsum">${W.words.size} palavras na floresta · ${mx} fusão(ões) de língua</div>`;
    if(!groups.length)html+='<span class="empty">ainda não há idioma em comum: primeiro eles precisam se entender.</span>';
    groups.slice(0,4).forEach((grp,gi)=>{
      const common=new Set();
      for(const it of grp)for(const w of it.set)common.add(w);
      const names=grp.map(it=>it.a.name||it.a.sp.label.toLowerCase());
      html+=`<div class="lang"><div class="lhead">Idioma ${gi+1} · ${grp.length} bichos</div>`+
        `<div class="lwords">${[...common].slice(0,5).map(w=>`<span class="lw">${w}</span>`).join('')}</div>`+
        `<div class="lwho">${names.slice(0,6).join(' · ')}${names.length>6?' …':''}</div></div>`;
    });
    langsEl.innerHTML=html;
  }
  function renderDetail(a){
    if(!a){
      dName.textContent='—';dSub.textContent='';
      wishEl.textContent='…';thoughtsEl.innerHTML='';lexEl.innerHTML='';handsEl.innerHTML='';
      persEl.innerHTML='';persDreamEl.innerHTML='';
      ideasEl.innerHTML='';memEl.innerHTML='';inventEl.innerHTML='';feelEl.innerHTML='';wantsEl.innerHTML='';webEl.innerHTML='';
      webInfoEl.innerHTML='';toolsEl.innerHTML='';tribeBoxEl.innerHTML='';relationshipsEl.innerHTML='';actionsEl.innerHTML='';
      if(gearBoxEl)gearBoxEl.innerHTML='';if(musicBoxEl)musicBoxEl.innerHTML='';if(mindBoxEl)mindBoxEl.innerHTML='';if(ruinsBoxEl)ruinsBoxEl.innerHTML='';
      return;
    }
    dName.innerHTML=(a.name?`<b>${a.name}</b>`:'sem nome')+`<small>${a.sp.label}</small>`;
    const ageMin=Math.floor(a.age/60);
    dSub.innerHTML=`<span>${statusOf(a)}</span><span>${ageMin<1?'recém-acordado':ageMin+' min de vida'}</span><span>${a.exp} experiências</span>`;
    renderWish(a);renderSelf(a);renderMood(a);renderThoughts(a);renderLex(a);renderHands(a);renderIdeas(a);renderMem(a);renderInvent(a);renderWeb(a);renderLangs();renderTools(a);renderTribe(a);renderRelationships(a);renderActions(a);
    renderGear(a);renderMusic(a);renderMind(a);renderRuinsSel(a);
  }
  function select(id){
    selectedId=id;webTopic=null;
    if(V)V.selectAnimal(id);
    const a=animal();
    updateCards();
    renderDetail(a);
    if(a)renderThoughts(a);
  }

  /* ---------- eventos ---------- */
  const evLog=[];
  const MAX_EV=40;
  function renderEvents(){
    if(!evListEl)return;
    evListEl.innerHTML=evLog.map((e,i)=>
      `<div class="ev${e.aid?' click':''}" data-i="${i}"${e.aid?' title="ir até o bicho"':''}>`+
      `<span class="t">${fmtTime(e.t)}</span><span>${e.icon||''}</span><span>${e.html}</span></div>`
    ).join('')||'<div class="ev emptyEv">nada aconteceu ainda…</div>';
  }
  function pushTicker(e){
    const last=evLog[0];
    if(last&&last.html===e.html&&Math.abs((e.t||0)-(last.t||0))<45)return;
    evLog.unshift(e);
    if(evLog.length>MAX_EV)evLog.pop();
    renderEvents();
    if(evListEl)evListEl.scrollTop=0;
  }
  if(evListEl)evListEl.addEventListener('click',ev=>{
    const row=ev.target.closest('.ev');if(!row||row.dataset.i==null)return;
    const e=evLog[+row.dataset.i];if(!e)return;
    if(e.aid&&W&&W.animals.some(a=>a.id===e.aid)){
      select(e.aid);
      if(V&&V.focusEvent)V.focusEvent(e.aid);
    }else if(V&&V.focusEvent&&e.x!=null){
      V.focusEvent(null,e.x,e.z);
    }else toast('Esse evento não tem um bicho ligado a ele.');
  });
  function toast(msg){
    toastEl.textContent=msg;toastEl.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),2600);
  }

  /* ---------- música das tribos (WebAudio) ---------- */
  let ac=null,musicOn=false,musicTimer=null,musicIdx=0;
  let musicNodes=[];
  function ensureAudio(){
    if(!ac){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return null;
      ac=new AC();
    }
    if(ac.state==='suspended')ac.resume();
    return ac;
  }
  function stopNotes(){
    for(const n of musicNodes){try{n.stop()}catch(err){}}
    musicNodes=[];
  }
  function tone(f,start,dur,gain,type,detune){
    if(!ac)return;
    const o=ac.createOscillator(),g=ac.createGain();
    o.type=type||'sine';o.frequency.value=f;
    if(detune)o.detune.value=detune;
    g.gain.setValueAtTime(.0001,start);
    g.gain.linearRampToValueAtTime(gain,start+.04);
    g.gain.exponentialRampToValueAtTime(.0008,start+dur);
    o.connect(g);g.connect(ac.destination);
    o.start(start);o.stop(start+dur+.03);
    musicNodes.push(o);
  }
  function playSongAt(idx){
    if(!W||!W.songs||!W.songs.length){toast('ninguém compôs música ainda: as tribos precisam de língua e tempo.');return null}
    if(!ensureAudio()){toast('este navegador não deixa tocar áudio.');return null}
    const list=W.songs;
    musicIdx=((idx%list.length)+list.length)%list.length;
    const s=list[musicIdx];
    stopNotes();
    const t0=ac.currentTime+.08,step=.6;
    s.notes.forEach((midi,i)=>{
      const f=440*Math.pow(2,(midi-69)/12);
      tone(f,t0+i*step,.55,.11,'triangle');
      tone(f*2,t0+i*step,.4,.022,'sine',6);
      if(i%4===0)tone(f/2,t0+i*step,1.9,.05,'sine');
    });
    musicBar&&musicBar.classList.remove('hide');
    if(musicNowEl){
      musicNowEl.textContent=`♪ ${s.name} — ${s.tribeName||s.byName} (dia ${s.day})`;
      musicNowEl.title=`na língua deles: ${(s.words||[]).join(' · ')}`;
    }
    return s;
  }
  function playComputerAudio(item){
    if(!ensureAudio()){toast('este navegador não deixa tocar áudio.');return}
    if(!Array.isArray(item.notes)||!item.notes.length){toast('este arquivo não tem notas para tocar.');return}
    musicOn=false;clearInterval(musicTimer);musicTimer=null;
    const b=$('#btnMusic');if(b){b.classList.remove('on');b.textContent='música'}
    stopNotes();
    const t0=ac.currentTime+.08,step=.42;
    item.notes.forEach((midi,i)=>{
      const f=440*Math.pow(2,(midi-69)/12);
      tone(f,t0+i*step,.38,.1,'triangle');
      if(i%3===0)tone(f/2,t0+i*step,.75,.035,'sine');
    });
    musicBar&&musicBar.classList.remove('hide');
    if(musicNowEl){
      musicNowEl.textContent=`♫ ${item.title}`;
      musicNowEl.title=`áudio criado por ${item.byName}, pesquisando ${item.topic}`;
    }
  }
  function startMusic(){
    if(!W||!W.songs||!W.songs.length){
      toast('ainda não há música. Abra “músicas” e espere as tribos comporem.');
      openCodex('music');return;
    }
    musicOn=true;
    const b=$('#btnMusic');if(b){b.classList.add('on');b.textContent='música ♪'}
    playSongAt(musicIdx);
    clearInterval(musicTimer);
    musicTimer=setInterval(()=>{
      if(!W||!W.songs.length){stopMusic();return}
      playSongAt(musicIdx+1);
    },9*1000);
  }
  function stopMusic(){
    musicOn=false;clearInterval(musicTimer);musicTimer=null;
    stopNotes();
    const b=$('#btnMusic');if(b){b.classList.remove('on');b.textContent='música'}
    musicBar&&musicBar.classList.add('hide');
  }
  function toggleMusic(){
    if(musicOn)stopMusic();
    else startMusic();
  }

  /* ---------- novos painéis ---------- */
  function tribeOfName(a){
    const tr=a&&a.tribeId?W.tribes.find(t=>t.id===a.tribeId):null;
    return tr||null;
  }
  function cultureLabel(a){
    const tr=tribeOfName(a);
    return tr&&tr.culture?tr.culture.label||tr.culture.element:null;
  }
  function renderGear(a){
    if(!gearBoxEl)return;
    if(!a){gearBoxEl.innerHTML='';return}
    const hands=a.hands||[];
    const owned=hands.length?hands.map(k=>`<span class="toolchip hand">${K[k]?K[k].g:k} ✋</span>`).join(''):'';
    const tr=tribeOfName(a);
    const cult=tr&&tr.culture?`<span class="capchip gold">armadura ${tr.culture.label||tr.culture.element}</span>`:'';
    const gate=a.lessons&&a.lessons.gate?'<span class="capchip green">sabe passar o portão</span>':'';
    const recipes=TOOL_KEYS.filter(k=>a.recipes&&a.recipes[k]&&!hands.includes(k)).map(k=>`<span class="capchip">${K[k]?K[k].g:k}</span>`).join('');
    gearBoxEl.innerHTML=(owned||'<span class="none">mãos vazias</span>')+cult+gate+(recipes?recipes:'');
  }
  function renderMind(a){
    if(!mindBoxEl)return;
    if(!a){mindBoxEl.innerHTML='';return}
    let h='';
    if(a.mind&&a.mind.cands&&a.mind.cands.length){
      const cs=a.mind.cands.slice().sort((p,q)=>(q.s||0)-(p.s||0)).slice(0,5);
      h+=cs.map(c=>{
        const win=c.k===a.mind.pick;
        const pct=Math.round(clamp(Math.abs(c.s||0))*100);
        return `<div class="voteRow${win?' win':''}"><span class="vl">${(c.k||'').replace(/:/g,' · ')}</span><span class="vb"><i style="width:${Math.min(100,pct)}%"></i></span><span class="vn">${pct}</span></div>`;
      }).join('');
    }else h+='<span class="empty">ainda sem votos; o cérebro está acordando.</span>';
    const graph=a.memoryGraph;
    const edges=graph&&graph.edges?Object.values(graph.edges).slice().sort((p,q)=>(q.weight||0)-(p.weight||0)).slice(0,7):[];
    if(edges.length){
      const nodeIds=[...new Set(edges.flatMap(edge=>[edge.from,edge.to]))];
      const nodes=nodeIds.map(id=>graph.nodes[id]).filter(Boolean);
      const types=['thing','action','need'];
      const labels={thing:'coisa',action:'ação',need:'resultado'};
      const positions={};
      let maxRows=1;
      for(const type of types){
        const group=nodes.filter(node=>node.type===type);
        maxRows=Math.max(maxRows,group.length);
        group.forEach((node,index)=>{positions[node.id]={x:14+types.indexOf(type)*106,y:36+index*32,node}});
      }
      const svgEscape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const height=48+maxRows*32;
      const lines=edges.map(edge=>{
        const from=positions[edge.from],to=positions[edge.to];
        if(!from||!to)return '';
        const alpha=Math.min(.85,.25+(edge.weight||0)/16),width=Math.min(3.5,1+(edge.weight||0)/5);
        return `<line x1="${from.x+7}" y1="${from.y}" x2="${to.x+7}" y2="${to.y}" stroke-opacity="${alpha}" stroke-width="${width}"/>`;
      }).join('');
      const circles=types.map(type=>nodes.filter(node=>node.type===type).map(node=>{
        const p=positions[node.id],label=svgEscape((node.label||node.id).slice(0,13));
        return `<g class="mg-node"><title>${svgEscape(node.label||node.id)} · peso ${Math.round(node.weight||0)}</title><circle cx="${p.x+7}" cy="${p.y}" r="4"/><text x="${p.x+15}" y="${p.y+3}">${label}</text></g>`;
      }).join('')).join('');
      h+=`<div class="memoryGraph"><div class="mg-title">memória em grafo <span>${Object.keys(graph.edges).length} ligações · ${graph.consolidations||0} sonhos</span></div><svg viewBox="0 0 330 ${height}" role="img" aria-label="Grafo de memórias do animal"><text class="mg-col" x="14" y="12">${labels.thing}</text><text class="mg-col" x="120" y="12">${labels.action}</text><text class="mg-col" x="226" y="12">${labels.need}</text>${lines}${circles}</svg></div>`;
    }else h+='<div class="memoryGraph empty">ainda está formando suas ligações de memória.</div>';
    const caps=[];
    const nTools=TOOL_KEYS.filter(k=>a.recipes&&a.recipes[k]).length;
    if(nTools)caps.push(`<span class="capchip gold">${nTools} ferramenta(s)</span>`);
    const nBuilds=BUILD_KEYS.filter(k=>a.recipes&&a.recipes[k]).length;
    if(nBuilds)caps.push(`<span class="capchip gold">${nBuilds} construção(ões)</span>`);
    const nWords=Object.keys(a.lex||{}).filter(k=>/^[kv]:/.test(k)).length;
    if(nWords)caps.push(`<span class="capchip">${nWords} palavras</span>`);
    const nKnow=Object.keys(a.knowledge||{}).length;
    if(nKnow)caps.push(`<span class="capchip green">${nKnow} saber(es)</span>`);
    if(a.songs&&a.songs.length)caps.push(`<span class="capchip green">${a.songs.length} música(s)</span>`);
    if(a.recipes&&a.recipes.pesca)caps.push('<span class="capchip">sabe pescar</span>');
    if(a.recipes&&a.recipes.plantacao)caps.push('<span class="capchip">sabe plantar</span>');
    if(a.recipes&&a.recipes.poco)caps.push('<span class="capchip">sabe cavar poço</span>');
    if(a.lessons&&a.lessons.gate)caps.push('<span class="capchip">usa o portão</span>');
    if(caps.length)h+='<div class="capwrap" style="margin-top:3px">'+caps.join('')+'</div>';
    mindBoxEl.innerHTML=h;
  }
  function renderMusic(a){
    if(!musicBoxEl)return;
    if(!a){musicBoxEl.innerHTML='';return}
    const own=(a.songs||[]).slice().reverse();
    let h='';
    if(own.length){
      h+=own.map(s=>`<div class="songline">🎵 <b>${s.name}</b><span class="sg">dia ${s.day}</span></div>`).join('');
    }else{
      const words=Object.keys(a.lex||{}).filter(k=>/^[kv]:/.test(k)).length;
      h+=`<span class="empty">${words>=4?'já tem palavras; com sorte vai compor.':'ainda não canta — precisa de língua. Ele tem '+words+' palavra(s).'}</span>`;
    }
    const caps=[];
    if(a.recipes&&a.recipes.pesca)caps.push('<span class="capchip">pescador</span>');
    if(a.recipes&&a.recipes.plantacao)caps.push('<span class="capchip green">plantador</span>');
    if(a.recipes&&a.recipes.poco)caps.push('<span class="capchip">poceiro</span>');
    if(a.lessons&&a.lessons.gate)caps.push('<span class="capchip gold">sabe o portão</span>');
    if(caps.length)h+='<div class="capwrap">'+caps.join('')+'</div>';
    const total=(W.songs||[]).length;
    if(total)h+=`<div class="dimtxt">${total} música(s) na floresta. Abra “músicas” para ouvir.</div>`;
    musicBoxEl.innerHTML=h;
  }
  function renderRuinsSel(a){
    if(!ruinsBoxEl)return;
    if(!a){ruinsBoxEl.innerHTML='';return}
    const ruins=W.things.filter(t=>!t.gone&&t.kind==='ruina');
    const did=ruins.filter(t=>t.data&&(t.data.done||t.data.dec>=6));
    let h='';
    if(!ruins.length)h='<span class="empty">nenhuma ruína neste mundo.</span>';
    else h=ruins.map(t=>{
      const dec=t.data?t.data.dec|0:0;
      const by=t.data&&t.data.doneBy&&W.animals.find(x=>x.id===t.data.doneBy);
      return `<div class="ruinRow"><b>ruína</b> · decifrado ${dec}%${by?` · ${by.name||by.sp.label.toLowerCase()} terminou no dia ${t.data.doneDay||'?'}`:''}<div class="dim">${dec>=12?'entenderam os sinais.':dec>=6?'já sabem contar os sinais.':'ainda são riscos sem sentido.'}</div></div>`;
    }).join('');
    const learnt=Object.keys(a.knowledge||{}).filter(k=>/sinal|número|escrita|pintura/i.test(k));
    if(learnt.length)h+=`<div class="capwrap">${learnt.map(k=>`<span class="capchip gold">${k}</span>`).join('')}</div>`;
    const tr=tribeOfName(a);
    if(tr&&tr.inscription)h+=`<div class="dimtxt">inscrição da tribo: “${tr.inscription}”</div>`;
    ruinsBoxEl.innerHTML=h;
  }
  function renderLangsFull(){
    const list=$('#langsList');if(!list||!W)return;
    const items=W.animals.map(a=>({a,set:new Set(Object.keys(a.lex||{}).filter(k=>/^[kv]:/.test(k)).map(k=>a.lex[k]))}));
    const trs=W.tribes.map(tr=>{
      const mem=tr.members.map(id=>W.animals.find(a=>a.id===id)).filter(Boolean);
      const words=[...new Set(mem.flatMap(a=>Object.keys(a.lex||{}).filter(k=>/^[kv]:/.test(k)).map(k=>a.lex[k])))];
      return `<div class="wcard tribeCard"><div class="whead"><span class="tname">${tr.name}</span><span class="wtag">cultura ${tr.culture?tr.culture.label:'?'}</span></div>
        <div class="wbody">${mem.length} falante(s) · ${words.length} palavra(s) em comum${tr.numerals?` · números: ${tr.numerals.join(' ')}`:''}</div>
        ${tr.soundChanges?`<div class="wbody">Lei de Grimm: ${tr.soundChanges} mudança(s) sonora(s) · última no dia ${Math.floor((tr.lastSoundChange||0)/(W.dayLen||240))+1}</div>`:''}
        <div class="lwords">${words.slice(0,16).map(w=>`<span class="lw">${w}</span>`).join('')||'<span class="empty">silêncio</span>'}</div></div>`;
    }).join('');
    const groups=[];
    const used=new Set();
    for(let i=0;i<items.length;i++){
      if(used.has(i))continue;
      const grp=[items[i]];used.add(i);
      for(let j=i+1;j<items.length;j++){
        if(used.has(j))continue;
        let sh=0;for(const w of items[j].set)if(items[i].set.has(w))sh++;
        if(sh>=2){grp.push(items[j]);used.add(j)}
      }
      if(grp.length>=2)groups.push(grp);
    }
    groups.sort((p,q)=>q.length-p.length);
    const shared=groups.slice(0,5).map((grp,gi)=>{
      const common=new Set();
      for(const it of grp)for(const w of it.set)common.add(w);
      return `<div class="wcard"><div class="whead"><span>idioma ${gi+1}</span><span class="wtag">${grp.length} bicho(s)</span></div>
        <div class="lwords">${[...common].slice(0,12).map(w=>`<span class="lw">${w}</span>`).join('')}</div>
        <div class="wbody">${grp.map(it=>it.a.name||it.a.sp.label.toLowerCase()).slice(0,10).join(' · ')}</div></div>`;
    }).join('');
    const soundEvents=(W.langEvents||[]).filter(event=>event.type==='grimm').slice(-4).reverse();
    const soundHistory=soundEvents.length?`<div class="wcard"><div class="whead">mudanças pela Lei de Grimm</div>${soundEvents.map(event=>`<div class="wbody">dia ${Math.floor((event.t||0)/(W.dayLen||240))+1} · ${event.aName}: ${event.changes}</div>`).join('')}</div>`:'';
    list.innerHTML=`<div class="wcard"><div class="wbody">${W.words.size} palavra(s) na floresta · ${(W.stats&&W.stats.mixes)||0} fusão(ões) de língua · ${(W.stats&&W.stats.songs)||0} música(s) composta(s).</div></div>`
      +soundHistory
      +(trs||'<span class="empty">ainda não há tribo falando.</span>')+(shared?'<div class="dimtxt">idiomas que se entendem:</div>'+shared:'');
  }
  function renderRuins(){
    const list=$('#ruinsList');if(!list||!W)return;
    const ruins=W.things.filter(t=>!t.gone&&t.kind==='ruina');
    const learners=W.animals.filter(a=>Object.keys(a.knowledge||{}).length);
    if(!ruins.length){list.innerHTML='<span class="empty">nenhuma ruína no mundo ainda.</span>';return}
    list.innerHTML=ruins.map(t=>{
      const d=t.data||{},dec=d.dec|0;
      const by=d.doneBy&&W.animals.find(x=>x.id===d.doneBy);
      const know=learners.filter(a=>Object.keys(a.knowledge||{}).some(k=>/sinal|número|escrita|pintura/i.test(k)));
      return `<div class="wcard"><div class="whead"><span>ruína em ${Math.round(t.x)}, ${Math.round(t.z)}</span><span class="wtag">${dec}% decifrado</span></div>
        <div class="wbody">${dec>=12?'os sinais foram entendidos.':dec>=6?'já contam os sinais.':'ainda são riscos sem sentido.'}${by?` Terminada por <b>${by.name||by.sp.label.toLowerCase()}</b> no dia ${d.doneDay||'?'}.`:''}</div>
        ${know.length?`<div class="wbody">aprenderam com ela: ${know.slice(0,8).map(a=>`<span class="capchip gold">${a.name||a.sp.label.toLowerCase()}: ${Object.keys(a.knowledge).filter(k=>/sinal|número|escrita|pintura/i.test(k)).join(', ')}</span>`).join(' ')}</div>`:''}
        ${(W.tribes||[]).filter(tr=>tr.inscription).map(tr=>`<div class="wbody dimtxt">${tr.name} escreveu: “${tr.inscription}”</div>`).join('')}
      </div>`;
    }).join('');
  }
  function renderMinds(){
    const list=$('#mindsList');if(!list||!W)return;
    const rows=W.animals.map(a=>{
      const caps=[];
      const nTools=TOOL_KEYS.filter(k=>a.recipes&&a.recipes[k]).length;
      if(nTools)caps.push(`<span class="capchip gold">${nTools} ferr.</span>`);
      const nBuilds=BUILD_KEYS.filter(k=>a.recipes&&a.recipes[k]).length;
      if(nBuilds)caps.push(`<span class="capchip gold">${nBuilds} constr.</span>`);
      const nWords=Object.keys(a.lex||{}).filter(k=>/^[kv]:/.test(k)).length;
      caps.push(`<span class="capchip">${nWords} palavras</span>`);
      const nKnow=Object.keys(a.knowledge||{}).length;
      if(nKnow)caps.push(`<span class="capchip green">${nKnow} saberes</span>`);
      if(a.songs&&a.songs.length)caps.push(`<span class="capchip green">${a.songs.length} músicas</span>`);
      if(a.lessons&&a.lessons.gate)caps.push('<span class="capchip">portão</span>');
      if(a.recipes&&a.recipes.pesca)caps.push('<span class="capchip">pesca</span>');
      if(a.recipes&&a.recipes.plantacao)caps.push('<span class="capchip">plantação</span>');
      if(a.recipes&&a.recipes.poco)caps.push('<span class="capchip">poço</span>');
      if(a.research)caps.push(`<span class="capchip">${a.research} pesquisa(s)</span>`);
      const vote=a.mind&&a.mind.cands&&a.mind.cands.length?a.mind.cands.slice().sort((p,q)=>(q.s||0)-(p.s||0))[0]:null;
      return `<div class="studyRow"><div class="sname">${a.name||a.sp.label.toLowerCase()} <span class="dimtxt">(${a.sp.label}${a.tribeId?', tribo '+((W.tribes.find(t=>t.id===a.tribeId)||{}).name||'?'):''})</span></div>
        <div class="capwrap">${caps.join('')}</div>
        ${vote?`<div class="dimtxt">agora pensa em: ${(vote.k||'').replace(/:/g,' · ')} (${Math.round(Math.abs(vote.s||0)*100)})</div>`:''}
      </div>`;
    }).join('');
    list.innerHTML=`<div class="wcard"><div class="whead">como a rede decide</div><div class="wbody">Cada bicho compara até doze ideias: necessidades, memória, curiosidade, personalidade e valores próprios. A memória recente desestimula repetir escolhas sem necessidade; fome e sede urgentes continuam prioritárias. Os votos ao lado mostram a conta deste instante.</div></div>`
      +(rows||'<span class="empty">sem bichos.</span>');
  }
  function renderMusicList(){
    const list=$('#musicList');if(!list||!W)return;
    const songs=(W.songs||[]).slice().reverse();
    if(!songs.length){
      list.innerHTML='<div class="wcard"><div class="wbody">Ainda ninguém compôs. As músicas nascem das línguas das tribos: quando um bicho junta palavras e tem tempo de ócio, ele inventa uma canção de 12 notas na língua dele.</div><div class="wbody dimtxt">Use o botão “música” no topo para tocar de fundo quando existirem.</div></div>';
      return;
    }
    list.innerHTML=`<div class="wcard"><div class="whead"><span>${songs.length} música(s)</span><button id="musicPlayAll" class="${musicOn?'on':''}">${musicOn?'tocando de fundo — parar':'tocar de fundo'}</button></div></div>`+
      songs.map((s,i)=>{
        const real=W.songs.length-1-i;
        return `<div class="wcard"><div class="whead"><span>🎵 ${s.name}</span><span class="wtag">dia ${s.day}</span></div>
          <div class="wbody">${s.tribeName?'tribo <b>'+s.tribeName+'</b>':'sozinho'} · composta por ${s.byName} · palavras: ${(s.words||[]).join(' · ')}</div>
          <div class="wbody"><button data-song="${real}">ouvir</button></div></div>`;
      }).join('');
    list.querySelectorAll('button[data-song]').forEach(b=>b.addEventListener('click',()=>{
      musicOn=false;clearInterval(musicTimer);musicTimer=null;
      const bb=$('#btnMusic');if(bb){bb.classList.remove('on');bb.textContent='música'}
      playSongAt(+b.dataset.song);
    }));
    const all=$('#musicPlayAll');
    if(all)all.addEventListener('click',()=>{musicOn?stopMusic():startMusic();renderMusicList()});
  }
  function renderWolves(){
    const list=$('#wolvesList');if(!list||!W)return;
    const c=W.crisis||{};
    const raid=c.phase==='raid'||c.phase==='retreat';
    const wolves=W.wolves.filter(w=>!w.gone);
    const fears=W.animals.map(a=>({a,v:(a.fear&&a.fear.wolf)||0})).sort((p,q)=>q.v-p.v).filter(x=>x.v>.05).slice(0,8);
    const hist=(c.history||[]).slice(-5).reverse().map(h=>{
      const ds=(h.decisions||[]).map(d=>{
        const tr=W.tribes.find(t=>t.id===d.tribe);
        return `${tr?tr.name:'tribo '+d.tribe}: ${CRISIS_LABEL[d.type]||d.type}`;
      }).join(' · ');
      return `<div class="wbody">dia ${h.day} — ${ds||'nada'}${h.stolen?` · levaram ${h.stolen}`:''}</div>`;
    }).join('');
    list.innerHTML=`<div class="wcard wolfCard"><div class="whead"><span>${raid?'⚔️ ataque em andamento':(W.wolfEvery>0)?'🐺 a alcateia espera':'sem lobos neste mundo'}</span><span class="wtag">${wolves.length} lobo(s)</span></div>
      <div class="wbody">${raid?`próximo ataque: agora · fase ${c.phase}`:(W.wolfEvery>0?`próximo ataque no dia ${c.nextDay||'?'} (faltam ${Math.max(0,(c.nextDay||0)-dayNum())} dia(s))`:'a alcateia não volta mais.')}</div>
      ${wolves.map((w,i)=>`<div class="wolfRow"><span>lobo ${i+1}</span><span class="wbar"><i style="width:${Math.round(clamp((w.hp||7)/7)*100)}%"></i></span><span class="wtag">${w.state}</span></div>`).join('')}
      ${fears.length?`<div class="wbody">quem mais teme: ${fears.map(x=>`${x.a.name||x.a.sp.label.toLowerCase()} (${Math.round(x.v*100)}%)`).join(' · ')}</div>`:''}
      ${hist?`<div class="dimtxt" style="margin-top:6px">últimas decisões das tribos:</div>${hist}`:''}
    </div>`;
  }
  function renderCritters(){
    const list=$('#crittersList');if(!list||!W)return;
    const cap=Math.max(W.animalCap||80,W.animals.length), every=W.arriveEvery||0;
    const equipped=W.animals.filter(a=>a.hands&&a.hands.length);
    const counts={};
    for(const a of equipped)for(const k of a.hands)counts[k]=(counts[k]||0)+1;
    const countStr=Object.keys(counts).map(k=>`<span class="toolchip hand">${K[k]?K[k].g:k} ×${counts[k]}</span>`).join('')||'<span class="empty">ninguém carrega nada.</span>';
    const spCount={};
    for(const a of W.animals)spCount[a.spk]=(spCount[a.spk]||0)+1;
    const spStr=Object.keys(spCount).sort((p,q)=>spCount[q]-spCount[p]).slice(0,14).map(k=>`${SP[k]?SP[k].label.toLowerCase():k} ${spCount[k]}`).join(' · ');
    const rows=equipped.slice().sort((p,q)=>q.hands.length-p.hands.length).map(a=>{
      const tr=tribeOfName(a);
      return `<div class="eqRow"><span class="who" data-aid="${a.id}">${a.name||a.sp.label.toLowerCase()}</span><span class="items">${a.hands.map(k=>`<span class="toolchip hand">${K[k]?K[k].g:k}</span>`).join('')}</span><span class="cult">${tr?tr.culture.label:''}</span></div>`;
    }).join('');
    const sel=selectedId?W.animals.find(a=>a.id===selectedId):null;
    let rel='';
    if(sel&&sel.opinion){
      const rr=Object.keys(sel.opinion).map(id=>({a:W.animals.find(x=>x.id===+id),v:sel.opinion[id].v,t:sel.opinion[id].t}))
        .filter(x=>x.a).sort((p,q)=>Math.abs(q.v)-Math.abs(p.v)).slice(0,6);
      if(rr.length)rel=`<div class="relList">${rr.map(x=>{
        const label=x.v>.45?'amigo':x.v<-.45?'inimigo':x.v>=0?'simpatia':'desconfiança';
        return `<div class="relRow"><span class="rn">${x.a.name||x.a.sp.label.toLowerCase()}</span><span class="rv ${x.v>=0?'f':'r'}">${label} · ${Math.round(Math.abs(x.v)*100)}%</span></div>`;
      }).join('')}</div>`;
    }
    list.innerHTML=`<div class="wcard"><div class="whead"><span>bichos da floresta</span><span class="wtag"><b class="critCount">${W.animals.length}</b> / ${cap}</span></div>
      <div class="wbody">${spStr}</div>
      <div class="arriveForm">a cada <input id="arriveEveryIn" type="number" min="0" max="60" value="${every}"> dia(s) vem um bicho novo · limite <input id="animalCapIn" type="number" min="4" max="200" value="${cap}"> <button id="arriveApply">aplicar</button></div>
      <div class="dimtxt">${every>0?`próxima chegada no dia ${W.arriveNext||'?'} · ${W.arrivals||0} já chegaram.`:'mundo fechado: não nascem bichos novos. Defina 0 para fechar.'} A chegada respeita o limite e o ambiente (bicho de deserto só nasce no deserto).</div>
    </div>
    <div class="wcard"><div class="whead"><span>quem está com o quê</span><span class="wtag">${equipped.length} equipado(s)</span></div>
      <div class="wbody" style="display:flex;flex-wrap:wrap;gap:4px">${countStr}</div>
      ${rows||'<div class="wbody empty">nada equipado ainda. Armaduras e roupas saem tingidas com a cor da cultura de cada tribo no mundo 3D.</div>'}
    </div>
    <div class="wcard"><div class="whead"><span>cultura e relações</span><span class="wtag">${sel?(sel.name||sel.sp.label.toLowerCase()):'selecione um bicho'}</span></div>
      <div class="wbody">${W.tribes.map(tr=>`<span class="capchip gold">${tr.name}: ${tr.culture?tr.culture.label:'?'} — armadura ${tr.culture?tr.culture.label:'?'}</span>`).join(' ')||'<span class="empty">sem tribos.</span>'}</div>
      ${rel||'<div class="wbody empty">selecione um bicho no painel da esquerda para ver quem ele gosta ou evita.</div>'}
    </div>`;
    const apply=$('#arriveApply');
    if(apply)apply.addEventListener('click',()=>{
      const ev=clamp(parseInt($('#arriveEveryIn').value,10)||0,0,60);
      const cp=clamp(parseInt($('#animalCapIn').value,10)||80,W.animals.length,200);
      W.arriveEvery=ev;W.animalCap=cp;
      if(typeof CFG!=='undefined'&&CFG){CFG.arriveEvery=ev;CFG.animalCap=cp;saveCfg(CFG)}
      W.arriveNext=ev>0?dayNum()+ev:1e9;
      toast(ev>0?`Chegadas ligadas: um bicho a cada ${ev} dia(s), até ${cp}.`:'Mundo fechado: não chegam mais bichos.');
      if(typeof saveNow==='function')saveNow(true);
      renderCritters();
    });
    list.querySelectorAll('.who[data-aid]').forEach(el=>el.addEventListener('click',()=>{
      select(+el.dataset.aid);closeCodex();toast('Selecionado: '+(animal()&&animal().name||'bicho'));
    }));
  }

  const UI={
    bindWorld:w=>{
      bound=true;selectedId=w.animals[0]?w.animals[0].id:null;
      if(musicOn)stopMusic();
      evLog.length=0;
      for(const e of w.events.slice(-MAX_EV))evLog.unshift(e);
      renderEvents();
      buildRoster();updateCards();
      if(V)V.selectAnimal(selectedId);
      renderDetail(animal());
    },
    select,
    refresh:()=>{if(!bound)return;updateCards();const a=animal();if(a){
      dSub.innerHTML=`<span>${statusOf(a)}</span><span>${Math.floor(a.age/60)<1?'recém-acordado':Math.floor(a.age/60)+' min de vida'}</span><span>${a.exp} experiências</span>`;
      renderWish(a);renderSelf(a);renderMood(a);renderHands(a);renderIdeas(a);renderMem(a);renderInvent(a);renderLex(a);renderWeb(a);renderTools(a);renderTribe(a);renderRelationships(a);renderActions(a);
      renderGear(a);renderMusic(a);renderMind(a);renderRuinsSel(a);
    }renderLangs();if(codexOpen)renderCodex();},
    onEvent:e=>{pushTicker(e)},
    onThought:(a,e)=>{if(a.id===selectedId)renderThoughts(a)},
    onLex:a=>{if(a.id===selectedId)renderLex(a);updateCards()},
    onMem:a=>{if(a.id===selectedId){renderMem(a);renderMind(a)}},
    onResearch:a=>{
      if(a&&a.id===selectedId)renderWeb(a);
      const active=codex.querySelector('#codexTabs button.on');
      if(codexOpen&&active&&active.dataset.tab==='studies')renderStudies();
      if(computerOpen)renderComputer(computerApp);
    },
    onInvent:a=>{if(a.id===selectedId){renderInvent(a);renderTools(a)}},
    onWish:a=>{if(a.id===selectedId)renderWish(a)},
    onSelf:a=>{if(a.id===selectedId){renderSelf(a);renderActions(a)}},
    onTribe:tr=>{
      if(!bound)return;
      updateCards();const a=animal();
      renderTribe(a);renderRelationships(a);renderLangs();
      if(codexOpen)renderCodex();
    },
    onSong:song=>{
      if(!bound)return;
      if(musicOn&&W&&W.songs&&W.songs.length===1)playSongAt(0);
      if(codexOpen)renderCodex();
    },
    onAnimals:()=>{
      if(!bound)return;
      buildRoster();updateCards();
      const a=animal();
      if(!a&&W.animals.length)select(W.animals[0].id);
      else{renderDetail(a)}
      renderLangs();
      if(codexOpen)renderCodex();
    },
    onMural:kind=>{if(codexOpen&&kind===activeBoard)drawBoard(kind)},
    onComputer:()=>renderComputer(computerApp),
    openCodex,closeCodex,openGallery,openComputer,closeComputer,
    clock:()=>{
      if(!W)return;
      dayLabel.textContent='Dia '+dayNum();
      clockLabel.textContent=clockStr();
      const c=W.crisis;
      const raid=c&&(c.phase==='raid'||c.phase==='retreat');
      crisisLabel.classList.toggle('on',!!(raid||(c&&c.phase==='none')));
      crisisLabel.classList.toggle('raid',!!raid);
      if(raid)crisisLabel.textContent=`🐺 ${W.wolves.length} lobo(s) ${c.phase==='raid'?'saqueando':'indo embora'}`;
      else if(c&&c.phase==='none'){
        if((W.wolfEvery||0)<=0)crisisLabel.textContent='sem lobos';
        else{const n=(c.nextDay||0)-dayNum();crisisLabel.textContent=n>0?`lobos em ${n} dia(s)`:'lobos chegando'}
      }else crisisLabel.textContent='';
      const wk=W.weather&&W.weather.kind;
      let w=W.rain>0?'chovendo':(daylight()<.22?'noite':'céu limpo');
      if(wk&&wk!=='limpo')w=wk;
      weatherLabel.textContent=w+((W.snow||0)>.35?' · nevando':'')+((W.flood||0)>.3?' · cheia no pantanal':'');
    },
    saveInfo:txt=>{saveInfo.textContent=txt},
    toast,
    toggleMusic,
    selectedId:()=>selectedId,
    togglePanels:()=>hudMenu.classList.toggle('hide'),
  };
  return UI;
}
