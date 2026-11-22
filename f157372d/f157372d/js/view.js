'use strict';
/* ============================================================
   FLORESTA — visão 3D (three.js r128)
   ============================================================ */

function initView(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.setSize(innerWidth,innerHeight,false);
  renderer.outputEncoding=THREE.sRGBEncoding;

  const scene=new THREE.Scene();
  scene.fog=new THREE.Fog(0x9fc0d8,170,560);
  const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,960);

  const hemi=new THREE.HemisphereLight(0xcfe3f2,0x2c261a,.72);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff0d4,.9);sun.position.set(32,52,20);scene.add(sun);
  const fill=new THREE.DirectionalLight(0x8090b0,.16);fill.position.set(-30,20,-40);scene.add(fill);

  const worldG=new THREE.Group();scene.add(worldG);
  const terrainG=new THREE.Group();worldG.add(terrainG);
  const waterG=new THREE.Group();worldG.add(waterG);
  const thingsG=new THREE.Group();worldG.add(thingsG);
  const animalsG=new THREE.Group();worldG.add(animalsG);
  const wolvesG=new THREE.Group();worldG.add(wolvesG);
  const fxG=new THREE.Group();worldG.add(fxG);
  const rainG=new THREE.Group();worldG.add(rainG);
  let snowG=null;

  /* ---------- materiais compartilhados ---------- */
  const M=(c,extra)=>new THREE.MeshLambertMaterial(Object.assign({color:c},extra||{}));
  const MAT={
    trunk:M(0x6b4a2f),trunkDark:M(0x3f2d1d),bark:M(0x7a5230),
    leafA:M(0x2f5f2c),leafB:M(0x3b6f36),leafC:M(0x275224),leafD:M(0x477a3a),
    bush:M(0x2b5a28),berry:M(0xc23b32),
    mushStem:M(0xe4d8bd),mushBrown:M(0x8a6238),mushRed:M(0xb8432f),mushDark:M(0x4c3a2a),
    wood:M(0x8a6338),woodDark:M(0x5c3f24),
    stone:M(0x8d9298),stoneDark:M(0x6e747a),
    leaf:M(0x6aa04e),mud:M(0x5b4128),mudWet:M(0x46331f),
    dirt:M(0x7a5a3a),cub:M(0x9a7448),
    metal:M(0xb9c0c6),
    water:M(0x4a86a8),hole:M(0x1a1410),crop:M(0x5f9a3e),berry:M(0xc23b3b),
    root:M(0xb08a58),worm:M(0xd8a0a0),
    fire:M(0xff7a26),fire2:M(0xffc23e),char:M(0x2b2620),
    ember:M(0xff5a1e),
    pine:M(0x1d4726),pine2:M(0x2a5a30),mgLeaf:M(0x33663a),
    grass:M(0x5f8f3c),fern:M(0x3f7a3a),
    petalPink:M(0xd98ab4),petalYellow:M(0xe8cf6a),petalWhite:M(0xf0ead6),petalViolet:M(0xb79bea),
    flowerCenter:M(0xc9a23a),
    desk:M(0x5a4030),plastic:M(0x24272b),plastic2:M(0x3a3f45),lightMetal:M(0x9aa4ac),
    crystal:new THREE.MeshLambertMaterial({color:0x8fd8ff,emissive:0x1d4a66}),
    rockDark:M(0x4c5054),rock:M(0x666b70),
    hole:new THREE.MeshBasicMaterial({color:0x0b0a08}),
    bronze:new THREE.MeshLambertMaterial({color:0xc9a24a,emissive:0x2a1c05}),
    cactus:M(0x4d7a3a),cactus2:M(0x6a9a4a),bone:M(0xe6ddc8),desertFlower:new THREE.MeshLambertMaterial({color:0xe08aa8,emissive:0x2a0a12}),
  };
  const CULTURE_COL={fogo:0xe0715f,agua:0x7cb6e8,pedra:0x9aa0a6,lua:0xd9d4a8,floresta:0x8fd39a,lobo:0xb7b2a8};
  MAT.leafA.side=THREE.DoubleSide;
  const GEO={
    sphere:new THREE.SphereGeometry(1,10,8),
    sphereLo:new THREE.SphereGeometry(1,7,6),
    cyl:new THREE.CylinderGeometry(.5,.5,1,7),
    cylTaper:new THREE.CylinderGeometry(.25,.5,1,7),
    cone:new THREE.ConeGeometry(1,1,7),
    box:new THREE.BoxGeometry(1,1,1),
    dode:new THREE.DodecahedronGeometry(1,0),
    torus:new THREE.TorusGeometry(1,.16,6,16),
    disc:new THREE.CircleGeometry(1,14),
  };
  function part(geo,mat,sx,sy,sz,x,y,z,parent){
    const m=new THREE.Mesh(geo,mat);
    m.scale.set(sx,sy,sz);m.position.set(x||0,y||0,z||0);
    parent.add(m);return m;
  }
  function grp(){return new THREE.Group()}

  /* ---------- terreno ---------- */
  let terrGN=0,NV=0,terrPos=null,terrCol=null,terrIdx=null;
  let terrGeo=new THREE.BufferGeometry(),terrMesh=null;
  function ensureTerrainBuffers(){
    if(terrGN===GN&&terrPos)return;
    terrGN=GN;NV=GN*GN*4;
    terrPos=new Float32Array(NV*3);
    terrCol=new Float32Array(NV*3);
    terrIdx=new Uint32Array(GN*GN*6);
    if(terrMesh){terrainG.remove(terrMesh);terrMesh.geometry.dispose();terrainG.clear()}
    terrGeo=new THREE.BufferGeometry();
  }
  const colorTmp=new THREE.Color();
  function cellColor(c,out){
    const sh=.84+c.sh*.28;
    if(c.st===4){out.setRGB(.05,.115,.10);return}
    if(c.st===1){const f=.72+Math.random()*.28;out.setRGB(.82*f,.33*f,.07*f);return}
    if(c.st===2){const v=.10+c.sh*.035;out.setRGB(v,v*.92,v*.78);return}
    if(c.st===3){out.setRGB(.31*sh,.23*sh,.14*sh);return}
    const bm=c.bm||0;
    if(bm===1)out.setRGB(.155+.055*sh,.16+.05*sh,.055+.025*sh);
    else if(bm===2)out.setRGB(.055+.03*sh,.125+.05*sh,.05+.025*sh);
    else if(bm===3)out.setRGB(.15+.055*sh,.145+.05*sh,.12+.045*sh);
    else if(bm===4)out.setRGB(.04+.028*sh,.10+.05*sh,.075+.04*sh);
    else if(bm===5)out.setRGB(.13+.05*sh,.15+.06*sh,.07+.03*sh);
    else if(bm===6)out.setRGB(.055+.03*sh,.09+.04*sh,.05+.025*sh);
    else if(bm===7){const v=.2+.075*sh;out.setRGB(v,v*.99,v*.97);if(c.h>9)out.lerp(new THREE.Color(.86,.88,.9),Math.min(1,(c.h-9)/5)*.7)}
    else if(bm===8)out.setRGB(.42+.11*sh,.33+.09*sh,.16+.05*sh);
    else if(bm===9)out.setRGB(.235+.065*sh,.245+.06*sh,.095+.035*sh);
    else out.setRGB((.085+.05*sh),(.20+.075*sh),(.085+.045*sh));
    if(c.h>1.2&&bm!==3&&bm!==7)out.lerp(new THREE.Color(.17,.26,.12),.35);
    if(c.h<-.6)out.lerp(new THREE.Color(.18,.24,.11),.3);
    if(c.f<.25&&bm!==1&&bm!==8)out.lerp(new THREE.Color(.28,.25,.13),.35);
    if(W&&W.snow>0)out.lerp(new THREE.Color(.86,.9,.94),Math.min(.8,W.snow*.85));
  }
  function buildTerrain(){
    if(terrMesh&&terrGN===GN)return;
    ensureTerrainBuffers();
    let vi=0,ii=0;
    const H=(x,z)=>hgt(x,z);
    for(let iy=0;iy<GN;iy++)for(let ix=0;ix<GN;ix++){
      const c=W.cells[iy*GN+ix];
      const x0=-HALF+ix*CELL,x1=x0+CELL,z0=-HALF+iy*CELL,z1=z0+CELL;
      const base=vi;
      const pts=[[x0,z0],[x1,z0],[x0,z1],[x1,z1]];
      for(const [px,pz] of pts){
        const vy=H(px,pz)-.02;
        terrPos[vi*3]=px;terrPos[vi*3+1]=vy;terrPos[vi*3+2]=pz;
        let nearWater=false;
        for(const p of PONDS)if(Math.hypot(px-p.x,pz-p.z)<p.r*1.7){nearWater=true;break}
        if(!nearWater&&riverDist(px,pz)<RIVER.width+6)nearWater=true;
        if(nearWater&&vy<WATER_Y-.2)colorTmp.setRGB(.05,.115,.10);
        else if(nearWater&&vy<WATER_Y+.3)colorTmp.setRGB(.27,.22,.14);
        else cellColor(c,colorTmp);
        terrCol[vi*3]=colorTmp.r;terrCol[vi*3+1]=colorTmp.g;terrCol[vi*3+2]=colorTmp.b;
        vi++;
      }
      terrIdx[ii++]=base;terrIdx[ii++]=base+2;terrIdx[ii++]=base+1;
      terrIdx[ii++]=base+1;terrIdx[ii++]=base+2;terrIdx[ii++]=base+3;
    }
    terrGeo.setAttribute('position',new THREE.BufferAttribute(terrPos,3));
    terrGeo.setAttribute('color',new THREE.BufferAttribute(terrCol,3));
    terrGeo.setIndex(new THREE.BufferAttribute(terrIdx,1));
    terrGeo.computeVertexNormals();
    const mat=new THREE.MeshLambertMaterial({vertexColors:true});
    const mesh=new THREE.Mesh(terrGeo,mat);
    mesh.name='terrain';terrainG.add(mesh);terrMesh=mesh;
  }
  const cellVert=ix=>((ix>=0&&ix<GN)?1:0);
  function paintCell(c){
    if(!terrMesh||terrGN!==GN)return;
    const i=(c.iy*GN+c.ix)*4;
    cellColor(c,colorTmp);
    for(let k=0;k<4;k++){terrCol[(i+k)*3]=colorTmp.r;terrCol[(i+k)*3+1]=colorTmp.g;terrCol[(i+k)*3+2]=colorTmp.b;}
    terrGeo.attributes.color.needsUpdate=true;
  }
  function paintAll(){
    for(const c of W.cells)paintCell(c);
  }

  function buildWater(){
    while(waterG.children.length)waterG.remove(waterG.children[0]);
    for(const p of PONDS){
      const g=new THREE.Mesh(new THREE.CircleGeometry(p.r*.99,40),
        new THREE.MeshPhongMaterial({color:0x16405a,transparent:true,opacity:.92,shininess:120,specular:0x8fd0ff}));
      g.rotation.x=-Math.PI/2;g.position.set(p.x,WATER_Y-.23,p.z);
      if(p.marsh){g.userData.marsh=true;g.userData.baseR=p.r}
      waterG.add(g);
    }
    // rio
    const N=Math.ceil((HALF*2-10)/2),z0=-HALF+5,z1=HALF-5;
    const pos=[],idx=[];
    for(let i=0;i<=N;i++){
      const z=z0+(z1-z0)*i/N,x=riverX(z);
      pos.push(x-RIVER.width*.98,WATER_Y-.16,z, x+RIVER.width*.98,WATER_Y-.16,z);
    }
    for(let i=0;i<N;i++){const a=i*2;idx.push(a,a+2,a+1, a+1,a+2,a+3)}
    const rgeo=new THREE.BufferGeometry();
    rgeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));
    rgeo.setIndex(idx);rgeo.computeVertexNormals();
    const rmesh=new THREE.Mesh(rgeo,new THREE.MeshPhongMaterial({color:0x16405a,transparent:true,opacity:.92,shininess:130,specular:0x8fd0ff,side:THREE.DoubleSide}));
    waterG.add(rmesh);
    // cachoeira
    const wx=riverX(WATERFALL.z);
    const fallMat=new THREE.MeshBasicMaterial({color:0xdff3ff,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false});
    const fall=new THREE.Mesh(new THREE.PlaneGeometry(RIVER.width*1.9,4.6),fallMat);
    fall.position.set(wx,WATER_Y+1.5,WATERFALL.z);fall.userData.fall=true;
    waterG.add(fall);
    const foamMat=new THREE.MeshBasicMaterial({color:0xeafcff,transparent:true,opacity:.7,depthWrite:false});
    const foam=new THREE.Mesh(new THREE.CircleGeometry(RIVER.width*1.25,20),foamMat);
    foam.rotation.x=-Math.PI/2;foam.position.set(wx,WATER_Y-.05,WATERFALL.z+1.6);
    waterG.add(foam);
    for(let i=0;i<2;i++){
      const L=new THREE.Mesh(new THREE.BoxGeometry(RIVER.width*1.9,.8,1.1),M(0x5d5a4e));
      L.position.set(wx,WATER_Y-.7+i*1.35,WATERFALL.z-.4-i*.2);waterG.add(L);
    }
  }

  /* ---------- construtores de coisas ---------- */
  const TREE_MATS=[MAT.leafA,MAT.leafB,MAT.leafC,MAT.leafD];
  let screenTex=null;
  function makeScreen(){
    if(screenTex)return screenTex;
    const c=document.createElement('canvas');c.width=256;c.height=160;
    const x=c.getContext('2d');
    x.fillStyle='#07131b';x.fillRect(0,0,256,160);
    x.fillStyle='#0d2b3a';x.fillRect(0,0,256,22);
    x.fillStyle='#8fe3c0';x.font='bold 12px Consolas, monospace';x.fillText('FLORESTA OS  v0.3',8,15);
    x.font='10px Consolas, monospace';
    const lines=['> bichos: 7','> bioma: floresta','> rio: online','> nomes: aprendendo','> invencoes: ...','> curiosidade: 87%'];
    lines.forEach((s,i)=>{x.fillStyle=i===2?'#7cb6e8':'#6fbf95';x.fillText(s,10,42+i*15)});
    x.fillStyle='#0d2b3a';x.fillRect(8,132,120,14);
    x.fillStyle='#8fe3c0';x.fillRect(10,134,70,10);
    x.fillStyle='#2e4a52';x.fillRect(160,36,84,60);
    x.strokeStyle='#3f7a5a';x.strokeRect(160,36,84,60);
    screenTex=new THREE.CanvasTexture(c);screenTex.minFilter=THREE.LinearFilter;
    return screenTex;
  }
  const boardViews={};
  function makeBoard(kind){
    kind=kind==='quadro'?'quadro':'mural';
    if(boardViews[kind])return boardViews[kind];
    const c=document.createElement('canvas');c.width=512;c.height=288;
    const x=c.getContext('2d');
    const tex=new THREE.CanvasTexture(c);tex.minFilter=THREE.LinearFilter;
    const COLORS=['#eaf2e8','#f2cf75','#eb9384','#a8d8b0','#a9cbee','#d9b8f5'];
    function redraw(){
      x.fillStyle='#26302a';x.fillRect(0,0,512,288);
      x.strokeStyle='#1b231e';x.lineWidth=8;x.strokeRect(4,4,504,280);
      const ms=(W&&W[kind]&&W[kind].marks)||[];
      for(const m of ms){
        const col=COLORS[(m.col||0)%COLORS.length];
        x.strokeStyle=col;x.fillStyle=col;
        if(m.type==='shape'&&m.strokes){
          x.lineWidth=m.w||4;x.lineCap='round';x.lineJoin='round';
          for(const pts of m.strokes){x.beginPath();pts.forEach(([u,v],i)=>{if(i)x.lineTo(u*512,v*288);else x.moveTo(u*512,v*288)});x.stroke()}
        }else if(m.type==='word'&&m.txt){
          x.save();x.translate((m.x||.5)*512,(m.y||.5)*288);x.rotate(m.rot||0);
          x.font='italic 700 '+(m.size||28)+'px "Segoe UI", sans-serif';
          x.textAlign='center';x.textBaseline='middle';
          x.globalAlpha=.92;x.fillText(m.txt,0,0);x.restore();x.globalAlpha=1;
        }
      }
      tex.needsUpdate=true;
    }
    boardViews[kind]={redraw,tex};
    return boardViews[kind];
  }
  function buildThing(t){
    const g=grp();
    const d=t.data||{};
    switch(t.kind){      case 'arvore':{
        const sc=d.sc||1;
        if(d.mg){
          // manguezal: raízes em arco na lama, copa larga
          part(GEO.cylTaper,MAT.trunkDark,.16*sc,1.5*sc,.16*sc,0,.75*sc,0,g);
          for(let i=0;i<6;i++){
            const a=i*TAU/6+.3;
            const r=part(GEO.cyl,MAT.bark,.05*sc,1.15*sc,.05*sc,Math.cos(a)*.34*sc,.5*sc,Math.sin(a)*.34*sc,g);
            r.rotation.z=Math.cos(a)*.62;r.rotation.x=-Math.sin(a)*.62;
          }
          const m=MAT.mgLeaf||MAT.leafDark||MAT.pine;
          part(GEO.sphere,m,1.45*sc,.5*sc,1.45*sc,0,1.75*sc,0,g);
          part(GEO.sphere,m,1.05*sc,.42*sc,1.05*sc,.5*sc,1.95*sc,.35*sc,g);
          part(GEO.sphere,m,.9*sc,.38*sc,.9*sc,-.45*sc,1.85*sc,-.3*sc,g);
          break;
        }
        if(d.charred){
          part(GEO.cylTaper,MAT.trunkDark,.34*sc,1.6*sc,.34*sc,0,.8*sc,0,g);
          part(GEO.cyl,MAT.char,.06,1.1,.06,.1,1.9,.06,g);
          part(GEO.cyl,MAT.char,.05,.8,.05,-.2,1.6,.1,g).rotation.z=.6;
        }else{
          part(GEO.cylTaper,MAT.trunk,.32*sc,1.5*sc,.32*sc,0,.75*sc,0,g);
          if(d.br>0){
            const m=TREE_MATS[(t.id*7)%4];
            part(GEO.cone,m,1.5*sc,1.5*sc,1.5*sc,0,2.05*sc,0,g);
            part(GEO.cone,m,1.15*sc,1.3*sc,1.15*sc,0,2.8*sc,0,g).rotation.y=.5;
            part(GEO.cone,m,.8*sc,1.1*sc,.8*sc,0,3.5*sc,0,g).rotation.y=1;
          }else{
            part(GEO.cyl,MAT.bark,.1*sc,.9*sc,.1*sc,.25*sc,1.75*sc,.15*sc,g).rotation.z=.9;
          }
        }
        break;
      }
      case 'pinheiro':{
        const sc=d.sc||1;
        part(GEO.cylTaper,MAT.trunkDark,.26*sc,2.1*sc,.26*sc,0,1.05*sc,0,g);
        part(GEO.cone,MAT.pine,1.2*sc,1.8*sc,1.2*sc,0,2.5*sc,0,g);
        part(GEO.cone,MAT.pine2,.98*sc,1.55*sc,.98*sc,0,3.25*sc,0,g).rotation.y=.4;
        part(GEO.cone,MAT.pine,.72*sc,1.25*sc,.72*sc,0,3.95*sc,0,g).rotation.y=.9;
        break;
      }
      case 'pinha':{
        part(GEO.sphere,MAT.mushBrown,.09,.11,.09,0,.1,0,g);
        part(GEO.cone,MAT.trunkDark,.05,.1,.05,0,.19,0,g);
        break;}
      case 'flor':{
        const cols=[MAT.petalPink,MAT.petalYellow,MAT.petalWhite,MAT.petalViolet];
        const pm=cols[t.id%4];
        part(GEO.cyl,MAT.grass,.018,.22,.018,0,.11,0,g);
        part(GEO.sphere,MAT.flowerCenter,.05,.04,.05,0,.24,0,g);
        for(let i=0;i<5;i++){const a=i*TAU/5;part(GEO.sphere,pm,.06,.035,.06,Math.cos(a)*.08,.24,Math.sin(a)*.08,g)}
        break;}
      case 'capim':{
        for(let i=0;i<5;i++){const a=i*1.31;const m=part(GEO.cyl,MAT.grass,.016,.3,.016,Math.cos(a)*.06,.15,Math.sin(a)*.06,g);m.rotation.z=(i%2?1:-1)*.28;m.rotation.x=Math.sin(a)*.2}
        break;}
      case 'junco':{
        for(let i=0;i<6;i++){const a=i*1.07;const m=part(GEO.cyl,MAT.grass,.022,.7,.022,Math.cos(a)*.07,.35,Math.sin(a)*.07,g);m.rotation.z=(i%2?1:-1)*.18}
        part(GEO.sphere,MAT.mudWet,.16,.05,.16,0,.03,0,g);
        break;}
      case 'cacto':{
        const sc=d.sc||1;
        part(GEO.cyl,MAT.cactus,.13*sc,.8*sc,.13*sc,0,.4*sc,0,g);
        for(const [sx,sy,rot] of [[.17,.62,-1.05],[-.16,.5,1.1]]){
          const arm=part(GEO.cyl,MAT.cactus,.065*sc,.3*sc,.065*sc,sx*sc,sy*sc,.02,g);arm.rotation.z=rot;
          part(GEO.cyl,MAT.cactus,.06*sc,.26*sc,.06*sc,(sx<0?-.26:.27)*sc,(sy+.22)*sc,0,g);
        }
        for(let i=0;i<8;i++){const a=i*1.7;part(GEO.cone,MAT.cactus2,.012,.05,.012,Math.cos(a)*.125*sc,(.3+i*.07)*sc,Math.sin(a)*.125*sc,g).rotation.z=Math.cos(a)*.5}
        part(GEO.sphere,MAT.desertFlower,.055,.045,.055,0,.84*sc,0,g);
        break;}
      case 'osso':{
        const b=part(GEO.cyl,MAT.bone,.032,.5,.032,0,.05,0,g);b.rotation.z=Math.PI/2;b.rotation.y=.3;
        for(const sx of [-1,1]){part(GEO.sphere,MAT.bone,.055,.045,.045,sx*.25,.05,sx*.03,g);part(GEO.sphere,MAT.bone,.05,.04,.045,sx*.27,.09,-sx*.03,g)}
        break;}
      case 'flor_deserto':{
        part(GEO.cyl,MAT.grass,.012,.18,.012,0,.09,0,g);
        for(let i=0;i<6;i++){const a=i*TAU/6;part(GEO.sphere,MAT.desertFlower,.055,.028,.055,Math.cos(a)*.07,.2,Math.sin(a)*.07,g)}
        part(GEO.sphere,MAT.flowerCenter,.04,.03,.04,0,.21,0,g);
        break;}
      case 'peixe':{
        const fm=new THREE.MeshLambertMaterial({color:0x9fb6c4});
        part(GEO.sphere,fm,.16,.1,.26,0,.05,0,g);
        const tail=part(GEO.cone,fm,.08,.16,.05,0,.05,-.28,g);tail.rotation.x=Math.PI/2;
        part(GEO.sphere,new THREE.MeshBasicMaterial({color:0x0e1c24}),.03,.03,.03,-.07,.08,.2,g);
        g.userData.fish=true;g.userData.ph=d.ph||0;
        break;}
      case 'fruta':{
        part(GEO.sphere,new THREE.MeshLambertMaterial({color:0xd8663a}),.13,.13,.13,0,.14,0,g);
        part(GEO.sphere,MAT.leaf,.1,.02,.06,0,.25,0,g).rotation.z=.4;
        break;}
      case 'vitoria':{
        const m=part(GEO.disc,new THREE.MeshLambertMaterial({color:0x3e7a3e,side:THREE.DoubleSide}),.42,.42,.42,0,.02,0,g);
        m.rotation.x=-Math.PI/2;
        part(GEO.sphere,MAT.petalPink,.07,.04,.07,0,.06,0,g);
        break;}
      case 'samambaia':{
        for(let i=0;i<7;i++){const a=i*TAU/7;const m=part(GEO.sphereLo,MAT.fern,.3,.05,.09,Math.cos(a)*.22,.22,Math.sin(a)*.22,g);m.rotation.y=-a;m.rotation.z=.25}
        break;}
      case 'computador':{
        part(GEO.box,MAT.desk,2.0,.12,.95,0,.86,0,g);
        for(const [lx,lz] of [[-.85,.3],[.85,.3],[-.85,-.3],[.85,-.3]])part(GEO.box,MAT.woodDark,.08,.8,.08,lx,.4,lz,g);
        part(GEO.box,MAT.plastic,.5,.9,.45,1.15,.45,-.1,g);
        part(GEO.box,MAT.plastic2,.08,.5,.05,1.15,.55,.13,g);
        part(GEO.box,MAT.plastic,.12,.3,.12,0,1.08,-.2,g);
        const mon=part(GEO.box,MAT.plastic,1.5,.95,.1,0,1.55,-.18,g);mon.rotation.x=-.06;
        const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.34,.82),new THREE.MeshBasicMaterial({map:makeScreen()}));
        screen.position.set(0,1.55,-.12);screen.rotation.x=-.06;g.add(screen);
        const kb=part(GEO.box,MAT.plastic2,.95,.06,.34,0,.95,.32,g);kb.rotation.x=.06;
        part(GEO.box,MAT.plastic,.16,.06,.24,.72,.95,.32,g);
        const L=new THREE.PointLight(0x8fd8ff,.9,9,2);L.position.set(0,1.7,.5);g.add(L);
        g.userData.screen=screen;
        break;}
      case 'mural':{
        part(GEO.box,MAT.woodDark,.16,2.45,.16,-1.72,1.22,0,g);
        part(GEO.box,MAT.woodDark,.16,2.45,.16,1.72,1.22,0,g);
        part(GEO.box,MAT.desk,3.7,2.05,.16,0,1.85,0,g);
        part(GEO.box,MAT.woodDark,3.85,.1,.3,0,2.92,0,g);
        part(GEO.box,MAT.woodDark,3.3,.07,.24,0,.84,.09,g);
        const board=makeBoard('mural');
        const face=new THREE.Mesh(new THREE.PlaneGeometry(3.35,1.8),new THREE.MeshBasicMaterial({map:board.tex}));
        face.position.set(0,1.85,.085);g.add(face);
        board.redraw();
        g.userData.boardKind='mural';
        break;}
      case 'quadro':{
        for(const sx of [-1,1]){
          const leg=part(GEO.cyl,MAT.woodDark,.06,2.1,.06,sx*.85,.95,-.05,g);leg.rotation.z=sx*.16;
          const leg2=part(GEO.cyl,MAT.woodDark,.05,1.7,.05,sx*.62,.85,-.42,g);leg2.rotation.x=.4;
        }
        part(GEO.box,MAT.wood,2.2,1.45,.09,0,1.55,0,g);
        const qb=makeBoard('quadro');
        const qface=new THREE.Mesh(new THREE.PlaneGeometry(1.98,1.24),new THREE.MeshBasicMaterial({map:qb.tex}));
        qface.position.set(0,1.56,.055);g.add(qface);
        part(GEO.box,MAT.woodDark,2.35,.07,.16,0,.86,.02,g);
        qb.redraw();
        g.userData.boardKind='quadro';
        break;}
      case 'bagre':{
        const bm=new THREE.MeshLambertMaterial({color:0x5a5a44});
        part(GEO.sphere,bm,.2,.1,.34,0,.06,0,g);
        part(GEO.sphere,bm,.16,.08,.2,0,.09,.16,g);
        const tail=part(GEO.cone,bm,.1,.2,.06,0,.06,-.34,g);tail.rotation.x=Math.PI/2;
        for(const sx of [-1,1])for(let i=0;i<2;i++){const w=part(GEO.cyl,new THREE.MeshLambertMaterial({color:0x3d3d30}),.01,.2,.01,sx*.05,.05,.32+i*.03,g);w.rotation.z=sx*1.1;w.rotation.x=-.5}
        part(GEO.sphere,MAT.hole,.015,.015,.015,-.07,.1,.24,g);
        part(GEO.sphere,MAT.hole,.015,.015,.015,.07,.1,.24,g);
        g.userData.fish=true;g.userData.ph=t.id;
        break;}
      case 'couro':{
        const m=part(GEO.disc,new THREE.MeshLambertMaterial({color:0xa87a4a,side:THREE.DoubleSide}),.26,.2,.26,0,.02,0,g);
        m.rotation.x=-Math.PI/2;m.rotation.z=t.id;
        break;}
      case 'roupa':{
        part(GEO.box,new THREE.MeshLambertMaterial({color:0x9a7048}),.34,.5,.18,0,.25,0,g);
        part(GEO.box,new THREE.MeshLambertMaterial({color:0x8a6038}),.13,.26,.19,-.22,.32,0,g);
        part(GEO.box,new THREE.MeshLambertMaterial({color:0x8a6038}),.13,.26,.19,.22,.32,0,g);
        break;}
      case 'armadura':{
        part(GEO.sphere,MAT.bronze,.3,.38,.22,0,.32,0,g);
        part(GEO.box,new THREE.MeshLambertMaterial({color:0x6b4a30}),.5,.1,.3,0,.1,0,g);
        for(const sx of [-1,1])part(GEO.box,MAT.bronze,.16,.14,.08,sx*.26,.48,0,g);
        break;}
      case 'bronze':{
        const m=part(GEO.box,MAT.bronze,.22,.07,.14,0,.045,0,g);m.rotation.y=t.id*.4;
        break;}
      case 'lanca':{
        const m=part(GEO.cyl,MAT.wood,.025,1.5,.025,0,.12,0,g);m.rotation.z=1.4;
        const tip=part(GEO.cone,MAT.bronze,.055,.24,.055,.82,.12,0,g);tip.rotation.z=-Math.PI/2;
        break;}
      case 'cerca':{
        const rad=d.r||5.6,gate=d.gate||0,N=28;
        for(let i=0;i<N;i++){
          const an=i*TAU/N;
          if(Math.abs(((an-gate+Math.PI*3)%TAU)-Math.PI)<.22)continue;
          const x=Math.cos(an)*rad,z=Math.sin(an)*rad;
          const st=part(GEO.cyl,MAT.woodDark,.07,2.1,.07,x,1.0,z,g);
          st.rotation.z=Math.cos(an)*.08;st.rotation.x=-Math.sin(an)*.08;
          const tp=part(GEO.cone,MAT.wood,.09,.28,.09,x,2.12,z,g);
          tp.rotation.z=Math.cos(an)*.08;
          if(i%2===0){const a2=an+TAU/N;const rl=part(GEO.cyl,MAT.wood,.035,rad*TAU/N*1.02,.035,Math.cos(an+TAU/N/2)*rad,1.55,Math.sin(an+TAU/N/2)*rad,g);rl.rotation.y=-an-TAU/N/2;rl.rotation.z=Math.PI/2}
        }
        break;}
      case 'totem':{
        const el=d.element||'floresta';
        const cm=CULTURE_COL[el]||0x8fd39a;
        part(GEO.cyl,MAT.trunkDark,.16,2.4,.16,0,1.2,0,g);
        const head=part(GEO.box,new THREE.MeshLambertMaterial({color:cm}),.5,.55,.4,0,2.35,0,g);
        for(const sx of [-1,1])part(GEO.sphere,MAT.hole,.05,.05,.02,sx*.13,2.45,.21,g);
        part(GEO.box,MAT.hole,.26,.04,.03,0,2.2,.21,g);
        for(let i=0;i<3;i++){const w=part(GEO.cone,new THREE.MeshLambertMaterial({color:cm}),.12,.3,.06,Math.cos(i*2.1)*.3,2.25+(i%2)*.2,0,g);w.rotation.z=(i-1)*.8}
        break;}
      case 'moita':{
        part(GEO.sphereLo,MAT.bush,.85,.5,.85,0,.35,0,g);
        part(GEO.sphereLo,MAT.bush,.55,.38,.55,.55,.28,.2,g);
        part(GEO.sphereLo,MAT.bush,.5,.34,.5,-.45,.26,-.25,g);
        const b=d.b|0;
        for(let i=0;i<b;i++){const a=i*2.4;part(GEO.sphere,MAT.berry,.07,.07,.07,Math.cos(a)*.55,.5+Math.sin(i)*.08,Math.sin(a)*.55,g)}
        break;
      }
      case 'baga':part(GEO.sphere,MAT.berry,.11,.11,.11,0,.1,0,g);break;
      case 'baga_assada':{
        const m=part(GEO.sphere,new THREE.MeshLambertMaterial({color:0xd4553e,emissive:0x411008}),.12,.12,.12,0,.1,0,g);
        break;}
      case 'cogumelo_m':case 'cogumelo_v':case 'cogumelo_assado':{
        const red=t.kind==='cogumelo_v';
        const dark=t.kind==='cogumelo_assado';
        part(GEO.cyl,MAT.mushStem,.055,.18,.055,0,.09,0,g);
        part(GEO.sphere,(red?MAT.mushRed:dark?MAT.mushDark:MAT.mushBrown),.16,.1,.16,0,.19,0,g);
        break;
      }
      case 'raiz':{
        const m=part(GEO.cyl,MAT.root,.06,.4,.06,0,.06,0,g);m.rotation.z=1.2;
        const m2=part(GEO.cyl,MAT.root,.04,.24,.04,.1,.05,.06,g);m2.rotation.x=.7;
        break;}
      case 'minhoca':{
        const m=part(GEO.cyl,MAT.worm,.03,.3,.03,0,.04,0,g);m.rotation.z=1.5;
        break;}
      case 'galho':{
        const m=part(GEO.cyl,MAT.wood,.05,.55,.05,0,.05,0,g);m.rotation.z=1.35;
        break;}
      case 'tronco':{
        const m=part(GEO.cyl,MAT.woodDark,.1,.7,.1,0,.1,0,g);m.rotation.z=1.45;
        break;}
      case 'pedra':{
        const m=part(GEO.dode,MAT.stone,.24,.18,.22,0,.1,0,g);m.rotation.y=t.id;
        break;}
      case 'folha':{
        const m=part(GEO.disc,MAT.leaf,.2,.14,.2,0,.02,0,g);m.rotation.x=-Math.PI/2;m.rotation.z=t.id;
        break;}
      case 'lama':{
        const m=part(GEO.disc,MAT.mudWet,.5,.4,.5,0,.02,0,g);m.rotation.x=-Math.PI/2;
        break;}
      case 'cubinho':{
        const m=part(GEO.box,MAT.cub,.16,.16,.16,0,.08,0,g);m.rotation.y=t.id*.7;
        break;}
      case 'machado':{
        const m=part(GEO.cyl,MAT.wood,.04,.4,.04,0,.05,0,g);m.rotation.z=1.2;
        const h=part(GEO.box,MAT.metal,.13,.09,.05,.18,.22,0,g);h.rotation.z=.2;
        break;}
      case 'curativo':{
        part(GEO.sphereLo,MAT.leaf,.16,.08,.14,0,.05,0,g);
        part(GEO.sphereLo,MAT.mud,.12,.06,.1,.1,.04,.08,g);
        break;}
      case 'monte':{
        part(GEO.sphereLo,MAT.dirt,.55,.32,.5,0,.12,0,g);
        part(GEO.sphereLo,MAT.dirt,.3,.2,.3,.2,.2,.1,g);
        break;}
      case 'pilha':case 'abrigo':
        buildPile(t,g);break;
      case 'cabana':buildCabana(t,g);break;
      case 'torre':buildTower(t,g);break;
      case 'celeiro':buildBarn(t,g);break;
      case 'ponte':buildBridge(t,g);break;
      case 'caverna':buildCave(t,g);break;
      case 'minerio':{
        const m=part(GEO.dode,MAT.stone,.32,.24,.3,0,.12,0,g);m.rotation.y=t.id;
        for(const [x,y,z] of [[.12,.24,.06],[-.13,.2,-.05],[0,.3,.14]]){const c=part(GEO.dode,MAT.crystal,.07,.1,.07,x,y,z,g);c.rotation.set(t.id+x,0,z)}
        break;}
      case 'mineral':{
        const c=part(GEO.dode,MAT.crystal,.11,.08,.11,0,.07,0,g);c.rotation.y=t.id;
        break;}
      case 'picareta':{
        const m=part(GEO.cyl,MAT.wood,.04,.42,.04,0,.24,0,g);m.rotation.z=.25;
        const h=part(GEO.cone,MAT.stoneDark,.1,.28,.08,.2,.45,0,g);h.rotation.z=-1.1;
        break;}
      case 'toca':{
        part(GEO.sphereLo,MAT.dirt,.6,.25,.6,0,.1,0,g);
        const hole=part(GEO.disc,new THREE.MeshBasicMaterial({color:0x0a0806}),.3,.3,.3,0,.24,0,g);
        hole.rotation.x=-Math.PI/2;
        break;}
      case 'represa':{
        for(let i=0;i<5;i++){
          const m=part(GEO.cyl,MAT.wood,.06,.9,.06,-.6+i*.3,.25,0,g);
          m.rotation.z=.2*(i%2?1:-1);m.rotation.x=.5;
        }
        part(GEO.sphereLo,MAT.mudWet,.5,.2,.4,0,.12,0,g);
        break;}
      case 'marco':{
        for(let i=0;i<5;i++){const m=part(GEO.dode,MAT.stone,.28,.2,.26,Math.cos(i*2)*.12,.12+i*.22,Math.sin(i*2)*.12,g);m.rotation.y=i}
        break;}
      case 'portao':{
        for(const sx of [-1,1]){
          part(GEO.cyl,MAT.woodDark,.1,2.6,.1,sx*1.05,1.3,0,g);
          part(GEO.cone,MAT.wood,.12,.32,.12,sx*1.05,2.72,0,g);
          part(GEO.dode,MAT.stone,.22,.15,.22,sx*1.05,.1,0,g);
        }
        const frame=grp();
        frame.position.set(-1.05,0,0);
        g.add(frame);
        for(let i=0;i<3;i++)part(GEO.box,MAT.wood,2.05,.13,.1,1.0,.62+i*.62,0,frame);
        const d1=part(GEO.cyl,MAT.woodDark,.045,2.3,.045,1.0,1.24,.02,frame);d1.rotation.z=.55;
        const d2=part(GEO.cyl,MAT.woodDark,.045,2.3,.045,1.0,1.24,-.02,frame);d2.rotation.z=-.55;
        part(GEO.box,MAT.metal,.12,.12,.16,1.94,1.24,0,frame);
        g.userData.gateFrame=frame;g.userData.gateO=0;
        break;}
      case 'ruina':{
        const slab=part(GEO.box,MAT.stoneDark,2.3,.3,1.3,0,.15,.3,g);slab.rotation.y=.08;
        const mono=part(GEO.box,MAT.stone,1.7,1.55,.34,-.15,.92,-.62,g);mono.rotation.y=-.12;mono.rotation.z=.02;
        const glyph=makeGlyphTex(d.glyphs||[]);
        const faceMat=new THREE.MeshBasicMaterial({map:glyph.tex,transparent:true,side:THREE.DoubleSide});
        const face=new THREE.Mesh(new THREE.PlaneGeometry(1.45,.9),faceMat);
        face.position.set(-.16,.98,-.43);face.rotation.y=-.12;g.add(face);
        const flat=new THREE.Mesh(new THREE.PlaneGeometry(1.95,.85),faceMat);
        flat.rotation.x=-Math.PI/2;flat.position.set(0,.31,.62);g.add(flat);
        for(let i=0;i<6;i++){const an=i*1.9+(t.id%3)*.4;part(GEO.dode,MAT.stone,.3,.22,.28,Math.cos(an)*1.7,.11,Math.sin(an)*1.5+.2,g).rotation.y=an}
        const col=part(GEO.cyl,MAT.stone,.24,1.15,.24,1.5,.55,.95,g);col.rotation.z=1.35;
        part(GEO.dode,MAT.crystal,.07,.1,.07,1.9,.14,1.2,g);
        glyph.draw(!!d.done,d.dec|0);
        g.userData.glyph=glyph;g.userData.glyphDec=d.dec|0;g.userData.glyphDone=!!d.done;
        break;}
      case 'fogo':{
        const flames=grp();
        part(GEO.cone,new THREE.MeshBasicMaterial({color:0xff7a26,transparent:true,opacity:.92}),.4,.9,.4,0,.55,0,flames);
        part(GEO.cone,new THREE.MeshBasicMaterial({color:0xffc23e,transparent:true,opacity:.9}),.26,.6,.26,0,.45,0,flames);
        part(GEO.cone,new THREE.MeshBasicMaterial({color:0xfff0a8,transparent:true,opacity:.85}),.13,.35,.13,0,.32,0,flames);
        g.add(flames);
        g.userData.flames=flames;
        g.userData.fireThing=t;
        break;}
      case 'poco':{
        for(let i=0;i<10;i++){const a=i*TAU/10;part(GEO.box,MAT.stone,.3,.16,.22,Math.cos(a)*.6,.08,Math.sin(a)*.6,g).rotation.y=-a}
        part(GEO.cyl,MAT.hole,.52,.05,.52,0,.02,0,g);
        part(GEO.cyl,MAT.water,.34,.03,.34,0,.06,0,g);
        for(const sx of [-1,1])part(GEO.cyl,MAT.wood,.04,.9,.04,sx*.55,.45,-.5,g);
        part(GEO.box,MAT.wood,1.24,.05,.06,0,.9,-.5,g);
        part(GEO.cyl,MAT.wood,.028,.7,.028,0,.62,-.5,g);
        break;}
      case 'plantacao':{
        part(GEO.box,MAT.mudWet,2.3,.05,2.0,0,.03,0,g);
        const crops=[];
        for(let r=0;r<3;r++)for(let c=0;c<4;c++){
          const x=-.8+c*.54,z=-.62+r*.62;
          part(GEO.box,MAT.mud,.42,.05,.4,x,.06,z,g);
          part(GEO.cyl,MAT.crop,.03,.26,.03,x,.2,z,g);
          part(GEO.sphere,MAT.leaf,.15,.07,.15,x,.3,z,g);
          const b=part(GEO.sphere,MAT.berry,.05,.05,.05,x,.36,z,g);b.visible=false;crops.push(b);
        }
        g.userData.crops=crops;g.userData.cropRipe=-1;
        break;}
      case 'agua':return null;
      default:
        part(GEO.box,MAT.stone,.15,.15,.15,0,.08,0,g);
    }
    g.userData.thing=t;
    return g;
  }
  const ROOF_MATS=[M(0xa8603a),M(0x4a7a96),M(0x8a8a80),M(0x7a6a9c),M(0x3f7a42),M(0x7a7064)];
  function roofMat(t){const r=t.data&&t.data.roof;return (r!=null&&ROOF_MATS[r])?ROOF_MATS[r]:MAT.leafD}
  function buildPile(t,g){
    const it=t.data.items||{};
    let y=.04;
    const add=(kind,i)=>{const m=part(GEO.box,kind==='pedra'?MAT.stone:kind==='lama'?MAT.mud:kind==='folha'?MAT.leaf:MAT.wood,
      .14,.1,.3, (Math.random()-.5)*.5, y, (Math.random()-.5)*.5, g);
      m.rotation.y=Math.random()*3;m.rotation.z=(Math.random()-.5)*.6;y+=.07;};
    for(const k in it){for(let i=0;i<it[k]&&i<6;i++)add(k,i)}
    if(t.kind==='abrigo'){
      part(GEO.sphereLo,roofMat(t),.58,.32,.58,0,y+.1,0,g);
      for(let i=0;i<4;i++){const m=part(GEO.cyl,MAT.wood,.05,.6,.05,(Math.random()-.5)*.6,y+.22,(Math.random()-.5)*.6,g);m.rotation.z=(Math.random()-.5)*.7}
    }
  }
  function buildCabana(t,g){
    for(const [x,z] of [[-1.05,.62],[1.05,.62],[-1.05,-.62],[1.05,-.62]])part(GEO.cyl,MAT.wood,.09,1.9,.09,x,.95,z,g);
    for(let i=0;i<7;i++){
      const a=part(GEO.cyl,MAT.wood,.055,1.45,.055,-.85+i*.29,.82,.64,g);a.rotation.z=.05*(i%2?1:-1);
      const b=part(GEO.cyl,MAT.wood,.055,1.45,.055,-.85+i*.29,.82,-.64,g);b.rotation.z=.05*(i%2?1:-1);
    }
    part(GEO.cyl,MAT.woodDark,.07,1.5,.07,0,1.72,0,g);
    const rm=roofMat(t);
    part(GEO.cone,rm,1.85,1.0,1.4,0,2.32,0,g);
    part(GEO.cone,rm,1.45,.75,1.1,0,2.72,0,g);
    part(GEO.box,MAT.hole,.52,1.05,.06,0,.58,.67,g);
    part(GEO.sphereLo,MAT.leafA,.5,.12,.36,0,.2,.18,g);
    for(let i=0;i<3;i++){const m=part(GEO.cyl,MAT.wood,.04,.9,.04,-.6+i*.6,.45,1.15,g);m.rotation.x=.4}
  }
  function buildTower(t,g){
    let y=0;
    for(let i=0;i<7;i++){
      const r=.78-i*.06;
      const m=part(GEO.dode,MAT.stone,r,r*1.25,r,(i%2?.07:-.07)*0,y+.18,0,g);
      m.rotation.y=i*.7;m.position.y=y+.18;y+=.31;
    }
    part(GEO.dode,MAT.stoneDark,.28,.24,.28,0,y+.12,0,g);
  }
  function buildBarn(t,g){
    part(GEO.cyl,MAT.wood,1.0,.9,1.0,0,.42,0,g);
    part(GEO.sphere,MAT.leafD,1.06,.8,1.06,0,1.0,0,g);
    part(GEO.disc,MAT.hole,.44,.44,.44,0,.52,1.0,g);
    for(let i=0;i<4;i++)part(GEO.sphere,MAT.berry,.09,.09,.09,Math.sin(i*2)*.45,.16,.55+Math.cos(i*2)*.2,g);
    for(let i=0;i<3;i++){const m=part(GEO.cyl,MAT.wood,.05,1.2,.05,-.75+i*.75,.9,-.9,g);m.rotation.x=-.35}
  }
  function buildBridge(t,g){
    part(GEO.box,MAT.wood,4.8,.12,1.6,0,.56,0,g);
    for(let i=0;i<8;i++)part(GEO.box,MAT.woodDark,.6,.045,1.66,-2.1+i*.6,.635,0,g);
    for(const sx of [-1,1]){
      part(GEO.cyl,MAT.woodDark,.055,1.05,.055,sx*2.35,.52,.72,g);
      part(GEO.cyl,MAT.woodDark,.055,1.05,.055,sx*2.35,.52,-.72,g);
      const r1=part(GEO.cyl,MAT.wood,.035,4.6,.035,sx*2.35,1.0,.72,g);r1.rotation.z=Math.PI/2;
      const r2=part(GEO.cyl,MAT.wood,.035,4.6,.035,sx*2.35,1.0,-.72,g);r2.rotation.z=Math.PI/2;
    }
    part(GEO.cyl,MAT.woodDark,.16,1.05,.16,0,.25,0,g);
    part(GEO.sphereLo,MAT.mudWet,.5,.1,.3,0,.02,0,g);
  }
  function buildCave(t,g){
    part(GEO.dode,MAT.rock,2.5,1.9,2.1,0,.95,0,g);
    part(GEO.dode,MAT.rockDark,1.9,1.5,1.7,-1.55,1.45,-.3,g);
    part(GEO.dode,MAT.rock,1.75,2.25,1.85,1.6,1.65,-.4,g);
    const hole=part(GEO.disc,MAT.hole,1.05,1.2,1.0,0,1.0,1.62,g);
    for(let i=0;i<6;i++){const a=i*1.31;const m=part(GEO.dode,MAT.stone,.3,.2,.28,Math.cos(a)*2.2,.12,Math.sin(a)*1.7+.9,g);m.rotation.y=i}
    part(GEO.dode,MAT.crystal,.09,.15,.09,.55,.45,1.55,g);
    part(GEO.dode,MAT.crystal,.07,.11,.07,-.4,.35,1.6,g);
  }

  /* ---------- animais ---------- */
  const animalViews=new Map();
  let selectedId=null;
  function buildAnimal(a){
    const g=grp();
    const col=new THREE.Color(a.sp.col);
    col.offsetHSL(((a.id%7)-3)*.004,((a.id%5)-2)*.02,((a.id%3)-1)*.012);
    const bodyM=new THREE.MeshLambertMaterial({color:col});
    const darkM=new THREE.MeshLambertMaterial({color:col.clone().multiplyScalar(.6)});
    const lightM=new THREE.MeshLambertMaterial({color:col.clone().lerp(new THREE.Color(0xf2e2c8),.5)});
    const blackM=new THREE.MeshLambertMaterial({color:0x1b1712});
    const pinkM=new THREE.MeshLambertMaterial({color:0xc98a86});
    const eyeM=new THREE.MeshLambertMaterial({color:0xfbf7ee});
    const pupilM=new THREE.MeshLambertMaterial({color:0x120f0c});
    const glintM=new THREE.MeshBasicMaterial({color:0xffffff});
    const spk=a.spk,sz=a.sp.sz||1;
    const eyeParts=[];
    const eyepush=m=>eyeParts.push({m,sy:m.scale.y});
    const insect=sz<.65;
    const stout=spk==='vombate'||spk==='porco_espinho'||spk==='capivara';
    const long=spk==='serra_pau'||spk==='lontra'||spk==='nutria';
    const bw=stout?1.22:1.04,bh=stout?1.0:.88,bl=long?1.18:.98;
    // corpo bolota + barriga clara
    part(GEO.sphere,bodyM,bw*.64,bh*.63,bl*.68,0,.5,0,g);
    part(GEO.sphere,lightM,bw*.4,bh*.3,bl*.4,0,.38,.16,g);
    // cabeça fundida no corpo (estilo ouriço)
    const headY=.5+bh*.34,headZ=bl*.48;
    part(GEO.sphere,bodyM,.41,.37,.39,0,headY,headZ,g);
    part(GEO.sphere,lightM,.24,.19,.2,0,headY-.05,headZ+.24,g);
    // nariz redondo escuro
    part(GEO.sphere,blackM,.06,.05,.055,0,headY-.02,headZ+.4,g);
    part(GEO.sphere,glintM,.017,.012,.012,.018,headY-.002,headZ+.442,g);
    // olhos grandes: esclera branca + pupila preta + brilhinho
    for(const sx of [-1,1]){
      const ex=.155*sx;
      eyepush(part(GEO.sphere,eyeM,.095,.105,.06,ex,headY+.09,headZ+.315,g));
      eyepush(part(GEO.sphere,pupilM,.05,.056,.035,ex,headY+.09,headZ+.365,g));
      eyepush(part(GEO.sphere,glintM,.017,.017,.012,ex-.022,headY+.115,headZ+.392,g));
      if(!insect){
        const br=part(GEO.box,darkM,.088,.018,.02,ex,headY+.2,headZ+.33,g);
        br.rotation.z=-sx*.12;
      }
    }
    if(!insect)for(const sx of [-1,1])part(GEO.sphere,pinkM,.048,.032,.02,sx*.225,headY-.075,headZ+.3,g);
    // orelhinhas
    if(!insect){
      const eh=spk==='cuica'?.17:spk==='esquilo'?.2:spk==='pug'?.13:spk==='feneco'?.34:spk==='calango'||spk==='cascavel'?.04:.1;
      const ew=spk==='cuica'?.15:spk==='esquilo'?.11:spk==='feneco'?.2:spk==='calango'||spk==='cascavel'?.05:.1;
      for(const sx of [-1,1]){
        const e=part(GEO.sphere,darkM,ew,eh,.05,sx*(spk==='pug'?.3:.25),headY+.24,headZ-.01,g);
        e.rotation.z=sx*.25;
        part(GEO.sphere,pinkM,ew*.5,eh*.58,.02,sx*(spk==='pug'?.3:.25),headY+.24,headZ+.035,g);
      }
    }
    // pormenores por espécie
    if(spk==='porco_espinho'){
      for(let i=0;i<18;i++){
        const th=i*2.399963,ph=.2+(i/18)*1.2;
        const sx=Math.cos(th)*Math.sin(ph),sz2=Math.sin(th)*Math.sin(ph),sy=Math.cos(ph);
        const bx=sx*.56,by=.5+sy*.5,bz=sz2*.66;
        const m=part(GEO.cone,new THREE.MeshLambertMaterial({color:col.clone().multiplyScalar(.75)}),.035,.28,.035,bx,by,bz,g);
        m.lookAt(new THREE.Vector3(bx*2.2,by+sy*.9,bz*2.2));m.rotateX(Math.PI/2);
      }
    }
    if(spk==='joaninha'){
      part(GEO.sphere,bodyM,.63,.36,.72,0,.6,-.06,g);
      for(const [x,y,z] of [[-.22,.84,-.12],[.22,.84,-.12],[-.12,.87,.16],[.14,.85,-.32]])part(GEO.sphere,blackM,.065,.045,.065,x,y,z,g);
      for(const sx of [-1,1]){const a=part(GEO.cyl,blackM,.012,.34,.012,sx*.3,.16,.12,g);a.rotation.z=sx*.5}
    }else if(spk==='besouro_rinoceronte'||spk==='besouro_tartaruga'||spk==='besouro_fungo'){
      part(GEO.sphere,darkM,.58,.36,.66,0,.68,-.04,g);
      if(spk==='besouro_rinoceronte'){const h=part(GEO.cone,darkM,.09,.5,.09,0,headY+.22,headZ+.25,g);h.rotation.x=-.9}
      if(spk==='besouro_tartaruga')part(GEO.torus,lightM,.5,.5,.5,0,.72,-.04,g);
      if(spk==='besouro_fungo')for(const sx of [-1,1]){const a=part(GEO.cyl,blackM,.012,.22,.012,sx*.14,headY+.28,headZ+.12,g);a.rotation.z=sx*.6}
    }else if(spk==='cigarra_bola'){
      const wingM=new THREE.MeshLambertMaterial({color:0xe2c86a,transparent:true,opacity:.55});
      const w1=part(GEO.sphere,wingM,.34,.18,.52,-.16,.72,-.06,g);w1.rotation.z=.25;
      const w2=part(GEO.sphere,wingM,.34,.18,.52,.16,.72,-.06,g);w2.rotation.z=-.25;
    }else if(spk==='rola_bosta'){
      part(GEO.sphere,new THREE.MeshLambertMaterial({color:0x6b5a3a}),.3,.3,.3,0,.25,-.78,g);
    }else if(spk==='serra_pau'){
      for(const sx of [-1,1]){const a=part(GEO.cyl,blackM,.011,.4,.011,sx*.08,headY+.26,headZ+.14,g);a.rotation.z=sx*.45;a.rotation.x=-.3}
    }else if(spk==='sapo'){
      for(const sx of [-1,1]){
        part(GEO.sphere,eyeM,.13,.12,.09,sx*.17,headY+.18,headZ+.28,g);
        part(GEO.sphere,pupilM,.06,.062,.04,sx*.17,headY+.18,headZ+.34,g);
      }
      part(GEO.box,blackM,.34,.02,.02,0,headY-.1,headZ+.34,g);
    }else if(spk==='capivara'){
      part(GEO.box,lightM,.3,.17,.22,0,headY-.05,headZ+.36,g);
      part(GEO.box,blackM,.06,.04,.03,0,headY-.02,headZ+.48,g);
    }else if(spk==='pug'){
      part(GEO.box,lightM,.26,.16,.14,0,headY-.04,headZ+.38,g);
      part(GEO.box,blackM,.2,.02,.03,0,headY+.04,headZ+.4,g);
      part(GEO.box,blackM,.16,.02,.03,0,headY+.09,headZ+.37,g);
      for(const sx of [-1,1]){const e=part(GEO.sphere,darkM,.1,.18,.06,sx*.32,headY+.05,headZ,g);e.rotation.z=sx*.35}
      const t=part(GEO.torus,darkM,.12,.12,.1,0,.52,-bl*.66,g);t.rotation.y=Math.PI/2;
    }else if(spk==='lontra'||spk==='nutria'||spk==='cuica'||spk==='prea'){
      for(const sx of [-1,1])for(let i=0;i<3;i++){const w=part(GEO.cyl,blackM,.006,.18,.006,sx*.2,headY-.02-i*.02,headZ+.33,g);w.rotation.z=sx*(.9+i*.15)}
      if(spk==='cuica'){const sn=part(GEO.cone,lightM,.07,.18,.07,0,headY-.05,headZ+.42,g);sn.rotation.x=Math.PI/2}
    }else if(spk==='guaxinim'){
      part(GEO.sphere,blackM,.15,.09,.06,-.16,headY+.08,headZ+.3,g);
      part(GEO.sphere,blackM,.15,.09,.06,.16,headY+.08,headZ+.3,g);
    }else if(spk==='toupeira'){
      part(GEO.cyl,pinkM,.055,.15,.055,0,headY-.04,headZ+.32,g).rotation.x=1.2;
      for(const sx of [-1,1])part(GEO.box,pinkM,.14,.05,.19,sx*.24,.12,headZ*.5,g);
    }else if(spk==='tatu'){
      for(let i=0;i<5;i++){const p=part(GEO.box,darkM,.98-i*.05,.09,.82-i*.03,0,.66+i*.13,-.03,g);p.rotation.x=-.12}
      const shell=part(GEO.sphere,darkM,.56,.2,.65,0,.8,-.04,g);shell.rotation.x=-.08;
      const sn=part(GEO.cone,lightM,.09,.34,.09,0,headY-.03,headZ+.4,g);sn.rotation.x=Math.PI/2;
      for(const sx of [-1,1])part(GEO.dode,MAT.stone,.07,.05,.07,sx*.24,.2,.5,g);
    }else if(spk==='coruja'){
      for(const sx of [-1,1]){
        part(GEO.disc,lightM,.22,.22,.22,sx*.15,headY+.05,headZ+.29,g);
        part(GEO.sphere,new THREE.MeshLambertMaterial({color:0xe8a13a}),.055,.06,.1,0,headY-.03,headZ+.4,g);
        const tuft=part(GEO.cone,darkM,.06,.24,.045,sx*.25,headY+.34,headZ+.02,g);tuft.rotation.z=sx*.35;
        const wing=part(GEO.sphere,darkM,.3,.16,.52,sx*.45,.56,-.12,g);wing.rotation.z=sx*.22;
      }
    }else if(spk==='cotia'){
      for(let i=0;i<3;i++)part(GEO.box,darkM,.1,.02,.82,(-.19+i*.19),.81,-.02,g);
      part(GEO.sphere,lightM,.13,.2,.13,0,.4,-bl*.6,g);
      part(GEO.cyl,darkM,.045,.5,.045,0,.35,-bl*.86,g).rotation.x=-1.3;
      for(const sx of [-1,1])part(GEO.cyl,darkM,.055,.28,.055,sx*.36,.16,-.34,g);
    }else if(spk==='calango'){
      for(let i=0;i<6;i++){const a=Math.PI*(.2+i*.12);part(GEO.cone,darkM,.028,.12,.028,0,.86-i*.045,Math.sin(i*.9)*.16,g).rotation.z=.3}
      part(GEO.sphere,lightM,.3,.14,.34,0,.42,.3,g);
      for(const sx of [-1,1])part(GEO.sphere,blackM,.045,.045,.03,sx*.16,headY+.06,headZ+.32,g);
    }else if(spk==='cascavel'){
      for(let i=0;i<5;i++)part(GEO.dode,darkM,.14,.09,.18,0,.74,Math.sin(i*1.2)*.12-.18-i*.1,g);
      for(const sx of [-1,1])part(GEO.sphere,blackM,.04,.04,.025,sx*.16,headY+.06,headZ+.34,g);
      part(GEO.box,blackM,.03,.012,.16,0,headY-.1,headZ+.42,g);
    }else if(spk==='escorpiao'){
      for(const sx of [-1,1]){const claw=part(GEO.cone,darkM,.08,.24,.05,sx*.26,.48,headZ+.3,g);claw.rotation.x=Math.PI/2;claw.rotation.z=sx*.25;part(GEO.sphere,blackM,.1,.07,.08,sx*.28,.5,headZ+.42,g)}
      for(let i=0;i<4;i++){const a=-.5+i*.55;part(GEO.sphere,darkM,.09,.08,.1,Math.cos(a)*-.1,.78+Math.sin(a)*.4,-.3,g)}
      const sting=part(GEO.cone,new THREE.MeshLambertMaterial({color:0xc8a03a}),.035,.14,.035,0,1.06,-.62,g);sting.rotation.x=-.6;
    }else if(spk==='feneco'){
      for(const sx of [-1,1]){const e=part(GEO.cone,darkM,.12,.4,.05,sx*.26,headY+.36,headZ-.02,g);e.rotation.z=sx*.2;e.rotation.x=-.15;const inn=part(GEO.cone,pinkM,.07,.3,.02,sx*.26,headY+.35,headZ+.02,g);inn.rotation.z=sx*.2;inn.rotation.x=-.15}
      part(GEO.sphere,lightM,.2,.12,.14,0,headY-.08,headZ+.3,g);
    }else if(spk==='camelo'){
      part(GEO.sphere,bodyM,.55,.42,.55,-.1,.95,-.12,g);
      part(GEO.sphere,bodyM,.45,.32,.45,.28,.86,.1,g);
      part(GEO.sphere,lightM,.26,.2,.4,0,.72,.42,g);
      part(GEO.cyl,bodyM,.1,.5,.1,0,.86,headZ+.04,g);
      for(const sx of [-1,1])part(GEO.sphere,blackM,.035,.03,.02,sx*.17,headY+.1,headZ+.32,g);
    }else if(spk==='paca'){
      for(let i=0;i<9;i++)part(GEO.sphere,lightM,.046,.018,.046,Math.sin(i*2.4)*.3,.68,Math.cos(i*3.1)*.4-.1,g);
      part(GEO.box,lightM,.22,.14,.2,0,headY-.06,headZ+.36,g);
    }else if(spk==='tamandua'){
      const sn=part(GEO.cone,lightM,.06,.62,.06,0,headY-.04,headZ+.55,g);sn.rotation.x=Math.PI/2;
      part(GEO.box,darkM,.16,.05,.5,0,.86,-.2,g);
    }else if(spk==='garca'){
      for(const [fx,fz] of [[-.26,.24],[.26,.24],[-.26,-.2],[.26,-.2]])part(GEO.cyl,blackM,.017,.55,.017,fx,.27,fz,g);
      const bk=part(GEO.cone,new THREE.MeshLambertMaterial({color:0xd8b048}),.045,.55,.045,0,headY-.02,headZ+.5,g);bk.rotation.x=Math.PI/2;
      part(GEO.sphere,lightM,.26,.3,.3,0,.55,0,g);
    }else if(spk==='jaguatirica'){
      for(let i=0;i<8;i++)part(GEO.sphere,blackM,.05,.018,.05,Math.sin(i*2.1)*.34,.78,Math.cos(i*1.7)*.4-.1,g);
      for(let i=0;i<4;i++)part(GEO.sphere,blackM,.034,.02,.034,Math.sin(i*2.5+1)*.2,headY+.12,headZ+.2,g);
    }
    // detalhes extras por espécie
    if(spk==='castor'){for(const sx of [-1,1])part(GEO.box,eyeM,.035,.055,.02,sx*.038,headY-.115,headZ+.4,g)}
    if(spk==='guaxinim')for(let i=0;i<3;i++)part(GEO.sphere,lightM,.1,.07,.1,0,.44-i*.09,-bl*.5-i*.07,g);
    if(spk==='esquilo'){
      part(GEO.sphere,lightM,.09,.12,.09,0,.92,-bl*.6,g);
      for(const sx of [-1,1]){const t=part(GEO.cone,darkM,.03,.15,.03,sx*.24,headY+.4,headZ-.02,g);t.rotation.z=sx*.22}
    }
    if(spk==='capivara')for(let i=0;i<5;i++)part(GEO.sphere,darkM,.062,.022,.062,Math.sin(i*2.1)*.34,.72,-.28+i*.14,g);
    if(spk==='lontra'||spk==='nutria')part(GEO.sphere,lightM,.2,.22,.08,0,headY-.24,headZ+.16,g);
    if(spk==='sapo')for(let i=0;i<6;i++){const an=i*1.9;part(GEO.sphere,darkM,.05,.032,.05,Math.cos(an)*.34,.84,Math.sin(an)*.34-.08,g)}
    if(spk==='porco_india')for(let i=0;i<6;i++)part(GEO.sphere,darkM,.05,.018,.05,Math.sin(i*2.3)*.36,.74,Math.cos(i*2.3)*.34-.04,g);
    if(spk==='toupeira')for(let i=0;i<6;i++){const an=i*TAU/6;const c=part(GEO.cone,pinkM,.018,.07,.018,Math.cos(an)*.06,headY-.04,headZ+.39,g);c.rotation.x=Math.PI/2;c.rotation.z=an}
    if(spk==='pug')for(const sx of [-1,1])part(GEO.sphere,darkM,.12,.1,.04,sx*.16,headY+.11,headZ+.27,g);
    if(spk==='vombate')part(GEO.sphere,lightM,.3,.12,.2,0,.5,-bl*.5,g);
    if(spk==='besouro_rinoceronte'||spk==='besouro_tartaruga'||spk==='besouro_fungo')part(GEO.box,blackM,.02,.022,.5,0,1.0,-.02,g);
    if(spk==='cigarra_bola')for(const sx of [-1,1])part(GEO.box,blackM,.02,.02,.4,sx*.12,1.0,-.05,g);
    // patas
    if(insect){
      for(const sx of [-1,1])for(const z of [-.22,0,.22]){const l=part(GEO.cyl,blackM,.022,.22,.022,sx*.3,.1,z,g);l.rotation.z=sx*.5}
    }else{
      for(const [fx,fz] of [[-.4,.3],[.4,.3],[-.4,-.3],[.4,-.3]])part(GEO.cyl,darkM,.09,.17,.09,fx,.12,fz,g);
      if(sz>=.8)for(const [fx,fz] of [[-.4,.3],[.4,.3],[-.4,-.3],[.4,-.3]])for(const sx of [-1,0,1])part(GEO.sphere,lightM,.021,.018,.04,fx+sx*.055,.045,fz+.1,g);
    }
    // cauda
    if(spk==='castor'){const tail=part(GEO.box,darkM,.5,.07,.7,0,.18,-bl*.66,g);tail.rotation.x=.18}
    else if(spk==='esquilo'){
      part(GEO.sphere,darkM,.2,.26,.2,0,.42,-bl*.62,g);
      part(GEO.sphere,darkM,.16,.2,.16,0,.66,-bl*.72,g);
      part(GEO.sphere,darkM,.11,.14,.11,0,.86,-bl*.6,g);
    }else if(spk==='lontra'||spk==='nutria'||spk==='serra_pau'){const t=part(GEO.cone,darkM,.13,.7,.13,0,.34,-bl*.85,g);t.rotation.x=Math.PI/2}
    else if(spk==='cuica'){const t=part(GEO.cyl,darkM,.025,.6,.025,0,.42,-bl*.8,g);t.rotation.x=-1.3}
    else if(spk==='porco_india'||spk==='marmota'||spk==='porco_espinho'||spk==='prea')part(GEO.sphere,darkM,.13,.11,.13,0,.45,-bl*.6,g);
    else if(spk==='calango'){const t=part(GEO.cone,bodyM,.11,1.0,.11,0,.3,-bl*.92,g);t.rotation.x=Math.PI/2;for(let i=1;i<4;i++)part(GEO.sphere,darkM,.03,.03,.03,0,.32,-bl*.6-i*.18,g)}
    else if(spk==='cascavel'){const t=part(GEO.cone,darkM,.12,.9,.12,0,.28,-bl*.85,g);t.rotation.x=Math.PI/2;for(let i=0;i<5;i++)part(GEO.sphere,lightM,.07,.06,.07,0,.28,-bl*.75-i*.13,g)}
    else if(spk==='camelo'){const t=part(GEO.cyl,darkM,.028,.55,.028,0,.42,-bl*.66,g);t.rotation.x=-1.1;part(GEO.sphere,darkM,.06,.1,.06,0,.3,-bl*.9,g)}
    else{const tail=part(GEO.cyl,darkM,.07,.3,.07,0,.48,-bl*.58,g);tail.rotation.x=-1.35}
    // equipamento à mostra: roupa/armadura tingida pela cultura da tribo + ferramenta na mão
    const gear=grp();
    const robeMat=new THREE.MeshLambertMaterial({color:0x8a6038});
    const armorMat=new THREE.MeshLambertMaterial({color:0x9aa0a6});
    const trimMat=new THREE.MeshLambertMaterial({color:0x6b4a30});
    const robe=grp();
    part(GEO.box,robeMat,.92,.42,.78,0,.52,0,robe);
    part(GEO.box,robeMat,.24,.3,.6,-.42,.6,0,robe);
    part(GEO.box,robeMat,.24,.3,.6,.42,.6,0,robe);
    part(GEO.box,trimMat,.95,.06,.8,0,.34,0,robe);
    robe.visible=false;gear.add(robe);
    const armor=grp();
    part(GEO.sphere,armorMat,.62,.34,.58,0,.55,0,armor);
    for(const sx of [-1,1])part(GEO.sphere,armorMat,.2,.11,.24,sx*.42,.72,0,armor);
    part(GEO.box,armorMat,.84,.09,.66,0,.36,0,armor);
    // cada cultura forja uma armadura diferente
    const armorMarks={fogo:grp(),agua:grp(),pedra:grp(),lua:grp(),floresta:grp(),lobo:grp()};
    {
      const m=armorMarks.fogo;
      part(GEO.cone,MAT.bronze,.1,.22,.05,0,.62,.34,m).rotation.x=-.2;
      for(const sx of [-1,1])part(GEO.cone,MAT.bronze,.07,.18,.05,sx*.45,.79,0,m).rotation.z=sx*.5;
    }
    {
      const m=armorMarks.agua;
      part(GEO.torus,MAT.crystal,.3,.3,.06,0,.45,.06,m).rotation.x=Math.PI/2;
      for(let i=0;i<3;i++)part(GEO.sphere,MAT.crystal,.08,.07,.03,-.2+i*.2,.6,.32,m);
    }
    {
      const m=armorMarks.pedra;
      for(const sx of [-1,1])part(GEO.box,MAT.stone,.16,.12,.16,sx*.4,.8,0,m);
      for(let i=0;i<4;i++)part(GEO.dode,MAT.stone,.07,.05,.06,-.27+i*.18,.35,.28,m);
    }
    {
      const m=armorMarks.lua;
      part(GEO.torus,MAT.bone,.34,.34,.05,0,.46,.06,m).rotation.x=Math.PI/2;
      part(GEO.sphere,MAT.bone,.09,.09,.05,0,.7,.34,m);
    }
    {
      const m=armorMarks.floresta;
      for(const sx of [-1,1])part(GEO.sphere,MAT.leaf,.16,.1,.16,sx*.45,.76,0,m);
      part(GEO.sphere,MAT.leaf,.12,.08,.06,0,.55,.33,m);
    }
    {
      const m=armorMarks.lobo;
      for(const sx of [-1,1])part(GEO.sphere,MAT.bone,.17,.11,.15,sx*.45,.78,0,m);
      part(GEO.cone,MAT.bone,.09,.16,.04,0,.62,.33,m).rotation.x=-.2;
    }
    for(const k in armorMarks){armorMarks[k].visible=false;armor.add(armorMarks[k])}
    armor.visible=false;gear.add(armor);
    const spear=grp();
    part(GEO.cyl,MAT.wood,.024,1.25,.024,0,.28,0,spear).rotation.z=.18;
    part(GEO.cone,MAT.bronze,.05,.22,.05,0,.94,0,spear).rotation.z=.18;
    spear.position.set(.6,.25,.18);spear.rotation.x=-.28;spear.visible=false;gear.add(spear);
    const axe=grp();
    part(GEO.cyl,MAT.wood,.028,.5,.028,0,.25,0,axe).rotation.z=.35;
    part(GEO.box,MAT.metal,.16,.1,.06,.16,.5,0,axe).rotation.z=.35;
    axe.position.set(.55,.28,.2);axe.visible=false;gear.add(axe);
    const pick=grp();
    part(GEO.cyl,MAT.wood,.028,.52,.028,0,.26,0,pick).rotation.z=.3;
    part(GEO.cone,MAT.stoneDark,.09,.28,.07,.15,.54,0,pick).rotation.z=-1.2;
    pick.position.set(.55,.28,.2);pick.visible=false;gear.add(pick);
    const ingot=part(GEO.box,MAT.bronze,.16,.06,.1,.55,.35,.28,gear);ingot.visible=false;
    g.add(gear);
    // sombra de contato
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(.62,.18),
      new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.22,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=.015;g.add(shadow);
    // anel de seleção
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.8,.055,6,24),
      new THREE.MeshBasicMaterial({color:0x9fe3a8,transparent:true,opacity:.9}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.04;ring.visible=false;g.add(ring);
    // etiqueta de nome
    const label=makeTextSprite('','name');
    label.position.set(0,2.35,0);label.visible=false;g.add(label);
    // balão de fala
    const bubble=makeTextSprite('','bubble');
    bubble.position.set(0,2.95,0);bubble.visible=false;g.add(bubble);
    // rede neural (mente) — aparece só no bicho selecionado
    const mind=makeMindSprite();
    mind.position.set(0,3.55,0);mind.visible=false;g.add(mind);

    g.scale.setScalar(.86*1.5*sz);
    g.userData.baseScale=.86*1.5*sz;
    g.position.set(a.x,a.y,a.z);
    g.rotation.y=a.yaw;
    g.userData.animalId=a.id;
    g.userData.animal=a;
    g.userData.ring=ring;
    g.userData.label=label;
    g.userData.bubble=bubble;
    g.userData.mind=mind;
    g.userData.eyes=eyeParts;
    g.traverse(o=>{o.userData.animalId=a.id});
    animalsG.add(g);
    animalViews.set(a.id,{g,ring,label,bubble,mind,gear,armorMarks,gearMats:{robeMat,armorMat},gearKey:'',nameCache:'',bubbleT:-1,mindT:-1});
    return g;
  }

  /* ---------- retrato de cada espécie (para a lista) ---------- */
  let portaR=null,portaS=null,portaC=null;
  const portaCache=new Map();
  function portraitSetup(){
    if(portaR)return;
    portaR=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
    portaR.setPixelRatio(1);
    portaR.setSize(128,128,false);
    portaR.setClearColor(0x000000,0);
    portaR.outputEncoding=THREE.sRGBEncoding;
    portaS=new THREE.Scene();
    const hemi=new THREE.HemisphereLight(0xffffff,0x585244,1);
    portaS.add(hemi);
    const sun=new THREE.DirectionalLight(0xfff3dc,.95);
    sun.position.set(2.5,4,3.5);portaS.add(sun);
    const rim=new THREE.DirectionalLight(0xbcd4ff,.4);
    rim.position.set(-3,1.5,-2.5);portaS.add(rim);
    portaC=new THREE.PerspectiveCamera(26,1,.1,80);
  }
  function portraitFor(spk){
    if(portaCache.has(spk))return portaCache.get(spk);
    const sp=(typeof SP!=='undefined'&&SP)?SP[spk]:null;
    if(!sp){portaCache.set(spk,'');return ''}
    portraitSetup();
    const fake={id:987000,sp,spk,x:0,y:0,z:0,yaw:0,hands:[]};
    const g=buildAnimal(fake);
    animalsG.remove(g);animalViews.delete(fake.id);
    g.position.set(0,0,0);g.rotation.y=.42;
    const drop=[];
    g.traverse(o=>{if(o.isSprite)drop.push(o)});
    for(const s of drop)s.parent&&s.parent.remove(s);
    g.traverse(o=>{if(o.geometry&&o.geometry.type==='CircleGeometry')o.visible=false});
    if(g.userData.ring)g.userData.ring.visible=false;
    portaS.add(g);
    const box=new THREE.Box3().setFromObject(g);
    const size=new THREE.Vector3(),ctr=new THREE.Vector3();
    box.getSize(size);box.getCenter(ctr);
    const h=Math.max(size.x,size.y,size.z)||1;
    const d=h*2.7+1.1;
    portaC.position.set(ctr.x+d*.28,ctr.y+h*.42,ctr.z+d*.92);
    portaC.lookAt(ctr.x,ctr.y-h*.02,ctr.z);
    portaC.near=Math.max(.05,d*.08);portaC.far=d*8;portaC.updateProjectionMatrix();
    let url='';
    try{
      portaR.render(portaS,portaC);
      url=portaR.domElement.toDataURL('image/png');
    }catch(e){}
    portaS.remove(g);
    portaCache.set(spk,url);
    return url;
  }

  function makeTextSprite(text,type){
    const c=document.createElement('canvas');
    c.width=512;c.height=128;
    const ctx=c.getContext('2d');
    const tex=new THREE.CanvasTexture(c);
    tex.minFilter=THREE.LinearFilter;
    const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false});
    const sp=new THREE.Sprite(mat);
    sp.scale.set(3.4,.85,1);
    sp.userData.draw=function(txt,kind){
      ctx.clearRect(0,0,c.width,c.height);
      if(!txt)return;
      const talk=kind==='talk';
      ctx.font=type==='name'?'bold 46px Segoe UI, sans-serif':'500 30px Segoe UI, sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      const lines=type==='bubble'?wrapText(ctx,txt,480,30).slice(0,talk?2:3):[txt];
      if(type==='name'){
        ctx.fillStyle='rgba(8,14,10,.55)';
        const w=ctx.measureText(txt).width+34;
        roundRect(ctx,256-w/2,34,w,60,14);ctx.fill();
        ctx.fillStyle='#eafff0';ctx.fillText(txt,256,66);
      }else{
        const lh=talk?32:34;
        const h=lines.length*lh+(talk?16:24);
        const cy=talk?46:64;
        ctx.fillStyle=talk?'rgba(26,44,32,.95)':'rgba(12,20,15,.82)';
        roundRect(ctx,16,cy-h/2,480,h,14);ctx.fill();
        ctx.strokeStyle=talk?'rgba(180,240,190,.55)':'rgba(143,211,154,.25)';ctx.lineWidth=2;ctx.stroke();
        if(talk){
          ctx.beginPath();ctx.moveTo(238,cy+h/2-2);ctx.lineTo(274,cy+h/2-2);ctx.lineTo(256,cy+h/2+20);ctx.closePath();ctx.fill();ctx.stroke();
        }
        ctx.fillStyle=talk?'#eafff0':'#dcebdf';
        lines.forEach((ln,i)=>ctx.fillText(ln,256,cy-(lines.length-1)*lh/2+i*lh));
      }
      tex.needsUpdate=true;
      sp.material.map=tex;
    };
    sp.userData.draw(text);
    return sp;
  }
  function makeGlyphTex(glyphs){
    const c=document.createElement('canvas');
    c.width=512;c.height=192;
    const ctx=c.getContext('2d');
    const tex=new THREE.CanvasTexture(c);
    tex.minFilter=THREE.LinearFilter;
    function draw(done,dec){
      ctx.clearRect(0,0,512,192);
      ctx.fillStyle=done?'rgba(64,52,30,.94)':'rgba(54,48,40,.94)';
      roundRect(ctx,4,4,504,184,18);ctx.fill();
      ctx.strokeStyle=done?'rgba(231,196,106,.95)':'rgba(16,12,8,.95)';ctx.lineWidth=6;ctx.stroke();
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='bold 36px Georgia, serif';
      ctx.fillStyle=done?'#ffe9a8':'#d9cdb2';
      const g=(glyphs||[]).slice(0,6);
      g.forEach((w,i)=>ctx.fillText(w,88+(i%3)*168,62+Math.floor(i/3)*64));
      const n=Math.min(12,dec|0);
      for(let i=0;i<12;i++){
        ctx.beginPath();ctx.arc(38+i*38,168,8,0,TAU);
        ctx.fillStyle=i<n?(done?'#ffe08a':'#9fe3a8'):'rgba(255,255,255,.15)';ctx.fill();
      }
      if(done){ctx.font='bold 16px Segoe UI, sans-serif';ctx.textAlign='right';ctx.fillStyle='#ffe9a8';ctx.fillText('decifrado',492,22)}
      tex.needsUpdate=true;
    }
    return {tex,draw};
  }
  function makeMindSprite(){
    const c=document.createElement('canvas');
    c.width=340;c.height=220;
    const ctx=c.getContext('2d');
    const tex=new THREE.CanvasTexture(c);
    tex.minFilter=THREE.LinearFilter;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,opacity:.94}));
    sp.scale.set(3.4,2.2,1);
    const COL={fome:'#e7c46a',sede:'#7cb6e8',energia:'#d8e46a',calor:'#f0a35e',saude:'#e0715f',social:'#b79bea'};
    sp.userData.draw=function(m){
      ctx.clearRect(0,0,c.width,c.height);
      ctx.fillStyle='rgba(8,14,10,.84)';
      roundRect(ctx,7,7,326,206,18);ctx.fill();
      ctx.strokeStyle='rgba(143,211,154,.35)';ctx.lineWidth=2;ctx.stroke();
      ctx.textBaseline='middle';
      if(!m||!m.cands||!m.cands.length){
        ctx.fillStyle='#8fa697';ctx.font='500 20px Segoe UI, sans-serif';ctx.textAlign='center';
        ctx.fillText('pensando…',170,110);tex.needsUpdate=true;return;
      }
      const ins=m.needs||[];const cands=m.cands.slice(0,6);
      const ix=44,cx=180,ox=298;
      const iy=i=>ins.length<2?110:36+i*(150/Math.max(1,ins.length-1));
      const cy=j=>cands.length<2?110:36+j*(150/Math.max(1,cands.length-1));
      cands.forEach((cd,j)=>{
        ins.forEach((n,i)=>{
          const v=Math.max(0,Math.min(1,n[1]||0));
          ctx.strokeStyle='rgba(140,190,160,'+(.05+.2*(1-v)).toFixed(3)+')';ctx.lineWidth=1;
          ctx.beginPath();ctx.moveTo(ix+7,iy(i));ctx.lineTo(cx-7,cy(j));ctx.stroke();
        });
        const chosen=cd.k===m.pick;
        ctx.strokeStyle=chosen?'rgba(231,196,106,.95)':'rgba(124,182,232,.28)';ctx.lineWidth=chosen?3:1.2;
        ctx.beginPath();ctx.moveTo(cx+7,cy(j));ctx.lineTo(ox-9,110);ctx.stroke();
      });
      ins.forEach((n,i)=>{
        const v=Math.max(0,Math.min(1,n[1]||0));
        ctx.beginPath();ctx.arc(ix,iy(i),7+3*v,0,TAU);
        ctx.fillStyle=COL[n[0]]||'#9fb3a5';ctx.globalAlpha=.4+.6*(1-v);ctx.fill();ctx.globalAlpha=1;
      });
      cands.forEach((cd,j)=>{
        const chosen=cd.k===m.pick;
        const s=Math.max(0,Math.min(1,(cd.s||0)*3+.2));
        ctx.beginPath();ctx.arc(cx,cy(j),chosen?9:5+4*s,0,TAU);
        ctx.fillStyle=chosen?'#ffe08a':'rgba(143,211,154,'+(.3+.5*s).toFixed(2)+')';ctx.fill();
      });
      ctx.beginPath();ctx.arc(ox,110,12,0,TAU);ctx.fillStyle='#ffe08a';ctx.fill();
      ctx.beginPath();ctx.arc(ox,110,7,0,TAU);ctx.fillStyle='#fff6d8';ctx.fill();
      ctx.font='bold 14px Segoe UI, sans-serif';ctx.textAlign='left';ctx.fillStyle='#9fe3a8';
      ctx.fillText('necessidades',30,22);ctx.fillText('opções',130,22);
      ctx.textAlign='right';ctx.fillText('escolha',318,22);
      ctx.font='600 15px Segoe UI, sans-serif';ctx.textAlign='center';ctx.fillStyle='#ffe9a8';
      const label=(m.pick||'').replace(/[:]/g,' · ');
      ctx.fillText(label.length>32?label.slice(0,31)+'…':label,170,201);
      tex.needsUpdate=true;
    };
    sp.userData.draw(null);
    return sp;
  }
  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }
  function wrapText(ctx,text,maxW,lh){
    const words=text.split(' ');const lines=[];let cur='';
    for(const w of words){const test=cur?cur+' '+w:w;if(ctx.measureText(test).width>maxW&&cur){lines.push(cur);cur=w}else cur=test}
    if(cur)lines.push(cur);
    return lines;
  }

  /* ---------- fogo em células / partículas ---------- */
  const MAX_BURN=420;
  const burnMesh=new THREE.InstancedMesh(
    new THREE.ConeGeometry(.42,1.5,5),
    new THREE.MeshBasicMaterial({color:0xff7a2a,transparent:true,opacity:.9}),
    MAX_BURN);
  burnMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  burnMesh.frustumCulled=false;
  fxG.add(burnMesh);
  const burnInner=new THREE.InstancedMesh(
    new THREE.ConeGeometry(.2,.8,5),
    new THREE.MeshBasicMaterial({color:0xffe08a,transparent:true,opacity:.9}),
    MAX_BURN);
  burnInner.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  burnInner.frustumCulled=false;
  fxG.add(burnInner);
  const dummy=new THREE.Object3D();

  const sparkCount=160;
  const sparkPos=new Float32Array(sparkCount*3);
  const sparkVel=new Array(sparkCount).fill(null).map(()=>new THREE.Vector3());
  const sparkLife=new Float32Array(sparkCount);
  const sparkGeo=new THREE.BufferGeometry();
  sparkGeo.setAttribute('position',new THREE.BufferAttribute(sparkPos,3));
  const sparks=new THREE.Points(sparkGeo,new THREE.PointsMaterial({color:0xffcf7a,size:.14,transparent:true,opacity:.95}));
  sparks.frustumCulled=false;fxG.add(sparks);
  let sparkI=0;
  function spawnSpark(x,z,n){
    const y=hgt(x,z)+.4;
    for(let i=0;i<n;i++){
      const k=sparkI++%sparkCount;
      sparkPos[k*3]=x;sparkPos[k*3+1]=y;sparkPos[k*3+2]=z;
      sparkVel[k].set((Math.random()-.5)*5,Math.random()*4+1.5,(Math.random()-.5)*5);
      sparkLife[k]=.5+Math.random()*.5;
    }
    sparkGeo.attributes.position.needsUpdate=true;
  }
  function updateSparks(dt){
    let live=0;
    for(let i=0;i<sparkCount;i++){
      if(sparkLife[i]<=0){sparkPos[i*3+1]=-999;continue}
      sparkLife[i]-=dt;live++;
      sparkVel[i].y-=9*dt;
      sparkPos[i*3]+=sparkVel[i].x*dt;
      sparkPos[i*3+1]+=sparkVel[i].y*dt;
      sparkPos[i*3+2]+=sparkVel[i].z*dt;
    }
    sparks.material.opacity=live?.9:0;
    sparkGeo.attributes.position.needsUpdate=true;
  }

  // cinzas
  const ashMesh=new THREE.InstancedMesh(new THREE.CircleGeometry(.5,8),
    new THREE.MeshBasicMaterial({color:0x3a3a36,transparent:true,opacity:.5}),40);
  ashMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);fxG.add(ashMesh);
  const ashList=[];
  function addAsh(x,z){
    if(ashList.length>=40)ashList.shift();
    ashList.push({x,z,t:0});
  }

  // chuva
  const RAIN=2600;
  const rainPos=new Float32Array(RAIN*3);
  for(let i=0;i<RAIN;i++){rainPos[i*3]=rnd(-HALF,HALF);rainPos[i*3+1]=rnd(0,60);rainPos[i*3+2]=rnd(-HALF,HALF)}
  const rainGeo=new THREE.BufferGeometry();
  rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
  const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0xa9cfe8,size:.12,transparent:true,opacity:.65}));
  rainG.visible=false;rainG.add(rain);
  // neve
  const SNOWN=1400;
  const snowPos=new Float32Array(SNOWN*3);
  for(let i=0;i<SNOWN;i++){snowPos[i*3]=rnd(-HALF,HALF);snowPos[i*3+1]=rnd(0,55);snowPos[i*3+2]=rnd(-HALF,HALF)}
  const snowGeo=new THREE.BufferGeometry();
  snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPos,3));
  const snow=new THREE.Points(snowGeo,new THREE.PointsMaterial({color:0xf2fbff,size:.22,transparent:true,opacity:.85,depthWrite:false}));
  snowG=new THREE.Group();snowG.visible=false;snowG.add(snow);worldG.add(snowG);
  let rainHALF=HALF,snowHALF=HALF;
  function resizeWeather(){
    if(rainHALF!==HALF){
      rainHALF=HALF;
      const p=rainGeo.attributes.position.array;
      for(let i=0;i<RAIN;i++){p[i*3]=rnd(-HALF,HALF);p[i*3+2]=rnd(-HALF,HALF)}
      rainGeo.attributes.position.needsUpdate=true;
    }
    if(snowHALF!==HALF){
      snowHALF=HALF;
      const p=snowGeo.attributes.position.array;
      for(let i=0;i<SNOWN;i++){p[i*3]=rnd(-HALF,HALF);p[i*3+2]=rnd(-HALF,HALF)}
      snowGeo.attributes.position.needsUpdate=true;
    }
  }

  /* ---------- API onAdd/onRemove ---------- */
  const thingViews=new Map();
  function addThingView(t){
    if(t.kind==='agua')return;
    const g=buildThing(t);
    if(!g)return;
    const wet=t.kind==='peixe'||t.kind==='bagre'||t.kind==='vitoria'||(t.kind==='couro'&&inWater(t.x,t.z,0));
    g.position.set(t.x,wet?WATER_Y-.03:hgt(t.x,t.z),t.z);
    if(t.kind==='mural')g.rotation.y=Math.atan2(-t.x,-t.z);
    else if(t.kind==='quadro')g.rotation.y=Math.atan2(-t.x,-t.z)+.4;
    else if(t.kind==='bagre')g.rotation.y=(t.data.ph||0)+1.2;
    else if(t.kind==='peixe')g.rotation.y=t.data.ph||0;
    else if(t.kind==='portao')g.rotation.y=-(t.data.gate||0)-Math.PI/2;
    else if(t.kind==='ruina')g.rotation.y=0;
    else if(t.kind!=='vitoria'&&t.kind!=='fogo'&&t.kind!=='computador'&&t.kind!=='ponte')g.rotation.y=(t.id*.9)%TAU;
    thingsG.add(g);
    thingViews.set(t.id,g);
    if(t.kind==='fogo')ensureFireLight(t.id,g);
  }
  function removeThingView(t){
    const g=thingViews.get(t.id);
    if(g){thingsG.remove(g);thingViews.delete(t.id);}
    const l=fireLights.get(t.id);
    if(l){scene.remove(l);fireLights.delete(t.id)}
  }
  /* ---- luzes de fogueira ---- */
  const fireLights=new Map();
  function ensureFireLight(id,g){
    if(fireLights.size>=7)return;
    const L=new THREE.PointLight(0xff9a4a,1.4,11,2);
    L.position.set(0,1.2,0);g.add(L);
    fireLights.set(id,L);
  }

  /* ---------- câmera / interação ---------- */
  const cam={az:.55,pitch:.6,dist:74,tx:0,ty:0,tz:0,look:new THREE.Vector3(0,0,0),follow:false};
  let dragging=false,panning=false,lastX=0,lastY=0,moved=0,downBtn=0;
  const activePointers=new Map();
  let pinchDist=0,pinchX=0,pinchY=0,pinchUsed=false;
  const raycaster=new THREE.Raycaster();
  const ndc=new THREE.Vector2();

  function setFollow(v){
    cam.follow=!!v;
    if(cam.follow)cam.dist=Math.min(cam.dist,18);else cam.dist=Math.max(cam.dist,74);
  }
  function stopFollow(){
    if(!cam.follow)return;
    cam.follow=false;
    const b=document.getElementById('btnFollow');
    if(b){b.classList.remove('on');b.textContent='seguir'}
  }
  function clampCamTarget(){
    cam.tx=Math.max(-(HALF-4),Math.min(HALF-4,cam.tx));
    cam.tz=Math.max(-(HALF-4),Math.min(HALF-4,cam.tz));
  }
  function panCam(dx,dy){
    const k=cam.dist*.0017;
    const ca=Math.cos(cam.az),sa=Math.sin(cam.az);
    cam.tx+=(ca*dx+sa*dy)*k;
    cam.tz+=(-sa*dx+ca*dy)*k;
    clampCamTarget();
  }
  function selectAnimal(id){
    selectedId=id;
    for(const [aid,v] of animalViews)v.ring.visible=(aid===id);
    if(cam.follow&&id)cam.dist=Math.min(cam.dist,17);
  }
  function pickAnimal(clientX,clientY){
    const r=canvas.getBoundingClientRect();
    ndc.x=((clientX-r.left)/r.width)*2-1;
    ndc.y=-((clientY-r.top)/r.height)*2+1;
    raycaster.setFromCamera(ndc,camera);
    const hits=raycaster.intersectObjects(animalsG.children,true);
    if(hits.length){const id=hits[0].object.userData.animalId;if(id&&UI&&UI.select)UI.select(id);return id}
    return null;
  }
  function pickBoard(clientX,clientY){
    const r=canvas.getBoundingClientRect();
    ndc.x=((clientX-r.left)/r.width)*2-1;
    ndc.y=-((clientY-r.top)/r.height)*2+1;
    raycaster.setFromCamera(ndc,camera);
    const hits=raycaster.intersectObjects(thingsG.children,true);
    for(const h of hits){
      let o=h.object,kind=null;
      while(o){if(o.userData&&o.userData.boardKind){kind=o.userData.boardKind;break}o=o.parent}
      if(kind){if(UI&&UI.openGallery)UI.openGallery(kind);return kind}
    }
    return null;
  }
  function pickComputer(clientX,clientY){
    const r=canvas.getBoundingClientRect();
    ndc.x=((clientX-r.left)/r.width)*2-1;
    ndc.y=-((clientY-r.top)/r.height)*2+1;
    raycaster.setFromCamera(ndc,camera);
    const hits=raycaster.intersectObjects(thingsG.children,true);
    for(const h of hits){
      let o=h.object,th=null;
      while(o){if(o.userData&&o.userData.thing){th=o.userData.thing;break}o=o.parent}
      if(th&&th.kind==='computador'){if(UI&&UI.openCodex)UI.openCodex('studies');return true}
      if(th)return false;
    }
    return false;
  }
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(e.button===1)e.preventDefault();
    activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    dragging=true;moved=0;lastX=e.clientX;lastY=e.clientY;downBtn=e.button;
    panning=e.button===2||e.button===1||e.shiftKey||e.altKey;
    if(panning)stopFollow();
    canvas.classList.add('dragging');
    canvas.setPointerCapture&&canvas.setPointerCapture(e.pointerId);
    if(activePointers.size===2){
      const pts=[...activePointers.values()];pinchX=(pts[0].x+pts[1].x)/2;pinchY=(pts[0].y+pts[1].y)/2;
      pinchDist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);pinchUsed=true;stopFollow();
    }
  });
  canvas.addEventListener('pointermove',e=>{
    if(!activePointers.has(e.pointerId)&&!dragging)return;
    activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(activePointers.size>=2){
      const pts=[...activePointers.values()].slice(0,2);
      const x=(pts[0].x+pts[1].x)/2,y=(pts[0].y+pts[1].y)/2;
      const dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      if(pinchDist>0)cam.dist=Math.max(7,Math.min(330,cam.dist*(pinchDist/dist)));
      panCam((x-pinchX)*.35,(y-pinchY)*.35);
      pinchDist=dist;pinchX=x;pinchY=y;moved+=1;
      return;
    }
    if(!dragging)return;
    const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;
    moved+=Math.abs(dx)+Math.abs(dy);
    if(panning)panCam(dx,dy);
    else{
      cam.az-=dx*.005;
      cam.pitch=Math.max(.12,Math.min(1.35,cam.pitch+dy*.004));
    }
  });
  canvas.addEventListener('pointerup',e=>{
    activePointers.delete(e.pointerId);
    if(activePointers.size<2){pinchDist=0;pinchX=0;pinchY=0}
    if(activePointers.size===0){
      const wasPinch=pinchUsed;pinchUsed=false;dragging=false;panning=false;canvas.classList.remove('dragging');
      if(!wasPinch&&moved<10&&downBtn===0){const id=pickAnimal(e.clientX,e.clientY);if(!id&&!pickBoard(e.clientX,e.clientY))pickComputer(e.clientX,e.clientY)}
    }
  });
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    cam.dist=Math.max(7,Math.min(330,cam.dist*(1+e.deltaY*.001)));
  },{passive:false});
  // teclado: WASD/setas movem, Q/E giram
  const camKeys=new Set();
  addEventListener('keydown',e=>{
    if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    if(/^(KeyW|KeyA|KeyS|KeyD|KeyQ|KeyE|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(e.code))camKeys.add(e.code);
  });
  addEventListener('keyup',e=>camKeys.delete(e.code));
  addEventListener('blur',()=>camKeys.clear());
  addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight,false);
  });

  /* ---------- lobos ---------- */
  const wolfViews=new Map();
  function buildWolf(){
    const g=grp();
    const fur=new THREE.MeshLambertMaterial({color:0x6b6660});
    const furD=new THREE.MeshLambertMaterial({color:0x47433e});
    const eye=new THREE.MeshBasicMaterial({color:0xffb347});
    part(GEO.sphere,fur,.42,.36,.78,0,.62,0,g);
    part(GEO.sphere,furD,.3,.26,.34,0,.7,.62,g);
    part(GEO.cone,furD,.13,.26,.1,0,.94,.5,g);
    part(GEO.sphere,furD,.15,.12,.18,0,.62,.85,g);
    for(const sx of [-1,1]){const e=part(GEO.cone,furD,.07,.19,.07,sx*.15,.94,.54,g);e.rotation.z=sx*.2;part(GEO.sphere,eye,.032,.032,.02,sx*.11,.74,.82,g)}
    for(const sx of [-1,1])for(const z of [-.42,.3])part(GEO.cyl,furD,.07,.42,.07,sx*.27,.22,z,g);
    const tail=part(GEO.cone,furD,.1,.55,.1,0,.62,-.78,g);tail.rotation.x=Math.PI*.62;
    part(GEO.cone,furD,.05,.12,.05,0,.94,.47,g).rotation.x=.3;
    g.scale.setScalar(1.32);
    return g;
  }
  function updateWolfViews(dt){
    if(!W)return;
    const live=new Set();
    for(const w of (W.wolves||[])){
      live.add(w.id);
      let g=wolfViews.get(w.id);
      if(!g){g=buildWolf();wolvesG.add(g);wolfViews.set(w.id,g)}
      g.position.set(w.x,hgt(w.x,w.z)+.02,w.z);
      g.rotation.y=w.yaw||0;
      if(w.state==='down'){
        g.rotation.z+=(Math.PI*.48-g.rotation.z)*Math.min(1,dt*5);
        g.position.y+=.2;
      }else{
        g.rotation.z*=Math.max(0,1-dt*5);
        g.position.y+=Math.sin(performance.now()*.006+w.id)*.03;
      }
    }
    for(const [id,g] of wolfViews){
      if(live.has(id))continue;
      wolvesG.remove(g);wolfViews.delete(id);
    }
  }

  /* ---------- atualização por frame ---------- */
  let lastDay=0,snowStep=-1,flashT=0;
  function syncGear(a,v){
    if(!v.gear)return;
    const key=(a.hands||[]).join(',')+'|'+(a.tribeId||0);
    if(v.gearKey===key)return;
    v.gearKey=key;
    const held=new Set(a.hands||[]);
    for(const k of ['roupa','armadura','lanca','machado','picareta','bronze'])if(v.gear[k])v.gear[k].visible=held.has(k);
    const tr=a.tribeId&&W.tribes?W.tribes.find(t=>t.id===a.tribeId):null;
    const el=tr&&tr.culture&&tr.culture.element;
    const col=new THREE.Color(CULTURE_COL[el]||0x9a7048);
    v.gearMats.robeMat.color.copy(col).multiplyScalar(.82);
    v.gearMats.armorMat.color.copy(col).lerp(new THREE.Color(0xc8bca4),.42);
    if(v.armorMarks)for(const k in v.armorMarks)v.armorMarks[k].visible=(k===(el||'floresta'));
  }

  function tick(dtReal){
    if(!W)return;
    // céu / luzes
    const dl=daylight();
    const wk=W.weather&&W.weather.kind;
    const sky=new THREE.Color();
    sky.setRGB(.025+.38*dl,.04+.54*dl,.075+.71*dl);
    if(W.rain>0)sky.lerp(new THREE.Color(.24,.29,.32),.5);
    if(W.snow>0)sky.lerp(new THREE.Color(.78,.84,.9),Math.min(.6,W.snow*.7));
    if(wk==='tempestade')sky.lerp(new THREE.Color(.1,.12,.16),.66);
    else if(wk==='neblina')sky.lerp(new THREE.Color(.54,.6,.58),.5);
    else if(wk==='seca')sky.lerp(new THREE.Color(.86,.72,.5),.24);
    else if(wk==='geada')sky.lerp(new THREE.Color(.72,.82,.92),.4);
    else if(wk==='granizo')sky.lerp(new THREE.Color(.42,.48,.52),.42);
    if(flashT>0)flashT=Math.max(0,flashT-dtReal);
    else if(wk==='tempestade'&&Math.random()<dtReal*.1)flashT=.32;
    if(flashT>0)sky.lerp(new THREE.Color(1,1,1),.55*(flashT/.32));
    const ss=Math.round((W.snow||0)*8);
    if(ss!==snowStep){snowStep=ss;paintAll()}
    if(snowG)snowG.visible=(W.snow||0)>.3||wk==='geada';
    scene.background=sky;
    scene.fog.color.copy(sky);
    scene.fog.near=170;scene.fog.far=560;
    if(wk==='neblina'){scene.fog.near=30;scene.fog.far=200}
    else if(wk==='seca')scene.fog.far=680;
    hemi.intensity=.16+.5*dl;
    sun.intensity=.05+.84*dl;
    sun.color.setRGB(1,.86+.12*dl,.68+.3*dl);
    if(wk==='seca')sun.color.lerp(new THREE.Color(1,.8,.5),.45);
    else if(wk==='geada')sun.color.lerp(new THREE.Color(.78,.9,1),.5);
    if(flashT>0){hemi.intensity+=flashT*2;sun.intensity+=flashT*3}
    // animais
    for(const a of W.animals){
      const v=animalViews.get(a.id);
      if(!v)continue;
      const g=v.g;
      g.position.set(a.x,a.y,a.z);
      g.rotation.y=a.yaw;
      const walking=(a.state==='move'||a.state==='flee');
      const bob=walking?Math.sin(a.walk*1.6)*.05:0;
      g.position.y+=.02+bob;
      const base=g.userData.baseScale||1;
      const calm=a.state!=='sleep'&&a.state!=='faint';
      g.scale.y=base*(calm?1+Math.sin(performance.now()*.0016+a.id*1.7)*.012:1);
      const eyes=g.userData.eyes;
      if(eyes&&eyes.length){
        const blink=((performance.now()*.001+a.id*.37)%4.1)<.11;
        for(const ep of eyes)ep.m.scale.y=ep.sy*(blink?.12:1);
      }
      syncGear(a,v);
      if(a.state==='sleep'){g.rotation.z+= (Math.PI*.42-g.rotation.z)*Math.min(1,dtReal*4);g.position.y-=.1}
      else if(a.state==='faint'){g.rotation.z+= (Math.PI*.48-g.rotation.z)*Math.min(1,dtReal*6)}
      else g.rotation.z*=Math.max(0,1-dtReal*6);
      // nome
      if(v.nameCache!==(a.name||'')){
        v.nameCache=a.name||'';
        v.label.userData.draw(a.name||'');
        v.label.visible=!!a.name;
      }
      // balão (só fala; pensamentos vão pra rede neural)
      const bub=a.bubble;
      if(bub&&bub.type==='talk'&&W.t-bub.t<9){
        if(v.bubbleT!==bub.t){
          v.bubbleT=bub.t;
          v.bubble.userData.draw(bub.txt.length>90?bub.txt.slice(0,87)+'…':bub.txt,bub.type);
          v.bubble.visible=true;
        }
      }else if(v.bubble.visible){v.bubble.visible=false}
      // rede neural da decisão
      const selA=selectedId===a.id;
      if(v.mind){
        if(selA){
          const m=a.mind;
          if(m&&v.mindT!==m.t){v.mindT=m.t;v.mind.userData.draw(m)}
          v.mind.visible=true;
          v.mind.material.opacity=.86+.1*Math.sin(performance.now()*.004);
        }else if(v.mind.visible)v.mind.visible=false;
      }
      if(selA){v.ring.visible=true;v.ring.rotation.z+=dtReal*1.2}
      else v.ring.visible=false;
    }
    // fogo: animar chamas + telas
    for(const [id,g] of thingViews){
      if(g.userData.flames){
        g.userData.flames.children.forEach((m,i)=>{
          const t=performance.now()*.004+i*1.7;
          m.scale.y=.9+Math.sin(t*1.9+i)*.18;
          m.scale.x=.35+Math.sin(t*2.3+i*2)*.06;
        });
      }
      if(g.userData.screen){
        const k=.86+Math.sin(performance.now()*.006)*.08+Math.sin(performance.now()*.031)*.03;
        g.userData.screen.material.color.setScalar(k);
      }
      if(g.userData.fish){
        g.position.y=WATER_Y-.03+Math.sin(performance.now()*.002+(g.userData.ph||0))*.05;
        g.rotation.y+=dtReal*.5;
      }
      if(g.userData.gateFrame){
        const open=Math.max(0,Math.min(1,(g.userData.thing.data.open||0)));
        g.userData.gateO=(g.userData.gateO||0)+(open-(g.userData.gateO||0))*Math.min(1,dtReal*4);
        g.userData.gateFrame.rotation.y=g.userData.gateO*1.45;
      }
      if(g.userData.glyph){
        const td=g.userData.thing.data;
        if(g.userData.glyphDec!==(td.dec|0)||g.userData.glyphDone!==!!td.done){
          g.userData.glyphDec=td.dec|0;g.userData.glyphDone=!!td.done;
          g.userData.glyph.draw(!!td.done,td.dec|0);
        }
      }
      if(g.userData.crops){
        const ripe=(g.userData.thing.data.ripe|0);
        if(g.userData.cropRipe!==ripe){
          g.userData.cropRipe=ripe;
          g.userData.crops.forEach((b,i)=>{b.visible=(ripe>0&&(i%Math.max(1,Math.ceil(g.userData.crops.length/ripe)))===0)});
        }
      }
    }
    for(const [id,L] of fireLights){L.intensity=1.1+Math.sin(performance.now()*.01+id)*.35}
    // células queimando
    const b=W.burning;let n=0;
    for(let i=0;i<b.length&&n<MAX_BURN;i++,n++){
      const c=b[i];
      const y=hgt(c.cx,c.cz);
      const s=.7+Math.sin(performance.now()*.012+c.ix*3+c.iy*5)*.18;
      dummy.position.set(c.cx,y+.45*s,c.cz);
      dummy.scale.set(s,s,s);dummy.rotation.y=performance.now()*.003+c.ix;
      dummy.updateMatrix();burnMesh.setMatrixAt(n,dummy.matrix);
      dummy.scale.set(s*.7,s*.7,s*.7);dummy.position.y=y+.35*s;
      dummy.updateMatrix();burnInner.setMatrixAt(n,dummy.matrix);
    }
    burnMesh.count=n;burnInner.count=n;
    burnMesh.instanceMatrix.needsUpdate=true;burnInner.instanceMatrix.needsUpdate=true;
    // cinzas
    for(const a of ashList)a.t+=dtReal;
    let ai=0;
    for(const a of ashList){
      dummy.position.set(a.x,hgt(a.x,a.z)+.05,a.z);
      dummy.scale.set(.6,1,.6);dummy.rotation.x=-Math.PI/2;dummy.rotation.z=0;
      dummy.updateMatrix();ashMesh.setMatrixAt(ai++,dummy.matrix);
    }
    ashMesh.count=ai;ashMesh.instanceMatrix.needsUpdate=true;
    // partículas
    updateSparks(dtReal);
    // chuva
    if(rainG.visible){
      const p=rainGeo.attributes.position.array;
      for(let i=0;i<RAIN;i++){
        p[i*3+1]-=28*dtReal;
        if(p[i*3+1]<0){p[i*3+1]=52+Math.random()*10;p[i*3]=rnd(-HALF,HALF);p[i*3+2]=rnd(-HALF,HALF)}
      }
      rainGeo.attributes.position.needsUpdate=true;
    }
    // neve caindo
    if(snowG&&snowG.visible){
      const p=snowGeo.attributes.position.array;
      for(let i=0;i<SNOWN;i++){
        p[i*3+1]-=(5+((i%5)*.8))*dtReal;
        p[i*3]+=Math.sin(performance.now()*.001+i)*dtReal*.35;
        if(p[i*3+1]<-1){p[i*3+1]=48+Math.random()*10;p[i*3]=rnd(-HALF,HALF);p[i*3+2]=rnd(-HALF,HALF)}
      }
      snowGeo.attributes.position.needsUpdate=true;
    }
    // cheia do pantanal
    if(W.flood>0){
      for(const w of waterG.children){
        if(!w.userData.marsh)continue;
        w.position.y=WATER_Y-.23+Math.min(1.1,W.flood*.75);
        const k=1+W.flood*.22;
        w.scale.set(k,k,1);
      }
    }
    // lobos
    updateWolfViews(dtReal);
    // câmera
    const sel=cam.follow&&selectedId?W.animals.find(a=>a.id===selectedId):null;
    if(sel){cam.tx=sel.x;cam.ty=sel.y+.5;cam.tz=sel.z}
    else{
      cam.ty=0;
      const right=(camKeys.has('KeyD')||camKeys.has('ArrowRight')?1:0)-(camKeys.has('KeyA')||camKeys.has('ArrowLeft')?1:0);
      const fwd=(camKeys.has('KeyW')||camKeys.has('ArrowUp')?1:0)-(camKeys.has('KeyS')||camKeys.has('ArrowDown')?1:0);
      if(right||fwd){
        stopFollow();
        const sp=cam.dist*.95*dtReal;
        const ca=Math.cos(cam.az),sa=Math.sin(cam.az);
        cam.tx+=(-sa*fwd+ca*right)*sp;
        cam.tz+=(-ca*fwd-sa*right)*sp;
        clampCamTarget();
      }
      if(camKeys.has('KeyQ'))cam.az+=dtReal*1.1;
      if(camKeys.has('KeyE'))cam.az-=dtReal*1.1;
    }
    cam.look.x+=(cam.tx-cam.look.x)*Math.min(1,dtReal*4);
    cam.look.y+=(cam.ty-cam.look.y)*Math.min(1,dtReal*4);
    cam.look.z+=(cam.tz-cam.look.z)*Math.min(1,dtReal*4);
    const ty=Math.sin(cam.pitch)*cam.dist;
    const hz=Math.cos(cam.pitch)*cam.dist;
    const px=cam.look.x+Math.sin(cam.az)*hz;
    const pz=cam.look.z+Math.cos(cam.az)*hz;
    camera.position.x+=(px-camera.position.x)*Math.min(1,dtReal*5);
    // não deixar a câmera entrar no morro
    const camY=Math.max(cam.look.y+ty,hgt(px,pz)+2.2);
    camera.position.y+=(camY-camera.position.y)*Math.min(1,dtReal*5);
    camera.position.z+=(pz-camera.position.z)*Math.min(1,dtReal*5);
    camera.lookAt(cam.look);
    // água brilha
    waterG.children.forEach(m=>{
      if(m.material&&m.material.shininess!==undefined)m.material.opacity=.82+.08*Math.sin(performance.now()*.001);
      if(m.userData.fall)m.material.opacity=.45+.16*Math.sin(performance.now()*.005);
    });
  }

  camera.position.set(28,36,45);
  camera.lookAt(0,0,0);

  function buildAll(){
    buildTerrain();
    buildWater();
    paintAll();
    for(const t of liveThings())addThingView(t);
    for(const a of W.animals)buildAnimal(a);
  }
  function clearWorld(){
    for(const [id,g] of thingViews){thingsG.remove(g)}
    thingViews.clear();
    for(const [id,L] of fireLights){L.parent&&L.parent.remove(L)}
    fireLights.clear();
    for(const [id,v] of animalViews){animalsG.remove(v.g)}
    animalViews.clear();
    for(const [id,g] of wolfViews){wolvesG.remove(g)}
    wolfViews.clear();
    selectedId=null;snowStep=-1;
  }

  const V={
    /* hooks da simulação */
    onAdd:t=>{if(W)addThingView(t)},
    onAnimal:a=>{if(W&&a&&!animalViews.get(a.id))buildAnimal(a)},
    onRemove:t=>removeThingView(t),
    onChange:t=>{
      const g=thingViews.get(t.id);
      if(g){thingsG.remove(g);thingViews.delete(t.id)}
      const l=fireLights.get(t.id);if(l){l.parent&&l.parent.remove(l);fireLights.delete(t.id)}
      addThingView(t);
    },
    paintCell:c=>paintCell(c),
    spark:(x,z)=>spawnSpark(x,z,14),
    ash:(x,z)=>addAsh(x,z),
    onRain:on=>{rainG.visible=!!on},
    onMural:kind=>{const b=boardViews[kind];if(b)b.redraw()},
    /* controle */
    bindWorld:w=>{
      clearWorld();buildAll();resizeWeather();
    },
    selectAnimal,
    focusEvent:(aid,x,z)=>{
      if(aid!=null&&W){
        const a=W.animals.find(v=>v.id===aid);
        if(a){selectAnimal(aid);cam.tx=a.x;cam.ty=a.y+.5;cam.tz=a.z;return true}
      }
      if(x!=null&&z!=null){cam.tx=x;cam.ty=0;cam.tz=z;return true}
      return false;
    },
    getSelected:()=>selectedId,
    portrait:spk=>{try{return portraitFor(spk)}catch(e){return ''}},
    setFollow,
    getFollow:()=>cam.follow,
    tick,render:()=>renderer.render(scene,camera),
    _scene:scene,_camera:camera,_renderer:renderer,
  };
  return V;
}
