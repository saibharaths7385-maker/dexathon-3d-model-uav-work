const $=id=>document.getElementById(id), rad=d=>d*Math.PI/180, VIS=3;
// ---------- scenario table ----------
const SC={
 FOREST:{sky:0x9ec9e8,vis:8000,g:0x2f5d34,g2:0x6f8f4a,amp:90,haze:0xffffff,wind:8,temp:24,turb:'MODERATE'},
 URBAN:{sky:0xaab8c8,vis:6000,g:0x4a4f55,g2:0x6b7280,amp:2,haze:0xffffff,wind:10,temp:29,turb:'HIGH'},
 ASH:{sky:0x6a5f58,vis:4000,g:0x2b2724,g2:0x5b4a40,amp:120,haze:0x5a5550,wind:12,temp:18,turb:'MODERATE'},
 DESERT:{sky:0xe8c98f,vis:7000,g:0xd2a65e,g2:0xf0d08a,amp:35,haze:0xd9b27a,wind:14,temp:41,turb:'LIGHT'},
 MOUNTAIN:{sky:0xb8d0e8,vis:9000,g:0x6b7078,g2:0xf2f5f8,amp:300,haze:0xffffff,wind:18,temp:-4,turb:'HIGH'}
};
const S={sc:'FOREST',ac:'EAGLE'};
function sstep(a){a=Math.max(0,Math.min(1,a));return a*a*(3-2*a)}
const hash=(i,j)=>{const n=Math.sin(i*127.1+j*311.7)*43758.5453;return n-Math.floor(n)};
function vnoise(x,z){const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
 return hash(i,j)*(1-u)*(1-v)+hash(i+1,j)*u*(1-v)+hash(i,j+1)*(1-u)*v+hash(i+1,j+1)*u*v}
function fbm(x,z,o){let a=.5,f=1,s=0,n=0;for(let k=0;k<o;k++){s+=a*vnoise(x*f,z*f);n+=a;a*=.5;f*=2}return s/n}
let HM=null; // real DEM heightmap {d,w,h,amp} covering the 8 km x 8 km world
function hmSample(x,z){const u=(x/8000+.5)*(HM.w-1),v=(z/8000+.5)*(HM.h-1);if(u<0||v<0||u>=HM.w-1||v>=HM.h-1)return 0;
 const i=u|0,j=v|0,fu=u-i,fv=v-j,g=(a,b)=>HM.d[b*HM.w+a];
 return g(i,j)*(1-fu)*(1-fv)+g(i+1,j)*fu*(1-fv)+g(i,j+1)*(1-fu)*fv+g(i+1,j+1)*fu*fv}
function H(x,z){let h;
 if(HM)h=hmSample(x,z);
 else if(S.sc==='DESERT'){const w=fbm(x*.0004,z*.0004,3);h=.5+.4*Math.sin(x*.004+w*8)+(fbm(x*.01,z*.01,2)-.5)*.1}
 else if(S.sc==='MOUNTAIN'){const r=1-Math.abs(fbm(x*.0005,z*.0005,5)*2-1);h=Math.pow(r,2.2)*1.5}
 else h=fbm(x*.0006,z*.0006,5)*(S.sc==='URBAN'?.2:1.3);
 if(HM)return h*HM.amp-(HM.off||0);let r=h*SC[S.sc].amp*sstep((Math.hypot(x,z)-900)/900);
 if(S.sc==="FOREST"||S.sc==="DESERT")r-=9*sstep(1-Math.abs(x-(1500+700*Math.sin(z*.0012)))/70);return r;
}
// ---------- renderer / scene ----------
const R=new THREE.WebGLRenderer({antialias:true});R.setPixelRatio(Math.min(devicePixelRatio,2));$('view').appendChild(R.domElement);R.outputEncoding=THREE.sRGBEncoding;R.toneMapping=THREE.ACESFilmicToneMapping;R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,1,14000);
const hemi=new THREE.HemisphereLight(0xffffff,0x445566,.9);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,.8);sun.position.set(500,900,300);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-400,right:400,top:400,bottom:-400,near:10,far:3500});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0005;
addEventListener('resize',()=>fit());
let camDist=34;addEventListener('wheel',e=>{camDist=Math.max(10,Math.min(150,camDist*(e.deltaY>0?1.1:.9)))});
let world=null,fogTarget=0;
function setScenario(n){
 if(world){scene.remove(world);world.traverse(o=>o.geometry&&o.geometry.dispose())}
 S.sc=n;const c=SC[n];world=new THREE.Group();
 scene.background=new THREE.Color(c.sky);fogTarget=3/c.vis;scene.fog=new THREE.FogExp2(c.sky,fogTarget);
 const g=new THREE.PlaneGeometry(8000,8000,QL[quality].seg,QL[quality].seg);g.rotateX(-Math.PI/2);
 const p=g.attributes.position,col=new Float32Array(p.count*3),a=new THREE.Color(c.g),b=new THREE.Color(c.g2),t=new THREE.Color();
 const A=HM?HM.amp:c.amp,off=HM?(HM.off||0):0,ROCK=new THREE.Color(0x6e6a64),SNOW=new THREE.Color(0xf2f5f8),GR=new THREE.Color(0x3d6b35);
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),h=H(x,z);p.setY(i,h);
  const sl=(Math.abs(H(x+25,z)-h)+Math.abs(H(x,z+25)-h))/25,f=Math.max(0,Math.min(1,(h+off)/A));
  t.copy(a).lerp(b,Math.min(1,f*1.2+vnoise(x*.01,z*.01)*.3));
  if(n==='MOUNTAIN'){if(f<.25)t.lerp(GR,.7);if(f>.6)t.lerp(SNOW,Math.min(1,(f-.6)/.15))}
  t.lerp(ROCK,Math.max(0,Math.min(1,(sl-.35)*2.2)));col.set([t.r,t.g,t.b],i*3)}
 g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();
 const tm=new THREE.Mesh(g,sat?new THREE.MeshStandardMaterial({map:sat,roughness:1}):new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}));tm.receiveShadow=true;world.add(tm);
 const d=new THREE.Object3D(),rnd=()=>(Math.random()-.5)*7000;
 const inst=(geo,mat,n,fn)=>{const m=new THREE.InstancedMesh(geo,mat,n);for(let i=0;i<n;i++){fn(d,i,m);d.updateMatrix();m.setMatrixAt(i,d.matrix)}world.add(m)};
 const scat=(geo,mat,cnt0,ok,fn)=>{const cnt=Math.max(1,Math.floor(cnt0*QL[quality].veg)),m=new THREE.InstancedMesh(geo,mat,cnt);let k=0,tr=0;
  while(k<cnt&&tr++<cnt*6){const x=rnd(),z=rnd();if(Math.hypot(x,z)<450)continue;if(!HM&&n==="FOREST"&&Math.abs(x-(1500+700*Math.sin(z*.0012)))<40)continue;const h=H(x,z),f=Math.max(0,Math.min(1,(h+off)/A));if(!ok(f))continue;
   d.position.set(x,h,z);d.rotation.set(0,Math.random()*6.28,0);d.scale.set(1,1,1);fn(d,m,k);d.updateMatrix();m.setMatrixAt(k,d.matrix);k++}
  m.count=k;world.add(m)};
 const wm=new THREE.MeshStandardMaterial({color:0xffffff,flatShading:true,roughness:.9}),hsl=(h,s_,l)=>new THREE.Color().setHSL(h,s_,l);
 const pine=new THREE.ConeGeometry(4,16,7).translate(0,8,0),crown=new THREE.SphereGeometry(5,7,6).translate(0,7,0);
 if(n==='FOREST'){scat(pine,wm,1800,()=>true,(o,m,i)=>{const s_=.7+Math.random()*1.1;o.scale.set(s_,s_*(1+Math.random()*.5),s_);m.setColorAt(i,hsl(.33,.45,.12+Math.random()*.1))});
  scat(crown,wm,900,()=>true,(o,m,i)=>{const s_=.8+Math.random();o.scale.set(s_,s_,s_);m.setColorAt(i,hsl(.22+Math.random()*.1,.5,.2+Math.random()*.12))})}
 if(n==='FOREST'&&!HM){const N_=120,pos=[],idx=[];for(let i=0;i<=N_;i++){const z=-4000+i*8000/N_,x=1500+700*Math.sin(z*.0012),y=H(x,z)+1.8;pos.push(x-18,y,z,x+18,y,z);if(i<N_){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2)}}
  const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));wg.setIndex(idx);wg.computeVertexNormals();
  world.add(new THREE.Mesh(wg,new THREE.MeshStandardMaterial({color:0x2d6a8f,roughness:.15,metalness:.1,transparent:true,opacity:.85,side:THREE.DoubleSide})))}
 if(n==='MOUNTAIN')scat(pine,wm,1500,f=>f<.3,(o,m,i)=>{const s_=.8+Math.random();o.scale.set(s_,s_*1.2,s_);m.setColorAt(i,hsl(.35,.4,.13+Math.random()*.08))});
 if(n==='DESERT'){scat(new THREE.DodecahedronGeometry(6,0),wm,500,()=>true,(o,m,i)=>{const s_=.5+Math.random()*2;o.scale.set(s_,s_*.6,s_);m.setColorAt(i,hsl(.08,.3,.3+Math.random()*.15))});
  scat(new THREE.SphereGeometry(1.5,5,4).translate(0,1,0),wm,300,()=>true,(o,m,i)=>m.setColorAt(i,hsl(.2,.35,.28+Math.random()*.1)))}
 if(n==='ASH')scat(new THREE.DodecahedronGeometry(6,0),wm,300,()=>true,(o,m,i)=>{const s_=.5+Math.random()*2.5;o.scale.set(s_,s_*.7,s_);m.setColorAt(i,hsl(.05,.1,.08+Math.random()*.08))});
 if(n==='URBAN'&&!osm){inst(new THREE.BoxGeometry(1,1,1).translate(0,.5,0),new THREE.MeshStandardMaterial({color:0xffffff,flatShading:true}),900,(o,i,m)=>{const gx=((i%30)-15)*120,gz=(Math.floor(i/30)-15)*120;if(Math.hypot(gx,gz)<260||(i*7)%11===0){o.scale.set(0,0,0)}else{const h=20+Math.random()*90;o.position.set(gx,0,gz);o.scale.set(40+Math.random()*30,h,40+Math.random()*30)}m.setColorAt(i,new THREE.Color().setHSL(.6,.08,.35+Math.random()*.3))});
  const rm=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.3,1),new THREE.MeshStandardMaterial({color:0x2b2e33,roughness:.9}),62);d.rotation.set(0,0,0);
  for(let i=0;i<31;i++){d.position.set(0,.6,(i-15)*120+60);d.scale.set(3600,1,14);d.updateMatrix();rm.setMatrixAt(i,d.matrix);d.position.set((i-15)*120+60,.6,0);d.scale.set(14,1,3600);d.updateMatrix();rm.setMatrixAt(31+i,d.matrix)}world.add(rm);
  const pk=[];for(let i=0;i<900;i++){if((i*7)%11===0){const gx=((i%30)-15)*120,gz=(Math.floor(i/30)-15)*120;if(Math.hypot(gx,gz)>=260)pk.push([gx,gz])}}
  const pm=new THREE.InstancedMesh(new THREE.BoxGeometry(100,.4,100),new THREE.MeshStandardMaterial({color:0x3f7d3a,roughness:1}),pk.length);d.rotation.set(0,0,0);d.scale.set(1,1,1);
  pk.forEach(([x,z],i)=>{d.position.set(x,.3,z);d.updateMatrix();pm.setMatrixAt(i,d.matrix)});world.add(pm);
  const cw=new THREE.Mesh(new THREE.BoxGeometry(3600,.2,36),new THREE.MeshStandardMaterial({color:0x2d6a8f,roughness:.15,transparent:true,opacity:.85}));cw.position.set(0,.9,1020);world.add(cw);
  const bi=new THREE.InstancedMesh(new THREE.BoxGeometry(14,.8,50),new THREE.MeshStandardMaterial({color:0x9aa0a6,roughness:.8}),5);
  [2,8,14,20,26].forEach((k,i)=>{d.position.set((k-15)*120+60,1.4,1020);d.updateMatrix();bi.setMatrixAt(i,d.matrix)});world.add(bi)}
 if(n==='ASH'){const v=new THREE.Mesh(new THREE.ConeGeometry(550,750,24),new THREE.MeshStandardMaterial({color:0x2a2420,flatShading:true}));v.position.set(1500,H(1500,-1500)+350,-1500);world.add(v);
  const gl=new THREE.Mesh(new THREE.SphereGeometry(90,12,8),new THREE.MeshBasicMaterial({color:0xff4d1a}));gl.position.set(1500,v.position.y+360,-1500);world.add(gl)}
  world.traverse(o=>{if(o.isInstancedMesh)o.castShadow=true});scene.add(world);haze.m.material.color.set(c.haze);paintSky(c);clearTrail();
 $('sc').value=n;
}
// ---------- particles ----------
class P{constructor(n,box,color,size,op,spd){this.n=n;this.box=box;this.spd=spd;this.a=new Float32Array(n*3).map(()=>(Math.random()-.5)*box);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.a,3));
 this.m=new THREE.Points(g,new THREE.PointsMaterial({color,size,transparent:true,opacity:op,depthWrite:false}));this.m.frustumCulled=false;scene.add(this.m)}
 step(dt,c,w,dens){const a=this.a,b=this.box,h=b/2;for(let i=0;i<this.n;i++){const j=i*3;
  a[j]+=w.x*dt*this.spd;a[j+1]+=w.y!=null?w.y*dt*this.spd:Math.sin(i+performance.now()*.001)*dt*.5;a[j+2]+=w.z*dt*this.spd;
  for(let k=0;k<3;k++){a[j+k]=c[k]+((a[j+k]-c[k]+h)%b+b)%b-h}}
 this.m.geometry.attributes.position.needsUpdate=true;this.m.geometry.setDrawRange(0,Math.floor(this.n*dens))}}
const haze=new P(2500,1400,0xffffff,8,.45,1),wind=new P(700,500,0xffffff,1.6,.55,6);
// ---------- sky dome + volcano plume ----------
const sky=new THREE.Mesh(new THREE.SphereGeometry(9000,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
 uniforms:{sunDir:{value:new THREE.Vector3(0,1,0)},hz:{value:new THREE.Color(0xaaccee)},zen:{value:new THREE.Color(0x1f4f9a)},dim:{value:1}},
 vertexShader:'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`varying vec3 vD;uniform vec3 sunDir,hz,zen;uniform float dim;
 void main(){vec3 d=normalize(vD),s=normalize(sunDir);float h=max(d.y,0.),mu=max(dot(d,s),0.),e=clamp(s.y*2.5+.3,.15,1.);
  vec3 hor=mix(hz,vec3(1.,.55,.3),(1.-clamp(s.y*2.,0.,1.))*.6*pow(mu,2.));
  vec3 c=mix(hor,zen,pow(h,.45))*e;
  c=mix(c,hor*e,pow(1.-h,6.)*.6);
  c+=vec3(1.,.8,.55)*(pow(mu,24.)*.5+pow(mu,700.)*8.)*e;
  c=mix(hz*.8*e,c,dim);
  gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
 }`}));scene.add(sky);
function paintSky(c){const u=sky.material.uniforms;u.hz.value.set(c.sky);u.zen.value.set(S.sc==='ASH'?0x3a3330:0x1f4f9a)}
const PL=1200,pa=new Float32Array(PL*3),pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pa,3));
const plume=new THREE.Points(pg,new THREE.PointsMaterial({color:0x4a4540,size:60,transparent:true,opacity:.5,depthWrite:false}));plume.frustumCulled=false;plume.userData.t=0;scene.add(plume);
function plumeStep(dt,wv){plume.visible=S.sc==='ASH';if(!plume.visible)return;plume.userData.t+=dt;const cy=H(1500,-1500)+720,sp=plume.userData.t<2?1800:40;
 for(let i=0;i<PL;i++){const j=i*3;if(pa[j+1]<=0||pa[j+1]>cy+1800){pa[j]=1500+(Math.random()-.5)*120;pa[j+1]=cy+Math.random()*sp;pa[j+2]=-1500+(Math.random()-.5)*120}
  else{pa[j]+=(wv.x*2+(Math.random()-.5)*20)*dt;pa[j+1]+=(40+Math.random()*30)*dt;pa[j+2]+=(wv.z*2+(Math.random()-.5)*20)*dt}}
 pg.attributes.position.needsUpdate=true}
// ---------- weather (VISUAL ONLY: never changes telemetry) ----------
const WX={CLEAR:{vis:1e5,haze:0,hc:0xffffff,cloud:0,rain:0,dim:1},CLOUDY:{vis:6000,haze:0,hc:0xffffff,cloud:1,rain:0,dim:.65},RAIN:{vis:2500,haze:0,hc:0xffffff,cloud:1,rain:1,dim:.45},FOG:{vis:500,haze:.5,hc:0xdfe6ec,cloud:0,rain:0,dim:.7},DUST:{vis:900,haze:.85,hc:0xc9a46a,cloud:0,rain:0,dim:.75}};
const clouds=new THREE.Group();{const cm=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.55,depthWrite:false,fog:false});
 for(let i=0;i<45;i++){const c=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),cm);c.scale.set(250+Math.random()*350,40,150+Math.random()*200);c.position.set((Math.random()-.5)*7000,550+Math.random()*450,(Math.random()-.5)*7000);clouds.add(c)}}scene.add(clouds);
const rain=new P(1800,400,0xb8c4d0,1.3,.6,1);rain.m.visible=false;
// ---------- aircraft ----------
const uav=new THREE.Group();uav.rotation.order='YXZ';scene.add(uav);
let prop,disc,shell,cowl,mdl;const glbCache={};
function setAircraft(t){
 S.ac=t;while(uav.children.length)uav.remove(uav.children[0]);const E=t==='EAGLE',g=new THREE.Group();
 const body=new THREE.MeshStandardMaterial({color:E?0xe9ecef:0x3f5a3a,roughness:.5}),acc=new THREE.MeshStandardMaterial({color:E?0xf97316:0x1f2937});
 const L=E?3.2:1.4,r=E?.2:.09,add=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);g.add(o);return o};
 add(new THREE.CylinderGeometry(r*.6,r,L,12).rotateX(Math.PI/2),body,0,0,0);
 cowl=add(new THREE.ConeGeometry(r,L*.15,12).rotateX(-Math.PI/2),acc,0,0,-L/2-L*.075);cowl.material=acc.clone();
 add(new THREE.BoxGeometry(E?7:3,.05,E?.7:.45),body,0,r+.03,-L*.1);
 if(E){add(new THREE.BoxGeometry(.3,.06,.72),acc,3.4,r+.03,-L*.1);add(new THREE.BoxGeometry(.3,.06,.72),acc,-3.4,r+.03,-L*.1)}
 add(new THREE.BoxGeometry(E?2:1,.04,.4),body,0,.05,L/2-.2);
 add(new THREE.BoxGeometry(.04,E?.55:.3,.4),acc,0,E?.27:.15,L/2-.2);
 prop=new THREE.Group();prop.position.set(0,0,-L/2-L*.16);
 const bm=new THREE.MeshStandardMaterial({color:0x111111}),bl=E?.9:.5;
 [0,Math.PI/2].forEach(a=>{const b=new THREE.Mesh(new THREE.BoxGeometry(.06,bl,.02),bm);b.rotation.z=a;prop.add(b)});
 disc=new THREE.Mesh(new THREE.CircleGeometry(bl/2,24),new THREE.MeshBasicMaterial({color:0x888888,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));prop.add(disc);g.add(prop);
 g.scale.setScalar(VIS);uav.add(g);mdl=g;g.traverse(o=>o.castShadow=true);
 shell=new THREE.Mesh(new THREE.SphereGeometry(E?13:8,16,12),new THREE.MeshBasicMaterial({color:0xff2d2d,wireframe:true,transparent:true,opacity:.6}));shell.visible=false;uav.add(shell);
 if(glbCache[t])applyGLB(glbCache[t]);$('ac').value=E?'EAGLE_EYE_MINI':'RQ11B';
}
// ---------- flight path ----------
const TN=3000,tp=new Float32Array(TN*3),tgeo=new THREE.BufferGeometry();tgeo.setAttribute('position',new THREE.BufferAttribute(tp,3));tgeo.setDrawRange(0,0);
const trail=new THREE.Line(tgeo,new THREE.LineBasicMaterial({color:0x22d3ee}));trail.frustumCulled=false;scene.add(trail);
let tn=0,lx=1e9,lz=1e9;
function clearTrail(){tn=0;lx=lz=1e9;tgeo.setDrawRange(0,0)}
function pushTrail(x,y,z){if(Math.hypot(x-lx,z-lz)<8)return;lx=x;lz=z;if(tn>=TN){tp.copyWithin(0,3);tn=TN-1}tp.set([x,y,z],tn*3);tn++;tgeo.attributes.position.needsUpdate=true;tgeo.setDrawRange(0,tn)}
// ---------- state: incoming frames -> targets, smoothed -> current ----------
const mk=()=>({x:0,z:0,alt:0,hdg:0,pitch:0,roll:0,rpm:0});
const T=mk(),cur=mk(),E={hum:null,ws:8,wd:270,temp:24,turb:'LIGHT',vis:8000,dust:0,ash:0},X={anom:null,volt:0,amp:0,speed:0,phase:'—',ac:'—',lat:0,lon:0,expo:0,mtemp:0,fuel:null,mt:0,dist:0,ts0:0,f:{},list:[],nf:0,sens:null,prog:0,mstate:'—',wp:0,seq:-1,drop:0,bad:0,agl:false};
let org=null,last=0,everData=false,camSnap=true,qSnap=true,frozen=false,camMode='chase',az=.6,el=.3;
const curQ=new THREE.Quaternion(),tq=new THREE.Quaternion(),eu=new THREE.Euler(),look=new THREE.Vector3(),rec=[],rep={on:false,i:0,pt:0,paused:false,fr:[]};
const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const num=(v,lo,hi,d)=>typeof v==='number'&&Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):d;
const LIM={EAGLE:{p:35,r:60},RAVEN:{p:40,r:70}}; // aircraft-specific visual motion limits
const ICON={ENGINE_OVERHEAT:'🔥',VIBRATION:'📳',LOW_BATTERY:'🔋',HIGH_TEMP:'🌡',DUST_EXPOSURE:'🌫',LINK_LOSS:'📡',GNSS_DEGRADED:'🛰'};
const toXZ=(la,lo)=>({x:(lo-org.lon)*111320*Math.cos(org.lat*Math.PI/180),z:-(la-org.lat)*110574});
let wpKey='',WPS=[];const wpG=new THREE.Group();scene.add(wpG);
function setWaypoints(w){const k=JSON.stringify(w);if(k===wpKey)return;wpKey=k;
 while(wpG.children.length){const o=wpG.children.pop();o.geometry&&o.geometry.dispose()}
 const pts=[];w.slice(0,30).forEach(q=>{const la=q.latitude??q.lat,lo=q.longitude??q.lon;if(!Number.isFinite(la)||!Number.isFinite(lo))return;
  const c=toXZ(la,lo),s=new THREE.Mesh(new THREE.OctahedronGeometry(10),new THREE.MeshBasicMaterial({color:0xfacc15}));
  s.position.set(c.x,num(q.altitude_m??q.alt,0,20000,100),c.z);wpG.add(s);pts.push(s.position)});WPS=pts;
 if(pts.length>1)wpG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xfacc15})))}
function ingest(m){ // <<< adapt field names here if your Laptop 1 frame differs
 if(!m||typeof m!=='object'||m.type==='pong'||m.type==='hello_ack')return;
 if(!m.__rep){
  if(!m.flight||typeof m.flight!=='object'){X.bad++;return}
  if(typeof m.seq==='number'){if(m.seq<=X.seq&&X.seq-m.seq<1000){X.drop++;return}X.seq=m.seq} // drop out-of-order/duplicate frames
  if(rep.on)return;
  rec.push({t:performance.now(),m});if(rec.length>20000)rec.splice(0,1000);
  last=performance.now();everData=true;if(frozen)return}
 else last=performance.now();
 const f=m.flight,p=m.propulsion||{},e=m.environment||{},ms=m.mission||{};
 const air=/RQ|RAVEN/i.test(String(m.aircraft_id||''))?'RAVEN':'EAGLE',L=LIM[air];
 X.ac=esc(String(m.aircraft_id||X.ac).slice(0,40));
 if(m.aircraft_id&&air!==S.ac)setAircraft(air);
 const sc=String(m.scenario||S.sc).toUpperCase();let snap=false;
 if(SC[sc]&&sc!==S.sc){setScenario(sc);org=null;wpKey='';X.expo=0;resetHist()}
 const ph=esc(String(m.phase||X.phase).slice(0,24));
 if(ph==='INITIALIZATION'&&X.phase!=='INITIALIZATION'){org=null;wpKey='';clearTrail();X.expo=0;resetHist()}
 X.phase=ph;
 if(Number.isFinite(f.latitude)&&Number.isFinite(f.longitude)){
  if(!org){org={lat:f.latitude,lon:f.longitude};snap=true}
  const q=toXZ(f.latitude,f.longitude);T.x=q.x;T.z=q.z;X.lat=f.latitude;X.lon=f.longitude}
 X.agl=f.altitude_ref==='AGL'; // default MSL
 T.alt=num(f.altitude_m,-100,20000,T.alt);T.hdg=num(f.heading_deg,0,360,T.hdg);
 T.pitch=num(f.pitch_deg,-L.p,L.p,T.pitch);T.roll=num(f.roll_deg,-L.r,L.r,T.roll);X.speed=num(f.airspeed_ms,0,200,X.speed);
 T.rpm=num(p.motor_rpm??p.engine_rpm,0,20000,T.rpm);X.volt=num(p.battery_voltage_v,0,60,X.volt);X.amp=num(p.current_a,0,200,X.amp);X.mtemp=num(p.motor_temp_c??p.engine_temp_c,-50,400,X.mtemp);X.fuel=p.fuel_pct==null?X.fuel:num(p.fuel_pct,0,100,0);E.hum=e.humidity_pct==null?E.hum:num(e.humidity_pct,0,100,0);
 E.ws=num(e.wind_speed_ms,0,80,E.ws);E.wd=num(e.wind_dir_deg,0,360,E.wd);E.temp=num(e.temperature_c,-80,80,E.temp);E.turb=esc(String(e.turbulence||E.turb).slice(0,12));
 E.vis=num(e.visibility_m,50,50000,SC[S.sc].vis);E.dust=num(e.dust,0,1,0);E.ash=num(e.ash,0,1,0);
 X.sens=m.sensors&&Number.isFinite(m.sensors.contamination_pct)?m.sensors.contamination_pct:null; // reported by Laptop 1, separate from visual exposure
 const fl=Array.isArray(m.faults)?m.faults.filter(q=>q&&typeof q.code==='string').slice(0,8):[];
 X.list=fl.map(q=>({code:esc(q.code.slice(0,24)),message:esc(String(q.message||q.code).slice(0,60))}));X.f={};X.list.forEach(q=>X.f[q.code]=1);X.nf=fl.length;
 X.anom=X.list.length?X.list[0].message:(m.anomaly&&m.anomaly.active?esc(String(m.anomaly.message||'ANOMALY DETECTED').slice(0,60)):null);
 X.prog=num(ms.progress,0,1,X.prog);X.mstate=esc(String(ms.state||X.mstate).slice(0,24));X.wp=num(ms.wp_index,0,999,X.wp);
 if(ms.time_s!=null)X.mt=num(ms.time_s,0,1e7,X.mt);else if(m.timestamp){const ts=Date.parse(m.timestamp);if(ts){if(!X.ts0)X.ts0=ts;X.mt=(ts-X.ts0)/1000}}
 if(org&&Array.isArray(ms.waypoints))setWaypoints(ms.waypoints);
 if(Math.hypot(T.x-cur.x,T.z-cur.z)>400||Math.abs(T.alt-cur.alt)>300)snap=true; // reconnect / scenario reset
 if(snap){Object.assign(cur,T);clearTrail();camSnap=true;qSnap=true}
}
function applyGLB(gl){uav.remove(mdl);const m=gl.scene.clone(true),sz=new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
 m.scale.multiplyScalar((S.ac==='EAGLE'?7:3)*VIS/Math.max(sz.x,sz.y,sz.z,1e-3));
 prop=new THREE.Object3D();cowl=null;disc={material:{opacity:0}};
 m.traverse(o=>{if(/prop/i.test(o.name))prop=o;else if(o.isMesh&&/engine|motor|cowl/i.test(o.name)&&o.material){o.material=o.material.clone();cowl=o}});
 const w=new THREE.Group();w.add(m);uav.add(w);mdl=w;w.traverse(o=>o.castShadow=true)}
// ---------- demo generator (same frame shape as Laptop 1 would send) ----------
const WP=[1,2,3,4].map(k=>{const u=k*Math.PI/2;return{latitude:12.97-420*(1-Math.cos(u))/110574,longitude:77.59+420*Math.sin(u)/(111320*Math.cos(rad(12.97))),altitude_m:200}});
function demoFaults(t,E_,dust,ash){const f=[];if(t>55&&t<68){f.push(E_?{code:'ENGINE_OVERHEAT',message:'Engine temperature high'}:{code:'LOW_BATTERY',message:'Battery voltage dropping'});f.push({code:'VIBRATION',message:'Vibration above threshold'})}
 if(Math.max(dust,ash)>.35)f.push({code:'DUST_EXPOSURE',message:'Particulate exposure zone'});if(t>40&&t<46)f.push({code:'GNSS_DEGRADED',message:'GNSS accuracy degraded'});return f}
function demoSens(d,a){dEx+=Math.max(d,a)*.1;return{contamination_pct:Math.min(100,dEx*4)}}
let dT=0,dS=0,dAlt=0,dEx=0,dSeq=0;
function demoFrame(){
 const dt=.1*simSpeed;dT=(dT+dt)%110;const t=dT;if(t<dt){dS=0;dAlt=0;dEx=0}
 const sc=$('sc').value,E_=$('ac').value==='EAGLE_EYE_MINI',c=SC[sc],ca=c.amp>200?250:150;
 let ph,alt,v;
 if(t<4){ph='INITIALIZATION';alt=0;v=0}
 else if(t<12){ph='TAKEOFF';const u=(t-4)/8;alt=u<.5?0:(u-.5)*60;v=22*u}
 else if(t<26){ph='CLIMB';alt=30+(t-12)/14*(ca-30);v=22}
 else if(t<80){ph=t>=30&&t<72?'ENVIRONMENT':'CRUISE';alt=ca;v=22}
 else if(t<98){ph='DESCENT';alt=ca-(ca-20)*(t-80)/18;v=22}
 else{ph='LANDING';const u=(t-98)/12;alt=20*(1-u);v=22*(1-u)}
 dS+=v*dt;const Rr=420,u=dS/Rr,x=Rr*Math.sin(u),z=Rr*(1-Math.cos(u));
 const climb=(alt-dAlt)/dt;dAlt=alt;
 const bump=t>48&&t<72?Math.sin((t-48)/24*Math.PI):0,dust=sc==='DESERT'?bump:0,ash=sc==='ASH'?bump:0,la=12.97;
 ingest({seq:++dSeq,aircraft_id:E_?'EAGLE_EYE_MINI':'RQ11B',mission_id:'DEMO',scenario:sc,phase:ph,timestamp:new Date().toISOString(),
  flight:{altitude_m:alt,airspeed_ms:v,heading_deg:(90+u*180/Math.PI)%360,pitch_deg:v>1?Math.asin(Math.max(-1,Math.min(1,climb/v)))*180/Math.PI:0,
   roll_deg:v>1?Math.atan(v*v/(9.81*Rr))*180/Math.PI+Math.sin(t*1.3)*1.5:0,latitude:la-z/110574,longitude:77.59+x/(111320*Math.cos(rad(la)))},
  propulsion:{[E_?'engine_rpm':'motor_rpm']:t<4?0:(E_?6200:5200)*(.4+.6*v/22),battery_voltage_v:16-t*.012,current_a:v?12.4+Math.sin(t)*.8:0,motor_temp_c:35+t*.12+(t>55&&t<68?14:0),fuel_pct:100-t*.35},
  environment:{humidity_pct:SCN[sc].hum,wind_speed_ms:c.wind,wind_dir_deg:270,temperature_c:c.temp,turbulence:c.turb,visibility_m:c.vis*(1-.85*Math.max(dust,ash)),dust,ash},
  faults:demoFaults(t,E_,dust,ash),sensors:demoSens(dust,ash),mission:{time_s:t,state:ph,progress:Math.min(1,t/98),wp_index:Math.min(3,Math.floor(t/26)),waypoints:WP}});
}
// ---------- connection ----------
let mode='demo',ws=null,demoTimer=setInterval(demoFrame,100),retry=null,wsState='—';
function stopAll(){clearInterval(mTimer);$("man").style.display="none";clearInterval(demoTimer);demoTimer=null;clearTimeout(retry);if(ws){ws.onclose=null;ws.close();ws=null}}
function goDemo(){stopAll();mode='demo';wsState='—';demoTimer=setInterval(demoFrame,100);$('bDemo').className='on';$('bLive').className='';$('bMan').className=''}
function goLive(){stopAll();mode='live';X.seq=-1;$('bLive').className='on';$('bDemo').className='';$('bMan').className='';everData=false;connect()}
function connect(){if(mode!=='live')return;wsState='connecting';
 try{const u=$('url').value.trim(),tk=$('tok').value.trim();ws=new WebSocket(tk?u+(u.includes('?')?'&':'?')+'token='+encodeURIComponent(tk):u);}catch(e){wsState='bad URL';return}
 ws.onopen=()=>{wsState='connected';ws.send(JSON.stringify({type:'hello',client:'skynex-3d',protocol:1}))};ws.onmessage=ev=>{try{ingest(JSON.parse(ev.data))}catch(e){console.warn('bad frame',e)}};
 ws.onerror=()=>{};ws.onclose=()=>{wsState='disconnected — retrying';retry=setTimeout(connect,2000)}}
$('bLive').onclick=goLive;$('bDemo').onclick=goDemo;
$('ac').onchange=()=>mode!=='live'&&setAircraft($('ac').value==='RQ11B'?'RAVEN':'EAGLE');
$('sc').onchange=()=>{if(mode!=='live'){setScenario($('sc').value);dT=0;dS=0;org=null}};
try{const u=localStorage.getItem('skynexWs');if(u)$('url').value=u;$('url').onchange=()=>localStorage.setItem('skynexWs',$('url').value)}catch(e){}
// ---------- cameras, replay, heartbeat, GLB ----------
function setCam(m){camMode=m;document.querySelectorAll('[data-cam]').forEach(b=>b.className=b.dataset.cam===m?'on':'')}
document.querySelectorAll('[data-cam]').forEach(b=>b.onclick=()=>setCam(b.dataset.cam));
addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(e.target.tagName))return;const m={1:'chase',2:'fpv',3:'top',4:'free'}[e.key];if(m)setCam(m)});
let drag=null;R.domElement.onpointerdown=e=>{drag=e;if(mode==='manual'&&camMode==='top')dragAircraft(e)};addEventListener('pointerup',()=>drag=null);
addEventListener('pointermove',e=>{if(drag&&mode==='manual'&&camMode==='top')dragAircraft(e);if(drag&&camMode==='free'){az-=(e.clientX-drag.clientX)*.005;el=Math.max(-.2,Math.min(1.4,el+(e.clientY-drag.clientY)*.005));drag=e}});
$('bRec').onclick=()=>{if(rep.on){rep.on=false;org=null;wpKey='';X.seq=-1;$('bRec').className='';return}
 let st=0;for(let i=rec.length-1;i>0;i--)if(rec[i].m.phase==='INITIALIZATION'&&rec[i-1].m.phase!=='INITIALIZATION'){st=i;break}
 if(rec.length-st<20)return;rep.fr=rec.slice(st);rep.i=0;rep.pt=0;rep.paused=false;rep.on=true;org=null;wpKey='';clearTrail();X.expo=0;resetHist();$('bRec').className='on'};
$('bPause').onclick=()=>{if(rep.on)rep.paused=!rep.paused;else frozen=!frozen;const pz=rep.on?rep.paused:frozen;$('bPause').innerHTML=pz?'▶ Resume':'⏸ Pause';$('bPause').classList.toggle('res',pz);ctl2(pz?'pause':'resume')};
setInterval(()=>{if(mode==='live'&&ws&&ws.readyState===1){try{ws.send(JSON.stringify({type:'ping',t:Date.now()}))}catch(e){}if(everData&&!rep.on&&performance.now()-last>6000)ws.close()}},3000); // watchdog -> reconnect
$('glb').onchange=ev=>{const f=ev.target.files[0];if(!f||!THREE.GLTFLoader)return;const r=new FileReader();r.onload=()=>new THREE.GLTFLoader().parse(r.result,'',g=>{glbCache[S.ac]=g;applyGLB(g)},er=>console.warn(er));r.readAsArrayBuffer(f)};
$('hm').onchange=ev=>{const f=ev.target.files[0];if(!f)return;const im=new Image();im.onload=()=>{const w=Math.min(512,im.width),h=Math.min(512,im.height),c=document.createElement('canvas');c.width=w;c.height=h;
 const x=c.getContext('2d');x.drawImage(im,0,0,w,h);const px=x.getImageData(0,0,w,h).data,d=new Float32Array(w*h);for(let i=0;i<w*h;i++)d[i]=px[i*4]/255;
 HM={d,w,h,amp:parseFloat($('hmA').value)||600};setScenario(S.sc);camSnap=true};im.src=URL.createObjectURL(f)};
// ---------- manual mode: draggable data, draggable aircraft, draggable panels, GLB drop ----------
let mTimer=null;
const M={px:0,pz:0,alt:150,speed:22,hdg:90,pitch:0,roll:0,rpm:5000,ws:8,wd:270,dust:0,ash:0,vis:8000,temp:24,f:{}};
const SL=[['alt','Altitude m',0,1500,1],['speed','Airspeed m/s',0,45,.5],['hdg','Heading °',0,359,1],['pitch','Pitch °',-30,30,.5],['roll','Roll °',-45,45,.5],['rpm','Engine/motor RPM',0,8000,50],['ws','Wind m/s',0,40,.5],['wd','Wind from °',0,359,1],['dust','Dust %',0,100,1],['ash','Ash %',0,100,1],['vis','Visibility m',500,10000,100],['temp','Temp °C',-20,50,1]];
const FC=['ENGINE_OVERHEAT','VIBRATION','LOW_BATTERY','HIGH_TEMP','DUST_EXPOSURE','LINK_LOSS','GNSS_DEGRADED'];
$('man').innerHTML='<b>Manual data — drag sliders</b>'+SL.map(([k,n,lo,hi,st])=>`<label>${n}<b id="v_${k}">${M[k]}</b></label><input type="range" id="s_${k}" min="${lo}" max="${hi}" step="${st}" value="${M[k]}">`).join('')+'<br><b>Fault flags (sent like Laptop 1 would)</b>'+FC.map(c=>`<label><span>${c}</span><input type="checkbox" id="c_${c}"></label>`).join('');
SL.forEach(([k])=>$('s_'+k).oninput=e=>{M[k]=parseFloat(e.target.value);$('v_'+k).textContent=M[k]});
FC.forEach(c=>$('c_'+c).onchange=e=>M.f[c]=e.target.checked);
function manualFrame(){const dt=.1,h=rad(M.hdg),la=12.97,E_=$('ac').value==='EAGLE_EYE_MINI',dn=Math.max(M.dust,M.ash)/100;
 M.px+=M.speed*Math.sin(h)*dt;M.pz-=M.speed*Math.cos(h)*dt;
 ingest({seq:++dSeq,aircraft_id:$('ac').value,scenario:$('sc').value,phase:'MANUAL',timestamp:new Date().toISOString(),
  flight:{altitude_m:M.alt,airspeed_ms:M.speed,heading_deg:M.hdg,pitch_deg:M.pitch,roll_deg:M.roll,latitude:la-M.pz/110574,longitude:77.59+M.px/(111320*Math.cos(rad(la)))},
  propulsion:{[E_?'engine_rpm':'motor_rpm']:M.rpm,battery_voltage_v:15,current_a:10},
  environment:{wind_speed_ms:M.ws,wind_dir_deg:M.wd,temperature_c:M.temp,turbulence:'MANUAL',visibility_m:M.vis*(1-.8*dn),dust:M.dust/100,ash:M.ash/100},
  faults:FC.filter(c=>M.f[c]).map(c=>({code:c,message:c.replace(/_/g,' ')}))})}
function goManual(){stopAll();mode='manual';wsState='—';X.seq=-1;org=null;M.px=M.pz=0;$('bMan').className='on';$('bDemo').className='';$('bLive').className='';$('man').style.display='block';mTimer=setInterval(manualFrame,100)}
$('bMan').onclick=goManual;
const rc=new THREE.Raycaster(),gp=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
function dragAircraft(e){const rb=R.domElement.getBoundingClientRect();rc.setFromCamera(new THREE.Vector2((e.clientX-rb.left)/rb.width*2-1,-((e.clientY-rb.top)/rb.height)*2+1),cam);gp.constant=-uav.position.y;if(rc.ray.intersectPlane(gp,hit)){M.px=hit.x;M.pz=hit.z}}
let zTop=10;document.querySelectorAll('.box').forEach(b=>{b.style.cursor='move';let o=null;
 b.addEventListener('pointerdown',e=>{b.style.zIndex=++zTop;if(/INPUT|SELECT|BUTTON|LABEL/.test(e.target.tagName)||e.target.dataset.k)return;const r=b.getBoundingClientRect();o={dx:e.clientX-r.left,dy:e.clientY-r.top};b.setPointerCapture(e.pointerId)});
 b.addEventListener('pointermove',e=>{if(!o)return;b.style.transform='none';b.style.right=b.style.bottom='auto';b.style.left=Math.max(0,Math.min(innerWidth-60,e.clientX-o.dx))+'px';b.style.top=Math.max(0,Math.min(innerHeight-30,e.clientY-o.dy))+'px'});
 b.addEventListener('pointerup',()=>o=null)});
function loadGLB(buf,t){if(!THREE.GLTFLoader)return;new THREE.GLTFLoader().parse(buf,'',g=>{glbCache[t]=g;if(S.ac===t)applyGLB(g)},er=>console.warn(er))}
addEventListener('dragover',e=>e.preventDefault());
addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&/\.glb$/i.test(f.name))f.arrayBuffer().then(b=>loadGLB(b,S.ac))});
// auto-load models listed in models/index.json ({"EAGLE":"eagle-eye-mini.glb","RAVEN":"rq-11b-raven.glb"}).
// The single-file build bakes the manifest into window.SKYNEX_MODELS, so a standalone .html probes nothing and logs no 404s.
const MDLM=window.SKYNEX_MODELS||null;
(MDLM?Promise.resolve(MDLM):fetch('models/index.json').then(r=>r.ok?r.json():null)).then(m=>{if(!m||typeof m!=='object')return;Object.keys(m).forEach(t=>{const f=m[t];if((t!=='EAGLE'&&t!=='RAVEN')||typeof f!=='string'||/\.\.|^\/|:/.test(f))return;fetch('models/'+f).then(r=>r.ok?r.arrayBuffer():null).then(b=>b&&loadGLB(b,t)).catch(()=>{})})}).catch(()=>{});
// ---------- REAL DATA loaders (need internet on Laptop 2) ----------
const QL={HIGH:{seg:200,veg:1},MED:{seg:150,veg:.6},LOW:{seg:100,veg:.3}};let quality="HIGH",sat=null,osm=null,pr=Math.min(devicePixelRatio,2),fpsA=.016;
const centre=()=>org||(([a,b])=>({lat:a,lon:b}))($('ll').value.split(',').map(Number));
const xz=(o,la,lo)=>({x:(lo-o.lon)*111320*Math.cos(o.lat*Math.PI/180),z:-(la-o.lat)*110574});
function srcText(){return `Terrain ${HM&&HM.real?'<span class="ok">REAL ('+(HM.src||'Copernicus DEM')+')</span>':HM?'user heightmap':'<span class="st">GENERATED (not real-world)</span>'} · Buildings ${osm?'<span class="ok">REAL (OpenStreetMap)</span>':'generated'} · Imagery ${sat?'Esri World Imagery':'none'}`}
function setSrc(m){$('dsrc').innerHTML=m||srcText()}
async function loadDEM(){const o=centre(),N=40,pts=[];
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=(i/(N-1)-.5)*8000,z=(j/(N-1)-.5)*8000;pts.push([o.lat-z/110574,o.lon+x/(111320*Math.cos(o.lat*Math.PI/180))])}
 const el=[];for(let k=0;k<pts.length;k+=100){const ch=pts.slice(k,k+100),r=await fetch('https://api.open-meteo.com/v1/elevation?latitude='+ch.map(q=>q[0].toFixed(5)).join()+'&longitude='+ch.map(q=>q[1].toFixed(5)).join());
  if(!r.ok)throw new Error('DEM HTTP '+r.status);el.push(...(await r.json()).elevation)}
 const mn=Math.min(...el),mx=Math.max(...el);HM={d:Float32Array.from(el,e=>(e-mn)/Math.max(1,mx-mn)),w:N,h:N,amp:Math.max(1,mx-mn),off:el[(N>>1)*N+(N>>1)]-mn,real:true};setScenario(S.sc);camSnap=true}
async function loadOSM(){const o=centre(),dl=1200/110574,dn=1200/(111320*Math.cos(o.lat*Math.PI/180)),bb=[o.lat-dl,o.lon-dn,o.lat+dl,o.lon+dn].join();
 const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(`[out:json][timeout:25];(way["building"](${bb});way["highway"](${bb}););out geom 3000;`)});
 if(!r.ok)throw new Error('OSM HTTP '+r.status);const j=await r.json();
 if(osm){scene.remove(osm);osm.traverse(x=>x.geometry&&x.geometry.dispose())}osm=new THREE.Group();
 const bm=new THREE.MeshStandardMaterial({color:0xb8bcc4,roughness:.8,flatShading:true}),rp=[];let nb=0;
 j.elements.forEach(w=>{if(!w.geometry)return;const pts=w.geometry.map(g=>xz(o,g.lat,g.lon)),t=w.tags||{};
  if(t.building&&nb<1500&&pts.length>3){const hh=parseFloat(t.height)||(parseFloat(t['building:levels'])||2)*3.2,
   g=new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(q=>new THREE.Vector2(q.x,-q.z))),{depth:hh,bevelEnabled:false});g.rotateX(-Math.PI/2);
   const m=new THREE.Mesh(g,bm);m.position.y=H(pts[0].x,pts[0].z);m.castShadow=m.receiveShadow=true;osm.add(m);nb++}
  else if(t.highway)for(let i=1;i<pts.length;i++)rp.push(pts[i-1].x,H(pts[i-1].x,pts[i-1].z)+.8,pts[i-1].z,pts[i].x,H(pts[i].x,pts[i].z)+.8,pts[i].z)});
 const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(rp,3));osm.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x20242a})));
 scene.add(osm);setScenario(S.sc)}
async function loadSat(){const o=centre(),z=14,n=2**z,tx=lo=>(lo+180)/360*n,ty=la=>(1-Math.log(Math.tan(rad(la))+1/Math.cos(rad(la)))/Math.PI)/2*n,
 dl=4000/110574,dn=4000/(111320*Math.cos(rad(o.lat))),x0=tx(o.lon-dn),x1=tx(o.lon+dn),y0=ty(o.lat+dl),y1=ty(o.lat-dl),Z=2048,cv=document.createElement('canvas');cv.width=cv.height=Z;const cx=cv.getContext('2d'),jobs=[];let ok=0;
 for(let Y=Math.floor(y0);Y<=Math.floor(y1);Y++)for(let X_=Math.floor(x0);X_<=Math.floor(x1);X_++)jobs.push(new Promise(res=>{const im=new Image();im.crossOrigin='anonymous';
  im.onload=()=>{cx.drawImage(im,(X_-x0)/(x1-x0)*Z,(Y-y0)/(y1-y0)*Z,Z/(x1-x0)+1,Z/(y1-y0)+1);ok++;res()};im.onerror=res;
  im.src=`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${Y}/${X_}`}));
 await Promise.all(jobs);if(!ok)throw new Error('no imagery tiles loaded');sat=new THREE.CanvasTexture(cv);sat.encoding=THREE.sRGBEncoding;sat.anisotropy=4;setScenario(S.sc)}
async function loadTIFF(file){if(!window.GeoTIFF)throw new Error('geotiff.js not loaded (needs internet)');
 const t=await GeoTIFF.fromArrayBuffer(await file.arrayBuffer()),img=await t.getImage(),gk=img.getGeoKeys();
 if(gk.ProjectedCSTypeGeoKey)throw new Error('projected CRS: reproject to EPSG:4326 (lat/lon) first');
 const w=img.getWidth(),h=img.getHeight(),[x0,y0,x1,y1]=img.getBoundingBox(),nd=img.getGDALNoData(),r=(await img.readRasters({interleave:false}))[0],o=centre();
 if(o.lon<x0||o.lon>x1||o.lat<y0||o.lat>y1)throw new Error('GeoTIFF does not cover '+o.lat.toFixed(3)+','+o.lon.toFixed(3));
 const N=256,el=new Float32Array(N*N),at=(px,py)=>{const i=Math.max(0,Math.min(w-1,px|0)),j=Math.max(0,Math.min(h-1,py|0)),v=r[j*w+i];return(nd!=null&&v===nd)||v<-500?NaN:v};
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=(i/(N-1)-.5)*8000,z=(j/(N-1)-.5)*8000,la=o.lat-z/110574,lo=o.lon+x/(111320*Math.cos(rad(o.lat)));el[j*N+i]=at((lo-x0)/(x1-x0)*w,(y1-la)/(y1-y0)*h)}
 let mn=1e9,mx=-1e9,n=0;for(const e of el)if(Number.isFinite(e)){n++;if(e<mn)mn=e;if(e>mx)mx=e}
 if(n<N*N/2)throw new Error('GeoTIFF covers less than half of the 8 km area');
 for(let i=0;i<el.length;i++)if(!Number.isFinite(el[i]))el[i]=mn;
 HM={d:el.map(e=>(e-mn)/Math.max(1,mx-mn)),w:N,h:N,amp:Math.max(1,mx-mn),off:el[(N>>1)*N+(N>>1)]-mn,real:true,src:'GeoTIFF'};setScenario(S.sc);camSnap=true}
const runLoad=f=>{setSrc('loading…');f().then(()=>setSrc()).catch(e=>setSrc('<span class="off">Failed: '+esc(e.message)+' (needs internet on this laptop). Using generated data.</span>'))};
$('tif').onchange=e=>{const f=e.target.files[0];if(f)runLoad(()=>loadTIFF(f))};$('bDEM').onclick=()=>runLoad(loadDEM);$('bOSM').onclick=()=>runLoad(loadOSM);$('bSat').onclick=()=>runLoad(loadSat);setSrc();
// ---------- scrubbable values inside the status box (manual mode) ----------
const sv=(k,t)=>mode==='manual'?`<span class="scrub" data-k="${k}" title="drag left/right">${t}</span>`:t;
function setM(k,v){M[k]=v;$('s_'+k).value=v;$('v_'+k).textContent=v}
{const hud=document.body;let sc2=null;
 hud.addEventListener('pointerdown',e=>{const k=e.target.dataset&&e.target.dataset.k;if(!k||mode!=='manual')return;const d=SL.find(q=>q[0]===k);sc2={k,x:e.clientX,v:M[k],lo:d[2],hi:d[3],st:d[4]};hud.setPointerCapture(e.pointerId)});
 hud.addEventListener('pointermove',e=>{if(!sc2)return;let v=sc2.v+(e.clientX-sc2.x)*(sc2.hi-sc2.lo)/300;v=Math.round(v/sc2.st)*sc2.st;v=sc2.k==='hdg'||sc2.k==='wd'?((v%360)+360)%360:Math.max(sc2.lo,Math.min(sc2.hi,v));setM(sc2.k,v)});
 hud.addEventListener('pointerup',()=>sc2=null)}
$('ql').onchange=()=>{quality=$('ql').value;setScenario(S.sc)};
// ---------- mission UI (layout from the SKYNEX mockup) ----------
const SCN={FOREST:{z:'Forest',n:'FOREST ENVIRONMENT',ic:'🌲',hum:78,d:'Low altitude flight over dense forest with turbulence and changing weather'},
 URBAN:{z:'Urban',n:'URBAN ENVIRONMENT',ic:'🏙️',hum:55,d:'Flight between city blocks with wind corridors and GNSS-degraded zones'},
 ASH:{z:'Ash Zone',n:'VOLCANIC ASH ENVIRONMENT',ic:'🌋',hum:40,d:'Approach and crossing of a volcanic ash plume with falling visibility and sensor exposure'},
 DESERT:{z:'Desert',n:'DESERT ENVIRONMENT',ic:'🏜️',hum:12,d:'Flight over dunes with dust storms, high temperature and low humidity'},
 MOUNTAIN:{z:'Mountain',n:'MOUNTAIN ENVIRONMENT',ic:'⛰️',hum:60,d:'Flight around mountain terrain with wind shear, cloud and low temperature'}};
const AC_SPEC={RAVEN:{name:'RQ-11B Raven',type:'Electric',rows:[['Max Takeoff Weight','1.9 kg'],['Endurance','~90 min'],['Cruise Speed','25 – 30 m/s'],['Service Ceiling','~4500 m']]},
 EAGLE:{name:'Eagle Eye Mini',type:'Petrol engine',rows:[['Max Takeoff Weight','—'],['Endurance','—'],['Cruise Speed','—'],['Service Ceiling','—']]}}; // fill Eagle Eye Mini from its datasheet
let simSpeed=1,uiT=0,topT=0,pAlt=0,vsp=0,lastAc='',lastSc='',evCur=-1,hLast=-1,lastMt=0,EV=[],FEV=[];const HS={a:[],b:[],c:[],spd:[],alt:[],pit:[],rol:[]},PF=[],seenF=new Set();
function resetHist(){for(const k in HS)HS[k].length=0;PF.length=0;EV=[];FEV=[];seenF.clear();evCur=-1;hLast=-1;lastMt=0;X.dist=0;X.ts0=0;X.mt=0}
const PHI={INITIALIZATION:0,TAKEOFF:1,CLIMB:2,ENVIRONMENT:3,CRUISE:5,DESCENT:6,LANDING:7},STI={TAKEOFF:0,CLIMB:1,ENVIRONMENT:2,CRUISE:3,DESCENT:4,LANDING:5};
const fmt=t=>{t=Math.max(0,Math.floor(t));return String(t/60|0).padStart(2,'0')+':'+String(t%60).padStart(2,'0')},fmtH=t=>{t=Math.max(0,Math.floor(t));return String(t/3600|0).padStart(2,'0')+':'+fmt(t%3600)};
const cardinal=d=>['N','NE','E','SE','S','SW','W','NW'][Math.round(((d%360)+360)%360/45)%8],cap=t=>String(t).charAt(0)+String(t).slice(1).toLowerCase();
function ctl2(cmd,v){if(mode==='live'&&ws&&ws.readyState===1)try{ws.send(JSON.stringify({type:'control',cmd,value:v}))}catch(e){}} // optional: Laptop 1 may act on these
function setSp(v){simSpeed=v;$('sp1').className=v===1?'on':'';$('sp2').className=v===2?'on':'';ctl2('speed',v)}
$('sp1').onclick=()=>setSp(1);$('sp2').onclick=()=>setSp(2);$('bGear').onclick=()=>$('ctl').classList.toggle('open');
function doReset(){resetHist();clearTrail();frozen=false;rep.on=false;$('bPause').innerHTML='⏸ Pause';$('bPause').classList.remove('res');
 if(mode==='demo'){dT=0;dS=0;dEx=0}if(mode==='manual'){M.px=M.pz=0}org=null;wpKey='';X.seq=-1;X.expo=0;camSnap=true;qSnap=true;ctl2('reset')}
$('bReset').onclick=doReset;
new ResizeObserver(()=>fit()).observe($('view'));
function fit(){const v=$('view'),w=v.clientWidth||innerWidth,h=v.clientHeight||innerHeight;R.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix()}
const cells=()=>{const r=S.ac==='RAVEN';return[
 {i:'🔋',l:r?'Battery Voltage':'Engine RPM',k:'a',u:r?'V':'rpm',v:r?X.volt:cur.rpm,d:r?1:0,c:'#22c55e'},
 {i:'⚡',l:r?'Battery Current':'Fuel Level',k:'b',u:r?'A':'%',v:r?X.amp:X.fuel,d:1,c:'#f59e0b'},
 {i:'🌡',l:r?'Motor Temperature':'Engine Temperature',k:'c',u:'°C',v:X.mtemp,d:0,c:'#ef4444'},
 {i:'⏱',l:'Airspeed',k:'spd',u:'m/s',v:X.speed,d:1,c:'#3b82f6'},{i:'⛰',l:'Altitude',k:'alt',u:'m',v:cur.alt,d:0,c:'#a855f7'},
 {i:'↕',l:'IMU Pitch',k:'pit',u:'°',v:cur.pitch,d:1,c:'#22c55e'},{i:'⟲',l:'IMU Roll',k:'rol',u:'°',v:cur.roll,d:1,c:'#f59e0b'}]};
$('tstrip').innerHTML=Array.from({length:7},(_,i)=>`<div class="tc"><div class="th"><span id="ti${i}"></span><small id="tl${i}"></small></div><b id="tv${i}">—</b><canvas id="tg${i}" width="240" height="96"></canvas></div>`).join('');
function chart(cv,arr,col){const g=cv.getContext('2d'),W=cv.width,Hh=cv.height;g.clearRect(0,0,W,Hh);if(arr.length<2)return;
 let mn=Math.min(...arr),mx=Math.max(...arr);if(mx-mn<1e-6){mn-=1;mx+=1}const pd=(mx-mn)*.15;mn-=pd;mx+=pd;g.font='10px sans-serif';g.lineWidth=1;
 for(let i=0;i<4;i++){const y=6+i*(Hh-24)/3;g.strokeStyle='#1e2d47';g.beginPath();g.moveTo(28,y);g.lineTo(W,y);g.stroke();g.fillStyle='#8aa0c0';g.fillText((mx-(mx-mn)*i/3).toFixed(Math.abs(mx)<20?1:0),0,y+3)}
 g.fillStyle='#8aa0c0';g.fillText('0',28,Hh-3);g.fillText('Time (s)',W/2-18,Hh-3);g.fillText('500',W-22,Hh-3);
 g.strokeStyle=col;g.lineWidth=1.6;g.beginPath();arr.forEach((v,i)=>{const x=28+i/499*(W-32),y=6+(1-(v-mn)/(mx-mn))*(Hh-24);i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke()}
function minimap(){const cv=$('mm'),g=cv.getContext('2d'),W=cv.width,Hh=cv.height;g.fillStyle='#'+new THREE.Color(SC[S.sc].g).multiplyScalar(.75).getHexString();g.fillRect(0,0,W,Hh);
 const pts=PF.map(p=>[p.x,p.z]).concat(WPS.map(v=>[v.x,v.z]),[[cur.x,cur.z]]);let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;pts.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z)});
 const sc=Math.min((W-24)/Math.max(60,x1-x0),(Hh-24)/Math.max(60,z1-z0)),ox=(W-(x1-x0)*sc)/2,oz=(Hh-(z1-z0)*sc)/2,mp=(x,z)=>[ox+(x-x0)*sc,oz+(z-z0)*sc];
 g.setLineDash([5,4]);g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();PF.forEach((p,i)=>{const q=mp(p.x,p.z);i?g.lineTo(...q):g.moveTo(...q)});g.stroke();g.setLineDash([]);
 if(PF.length){const q=mp(PF[0].x,PF[0].z);g.fillStyle='#22c55e';g.beginPath();g.arc(q[0],q[1],5,0,7);g.fill()}
 if(WPS.length){const q=mp(WPS[WPS.length-1].x,WPS[WPS.length-1].z);g.fillStyle='#fff';g.fillRect(q[0]-5,q[1]-5,10,10);g.fillStyle='#000';g.fillRect(q[0]-5,q[1]-5,5,5);g.fillRect(q[0],q[1],5,5)}
 const q=mp(cur.x,cur.z);g.save();g.translate(q[0],q[1]);g.rotate(rad(cur.hdg));g.fillStyle='#ef4444';g.beginPath();g.moveTo(0,-9);g.lineTo(6,8);g.lineTo(0,4);g.lineTo(-6,8);g.fill();g.restore()}
function sideView(){const cv=$('sv'),g=cv.getContext('2d'),W=cv.width,Hh=cv.height,L=48,tp=8,bt=26,pw=W-L-10,ph=Hh-tp-bt,c=SC[S.sc],km=X.dist/1000;
 const xm=[1,2,5,10,20,30,50,100,200].find(v=>v>=Math.max(.8,km*1.15))||200,ma=Math.max(0,cur.alt,...PF.map(p=>p.alt)),ym=[200,400,600,1000,1500,2500,5000].find(v=>v>=ma*1.15)||5000;
 const xx=d=>L+d/1000/xm*pw,yy=a=>tp+ph-a/ym*ph;g.clearRect(0,0,W,Hh);const gr=g.createLinearGradient(0,tp,0,tp+ph);gr.addColorStop(0,'#2b5d9b');gr.addColorStop(1,'#a9c7e4');g.fillStyle=gr;g.fillRect(L,tp,pw,ph);
 const gc='#'+new THREE.Color(c.g).getHexString();g.fillStyle=gc;g.fillRect(L,yy(0)-5,pw,5);
 if(PF.length>1){g.beginPath();g.moveTo(xx(PF[0].d),yy(0));PF.forEach(p=>g.lineTo(xx(p.d),yy(Math.max(0,p.gh))));g.lineTo(xx(PF[PF.length-1].d),yy(0));g.closePath();g.fill()}
 const z=PF.filter(p=>p.ph==='ENVIRONMENT');g.font='11px Segoe UI,sans-serif';if(z.length>1){g.fillStyle='rgba(220,60,60,.38)';g.fillRect(xx(z[0].d),tp,xx(z[z.length-1].d)-xx(z[0].d),ph);g.fillStyle='#fff';g.fillText(SCN[S.sc].z+' Area',xx(z[0].d)+6,tp+14)}
 g.strokeStyle='#33496e';g.fillStyle='#b6c4dc';g.lineWidth=1;for(let i=0;i<4;i++){const a=ym*i/3,y=yy(a);g.beginPath();g.moveTo(L,y);g.lineTo(L+pw,y);g.stroke();g.fillText(a.toFixed(0),6,y+4)}
 for(let i=0;i<=5;i++){g.fillText((xm*i/5).toFixed(xm<5?1:0),L+pw*i/5-6,Hh-10)}g.fillText('Distance (km)',L+pw/2-30,Hh-1);g.save();g.translate(11,tp+ph/2+30);g.rotate(-Math.PI/2);g.fillText('Altitude (m)',0,0);g.restore();
 g.setLineDash([6,4]);g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();PF.forEach((p,i)=>i?g.lineTo(xx(p.d),yy(p.alt)):g.moveTo(xx(p.d),yy(p.alt)));g.stroke();g.setLineDash([]);
 if(PF.length){g.fillStyle='#22c55e';g.beginPath();g.arc(xx(PF[0].d),yy(PF[0].alt),5,0,7);g.fill();g.fillStyle='#fff';g.fillText('Takeoff',xx(PF[0].d)+8,yy(PF[0].alt)-8)}
 g.fillStyle='#fff';g.beginPath();g.moveTo(xx(X.dist)+9,yy(cur.alt));g.lineTo(xx(X.dist)-7,yy(cur.alt)-6);g.lineTo(xx(X.dist)-7,yy(cur.alt)+6);g.fill();if(X.phase==='LANDING')g.fillText('🏁',xx(X.dist)+4,yy(cur.alt)-8)}
const RT=new THREE.WebGLRenderTarget(320,180,{encoding:THREE.sRGBEncoding}),topCam=new THREE.PerspectiveCamera(50,320/180,1,14000),pxb=new Uint8Array(320*180*4),tctx=$('cvTop').getContext('2d'),tim=tctx.createImageData(320,180);
let tvT=0;
function topView(dt){ // GPU render + 320x180 pixel readback: throttle to ~8 fps and skip while the panel is scrolled out of view
 tvT+=dt;const r=$('cvTop').getBoundingClientRect();if(tvT<.12||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)return;tvT=0;
 topCam.position.set(cur.x,uav.position.y+260,cur.z+.01);topCam.up.set(0,0,-1);topCam.lookAt(uav.position);
 R.setRenderTarget(RT);R.render(scene,topCam);R.setRenderTarget(null);R.readRenderTargetPixels(RT,0,0,320,180,pxb);
 for(let y=0;y<180;y++)tim.data.set(pxb.subarray((179-y)*1280,(180-y)*1280),y*1280);tctx.putImageData(tim,0,0);
 tctx.save();tctx.translate(160,90);tctx.rotate(rad(cur.hdg));tctx.fillStyle='#ef4444';tctx.beginPath();tctx.moveTo(0,-11);tctx.lineTo(8,10);tctx.lineTo(0,5);tctx.lineTo(-8,10);tctx.fill();tctx.restore()}
function updateUI(now,dt,stale,dens0){
 $('dial').style.transform=`rotate(${-cur.hdg}deg)`;vsp+=((cur.alt-pAlt)/Math.max(dt,.001)-vsp)*.05;pAlt=cur.alt;
 const dM=X.mt-lastMt;if(dM>0&&dM<5)X.dist+=X.speed*dM;lastMt=X.mt;
 const ci=PHI[X.phase];if(ci!=null&&ci>evCur){for(let i=evCur+1;i<=ci;i++)EV[i]=X.mt;evCur=ci}
 for(const q of X.list)if(!seenF.has(q.code)){seenF.add(q.code);FEV.push({t:X.mt,m:q.message})}
 for(const c of [...seenF])if(!X.f[c])seenF.delete(c);
 if(X.mt-hLast>=1||X.mt<hLast){hLast=X.mt;const cs=cells();['a','b','c','spd','alt','pit','rol'].forEach((k,i)=>{const v=cs[i].v;HS[k].push(Number.isFinite(v)?v:0);if(HS[k].length>500)HS[k].shift()});
  PF.push({d:X.dist,alt:cur.alt,gh:H(cur.x,cur.z),x:cur.x,z:cur.z,ph:X.phase});if(PF.length>3000)PF.shift()}
 uiT+=dt;if(uiT<.25)return;uiT=0;
 let lt,lc;if(mode==='manual'){lt='MANUAL CONTROL';lc='#a78bfa'}else if(rep.on){lt='MISSION REPLAY';lc='#38bdf8'}else if(frozen){lt='PAUSED';lc='#fbbf24'}
 else if(mode==='demo'){lt='DEMO SIMULATION';lc='#4ade80'}else if(wsState!=='connected'){lt=wsState.toUpperCase();lc='#f87171'}else if(stale){lt='STALE DATA';lc='#fbbf24'}else{lt='LIVE SIMULATION';lc='#4ade80'}
 $('livet').textContent=lt;$('live').style.color=lc;$('mtime').textContent=fmtH(X.mt);
 const a=AC_SPEC[S.ac];if(lastAc!==S.ac){lastAc=S.ac;$('aname').textContent=a.name;$('atype').textContent='('+a.type+')';
  $('aimg').innerHTML=`<svg viewBox="0 0 200 80" width="190"><g fill="#e5e7eb"><ellipse cx="100" cy="42" rx="${S.ac==='EAGLE'?72:62}" ry="7"/><path d="M95 40L58 6L72 6L120 40Z"/><path d="M95 44L58 78L72 78L120 44Z" opacity=".85"/><path d="M165 40L184 20L190 20L178 42Z"/><path d="M165 44L188 54L168 48Z"/></g><circle cx="30" cy="42" r="6" fill="#64748b"/></svg>`;
  $('aspec').innerHTML=a.rows.map(r=>`<div class="sr"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}
 const sn=SCN[S.sc];if(lastSc!==S.sc){lastSc=S.sc;$('sicon').textContent=sn.ic;$('sname').textContent=sn.n;$('sdesc').textContent=sn.d}
 const si=STI[X.phase]??-1,sl=['Takeoff','Climb',sn.z+' Flight','Cruise','Descent','Landing'];
 $('steps').innerHTML=sl.map((t,i)=>`<div class="stp ${i<si?'done':i===si?'cur':''}">${t}<i></i></div>`).join('');
 const vis=E.vis>=1000?(E.vis/1000).toFixed(1)+' km':E.vis.toFixed(0)+' m',dn=Math.max(E.dust,E.ash);
 const er=[['🌡','Temperature',`${sv('temp',E.temp.toFixed(0))} °C`],['💨','Wind Speed',`${sv('ws',E.ws.toFixed(0))} m/s`],['🧭','Wind Direction',`${sv('wd',E.wd.toFixed(0))}° (${cardinal(E.wd)})`],
  ['💧','Humidity',E.hum==null?'—':E.hum.toFixed(0)+' %'],['〰️','Turbulence',cap(E.turb)],['👁','Visibility',vis]];
 if(S.sc==='ASH'||S.sc==='DESERT'){er.push(['🌫',S.sc==='ASH'?'Ash conc.':'Dust conc.',(dn*100).toFixed(0)+' %'],['📟','Sensor contam. (reported)',X.sens==null?'n/a':X.sens.toFixed(0)+' %'])}
 $('env').innerHTML=er.map(r=>`<div class="er"><span>${r[0]}</span><span>${r[1]}</span><b>${r[2]}</b></div>`).join('');
 const nm=['Mission started','Takeoff completed','Climb to mission altitude',`Entered ${sn.z.toLowerCase()} area`,`Executing ${sn.z.toLowerCase()} mission`,'Cruise','Descent','Landing'];
 $('evl').innerHTML=nm.map((n,i)=>`<div class="evr ${i<evCur?'done':i===evCur?'cur':''}"><i></i><span>${EV[i]!=null?fmt(EV[i]):'--:--'}</span><b>${n}</b></div>`).join('')+FEV.slice(-5).map(f=>`<div class="evr cur"><i></i><span>${fmt(f.t)}</span><b>⚠ ${f.m}</b></div>`).join('');
 const la=X.lat,lo=X.lon;$('tel').innerHTML=`<div><span>Altitude</span><b>${sv('alt',cur.alt.toFixed(0))} m</b></div><div><span>Airspeed</span><b>${sv('speed',X.speed.toFixed(1))} m/s</b></div><div><span>Vertical Speed</span><b>${vsp.toFixed(1)} m/s</b></div><div><span>Position</span><b>${Math.abs(la).toFixed(4)} ${la<0?'S':'N'}, ${Math.abs(lo).toFixed(4)} ${lo<0?'W':'E'}</b></div><div><span>Heading</span><b>${sv('hdg',String(Math.round(cur.hdg)%360).padStart(3,'0'))}°</b></div>${mode==='manual'?'<div><small class="st">drag underlined values left/right</small></div>':''}`;
 const cs=cells(),hk=['a','b','c','spd','alt','pit','rol'];cs.forEach((c,i)=>{$('ti'+i).textContent=c.i;$('tl'+i).textContent=c.l;$('tv'+i).textContent=Number.isFinite(c.v)&&c.v!==null?c.v.toFixed(c.d)+' '+c.u:'n/a';chart($('tg'+i),HS[hk[i]],c.c)});
 minimap();sideView();topView(dt);
 $('fl').innerHTML='<b>Aircraft health (from Laptop 1)</b><br>'+(X.list.length?X.list.map(q=>`<span class="off">${ICON[q.code]||'⚠'} ${q.message}</span>`).join('<br>'):'<span class="ok">No faults reported</span>')+`<br><small>${srcText()} · ${X.drop}/${X.bad} rejected</small>`;
 $('stale').style.display=stale?'block':'none';$('warn').style.display=X.anom?'block':'none';$('warn').textContent='⚠ '+(X.anom||'');
}
// ---------- main loop ----------
const wrap=a=>((a+540)%360)-180;let prev=performance.now(),hudT=0,hz=0;
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-prev)/1000);prev=now;fpsA=fpsA*.97+dt*.03;if(fpsA>.034&&pr>1){pr=Math.max(1,pr-.25);R.setPixelRatio(pr);fit();fpsA=.016}else if(fpsA>.04&&pr<=1&&quality!=="LOW"){quality=quality==="HIGH"?"MED":"LOW";$("ql").value=quality;setScenario(S.sc);fpsA=.016}
 if(rep.on&&!rep.paused){rep.pt+=dt*parseFloat($('spd').value);const t0=rep.fr[0].t;while(rep.i<rep.fr.length&&rep.fr[rep.i].t-t0<=rep.pt*1000){ingest(Object.assign({__rep:1},rep.fr[rep.i].m));rep.i++}if(rep.i>=rep.fr.length){rep.paused=true;X.mstate='REPLAY COMPLETE'}}
 const stale=everData&&!rep.on&&!frozen&&now-last>2000,k=1-Math.exp(-dt*5);
 cur.x+=(T.x-cur.x)*k;cur.z+=(T.z-cur.z)*k;cur.alt+=(T.alt-cur.alt)*k;cur.hdg=(cur.hdg+wrap(T.hdg-cur.hdg)*k+360)%360;
 cur.pitch+=(T.pitch-cur.pitch)*k;cur.roll+=(T.roll-cur.roll)*k;cur.rpm+=(T.rpm-cur.rpm)*k;
 const gh=H(cur.x,cur.z)+1.5,y=X.agl?gh+cur.alt:Math.max(cur.alt,gh);
 uav.position.set(cur.x,y,cur.z);tq.setFromEuler(eu.set(rad(T.pitch),-rad(T.hdg),-rad(T.roll),'YXZ'));if(qSnap){curQ.copy(tq);qSnap=false}else curQ.slerp(tq,k);uav.quaternion.copy(curQ);
 const vib=X.f.VIBRATION?1:0;mdl.position.set((Math.random()-.5)*.08*vib,(Math.random()-.5)*.08*vib,0);
 prop.rotation.z+=Math.min(cur.rpm/60*6.283*.08,45)*dt;disc.material.opacity=Math.min(.35,cur.rpm/6000*.4);
 const pl=.5+.5*Math.sin(now*.008);
 shell.visible=!!(X.f.DUST_EXPOSURE||(X.anom&&!X.nf));if(shell.visible){shell.material.color.set(X.f.DUST_EXPOSURE?0xf59e0b:0xff2d2d);shell.material.opacity=.25+.35*pl}
 if(cowl&&cowl.material.emissive){const hot=X.f.ENGINE_OVERHEAT||X.f.HIGH_TEMP;cowl.material.emissive.set(hot?0xff3300:0x000000);cowl.material.emissiveIntensity=hot?pl:0}
 if(!stale&&everData){pushTrail(cur.x,y,cur.z);X.expo+=Math.max(E.dust,E.ash)*dt}
 // environment effects
 const c=[cur.x,y,cur.z],tow=rad(E.wd+180),wv={x:Math.sin(tow)*E.ws,z:-Math.cos(tow)*E.ws};
 const wx=WX[$('wx').value]||WX.CLEAR,dens0=Math.max(E.dust,E.ash),dens=Math.max(dens0,wx.haze);
 haze.m.material.color.set(wx.haze>dens0?wx.hc:E.ash>E.dust?0x5a5550:SC[S.sc].haze);
 clouds.visible=!!wx.cloud||S.sc==='MOUNTAIN';rain.m.visible=!!wx.rain;if(wx.rain)rain.step(dt,c,{x:wv.x*.3,y:-60,z:wv.z*.3},1);hemi.intensity=.9*wx.dim;
 haze.step(dt,c,wv,dens);plumeStep(dt,wv);wind.step(dt,c,wv,Math.min(1,E.ws/20));
 scene.fog.density+=(3/Math.max(300,Math.min(E.vis,wx.vis))-scene.fog.density)*Math.min(1,dt*2);
 // chase camera
 const fx=Math.sin(rad(cur.hdg)),fz=-Math.cos(rad(cur.hdg)),P0=uav.position,fw=new THREE.Vector3(0,0,-1).applyQuaternion(curQ);
 let want,aim=P0.clone(),sp=3;cam.up.set(0,1,0);
 if(camMode==='fpv'){want=P0.clone().add(new THREE.Vector3(0,.6,0).applyQuaternion(curQ)).addScaledVector(fw,7.5);aim=want.clone().addScaledVector(fw,100);sp=14}
 else if(camMode==='top'){const hold=drag&&mode==='manual';want=hold?cam.position.clone():new THREE.Vector3(cur.x,y+camDist*10,cur.z+.01);cam.up.set(0,0,-1);if(hold)aim=look.clone()}
 else if(camMode==='free'){const r=camDist*1.5;want=new THREE.Vector3(cur.x+r*Math.cos(el)*Math.sin(az),y+r*Math.sin(el),cur.z+r*Math.cos(el)*Math.cos(az))}
 else want=new THREE.Vector3(cur.x-fx*camDist,y+camDist*.28,cur.z-fz*camDist);
 if(camSnap){cam.position.copy(want);look.copy(aim);camSnap=false}else{cam.position.lerp(want,1-Math.exp(-dt*sp));look.lerp(aim,1-Math.exp(-dt*Math.max(sp,6)))}
 if(camMode!=='top')cam.position.y=Math.max(cam.position.y,H(cam.position.x,cam.position.z)+3);cam.lookAt(look);
 const th=($('tod').value-6)/12*Math.PI,sy=Math.max(.05,Math.sin(th)),sd=new THREE.Vector3(Math.cos(th),Math.max(.12,sy),-.3).normalize();
 sun.position.copy(uav.position).addScaledVector(sd,1500);sun.target.position.copy(uav.position);sun.intensity=(.25+.9*sy)*wx.dim;sun.color.setHSL(.1,(1-sy)*.6,.92);sky.material.uniforms.sunDir.value.copy(sd);sky.material.uniforms.dim.value=.4+.6*wx.dim;
 sky.position.copy(cam.position);R.render(scene,cam);
 hudT+=dt;updateUI(now,dt,stale,dens0);
}
fit();resetHist();setScenario('FOREST');setAircraft('EAGLE');requestAnimationFrame(loop);
// ---------- scenario lobby (layout from mockup 2) ----------
const CARDS=[['FOREST','Forest','UAV flying over dense forest with variable wind and turbulence',['#22a559','#0d3b22'],[['Wind Speed','5 – 15 m/s'],['Temperature','18 – 28 °C'],['Humidity','60 – 90 %'],['Turbulence','Moderate']]],
['URBAN','Urban','UAV flying over city with building-induced wind and GNSS multipath',['#2f7de1','#0d2a52'],[['Wind Speed','8 – 20 m/s'],['Temperature','20 – 32 °C'],['GNSS Quality','Variable'],['Turbulence','High (buildings)']]],
['ASH','Volcanic Ash','UAV encountering volcanic ash plume',['#d93a3a','#4a1212'],[['Ash Concentration','0 – 10 mg/m³'],['Temperature','5 – 25 °C'],['Wind Speed','10 – 25 m/s'],['Visibility','Low']]],
['DESERT','Desert','UAV flying over desert with dust and high temperature',['#e8912a','#4a2e0a'],[['Dust Concentration','0 – 15 mg/m³'],['Temperature','35 – 48 °C'],['Wind Speed','10 – 22 m/s'],['Humidity','5 – 20 %']]],
['MOUNTAIN','Mountain','UAV flying over mountains with wind shear and low temperature',['#8b5cf6','#2a1752'],[['Wind Speed','10 – 30 m/s'],['Temperature','-10 – 10 °C'],['Pressure','70 – 90 kPa'],['Turbulence','High']]]];
const SKY={FOREST:['#9ec9e8','#2f5d34','#164a24'],URBAN:['#aab8c8','#4a4f55','#6b7280'],ASH:['#6a5f58','#2b2724','#5b4a40'],DESERT:['#e8c98f','#d2a65e','#f0d08a'],MOUNTAIN:['#b8d0e8','#6b7078','#f2f5f8']};
function art(k,c){const C=SKY[k];let o=`<svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice"><rect width="400" height="200" fill="${C[0]}"/>`;
 if(k==='FOREST')o+=`<path d="M0 120 Q100 90 200 115 T400 105 V200 H0Z" fill="${C[1]}"/><path d="M150 200 Q190 150 260 130" stroke="#2d6a8f" stroke-width="10" fill="none"/>`+Array.from({length:34},(_,i)=>`<path d="M${i*12+4} ${150+(i*7)%34} l-6 15 h12z" fill="${C[2]}"/>`).join('');
 if(k==='URBAN')o+=`<rect y="150" width="400" height="50" fill="#3a3f46"/>`+Array.from({length:18},(_,i)=>{const hh=40+(i*37)%95;return`<rect x="${i*23}" y="${150-hh}" width="19" height="${hh}" fill="${i%2?C[1]:C[2]}"/>`}).join('');
 if(k==='ASH')o+=`<path d="M0 160 L120 100 L170 75 L230 105 L400 150 V200 H0Z" fill="${C[1]}"/><path d="M165 76 q-20 -55 20 -78 q60 22 20 78z" fill="#3a332e" opacity=".85"/><circle cx="170" cy="74" r="9" fill="#ff5a1f"/><ellipse cx="270" cy="45" rx="130" ry="26" fill="#4a423c" opacity=".75"/>`;
 if(k==='DESERT')o+=`<path d="M0 140 Q80 105 170 135 T400 120 V200 H0Z" fill="${C[1]}"/><path d="M0 175 Q110 145 220 168 T400 158 V200 H0Z" fill="${C[2]}"/><ellipse cx="285" cy="110" rx="110" ry="26" fill="#d9b27a" opacity=".55"/>`;
 if(k==='MOUNTAIN')o+=`<path d="M0 170 L90 75 L140 115 L210 30 L290 125 L340 85 L400 155 V200 H0Z" fill="${C[1]}"/><path d="M210 30 L185 72 L205 64 L215 80 L235 64Z" fill="${C[2]}"/><path d="M0 180 Q100 160 200 175 T400 168 V200 H0Z" fill="#3d6b35"/>`;
 return o+`<path d="M30 170 Q110 80 210 90 T370 160" stroke="#fff" stroke-width="2.2" stroke-dasharray="6 5" fill="none"/>`+[[30,170,'Takeoff'],[110,100,'Climb'],[230,92,'Cruise'],[370,160,'Landing']].map(([x,y,t])=>`<circle cx="${x}" cy="${y}" r="5" fill="${c}" stroke="#fff"/><text x="${x-14}" y="${y-9}" fill="#fff" font-size="11" font-weight="700" stroke="#000" stroke-width=".4">${t}</text>`).join('')+`</svg>`}
const altAt=(t,ca)=>t<4?0:t<12?((t-4)/8<.5?0:((t-4)/8-.5)*60):t<26?30+(t-12)/14*(ca-30):t<80?ca:t<98?ca-(ca-20)*(t-80)/18:20*(1-(t-98)/12);
function drawCard(el,k,c){const ca=SC[k].amp>200?250:150,a=el.querySelector('[data-a]'),p=el.querySelector('[data-p]');
 {const W=a.width=320,Hh=a.height=100,g=a.getContext('2d');g.fillStyle='#8aa0c0';g.font='10px sans-serif';g.fillText(ca+' m',2,12);g.fillText('0',2,Hh-4);g.fillText('Planned altitude, 110 s demo mission',70,Hh-3);g.strokeStyle=c;g.lineWidth=2;g.beginPath();for(let t=0;t<=110;t+=2){const x=26+t/110*(W-32),y=10+(1-altAt(t,ca)/ca)*(Hh-26);t?g.lineTo(x,y):g.moveTo(x,y)}g.stroke()}
 {const W=p.width=140,Hh=p.height=100,g=p.getContext('2d');g.fillStyle='#'+new THREE.Color(SC[k].g).multiplyScalar(.75).getHexString();g.fillRect(0,0,W,Hh);g.setLineDash([5,4]);g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();for(let u=0;u<=4.5;u+=.1){const x=W/2+(Math.sin(u)*.5-.15)*W*.8,y=Hh*.15+(1-Math.cos(u))*Hh*.38;u?g.lineTo(x,y):g.moveTo(x,y)}g.stroke();g.fillStyle='#22c55e';g.beginPath();g.arc(W/2-W*.12,Hh*.15,4,0,7);g.fill()}}
function buildLobby(){$('lsc').innerHTML=CARDS.map(([k,t],i)=>`<option value="${k}">${i+1}. ${t}</option>`).join('');
 $('grid').innerHTML=CARDS.map(([k,t,d,c,rows],i)=>`<div class="cd" data-k="${k}" style="--c:${c[0]};--c2:${c[1]}"><div class="ch"><div class="cn">${i+1}</div><div><b>${i+1}. ${t.toUpperCase()} ENVIRONMENT</b><small>${d}</small></div></div><div class="ca">${art(k,c[0])}<div class="cc"><h4>Environmental Conditions</h4>${rows.map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div></div><div class="cb"><div><h5>Mission path (top view)</h5><canvas data-p></canvas></div><div><h5>Altitude profile</h5><canvas data-a></canvas></div></div><button class="open">Open ${t} mission ▶</button></div>`).join('');
 document.querySelectorAll('#grid .cd').forEach(el=>{const k=el.dataset.k,c=CARDS.find(q=>q[0]===k)[3][0];drawCard(el,k,c);el.onclick=()=>{$('lsc').value=k;mark()};el.querySelector('.open').onclick=e=>{e.stopPropagation();enter(k)}});mark()}
const mark=()=>document.querySelectorAll('#grid .cd').forEach(el=>el.classList.toggle('sel',el.dataset.k===$('lsc').value));
function enter(k){$('ac').value=$('lac').value;$('ac').onchange();$('sc').value=k;$('sc').onchange();frozen=false;doReset();$('lobby').classList.remove('show');
 try{localStorage.setItem('skynexSel',JSON.stringify({k,ac:$('lac').value}))}catch(e){}}
const syncSp=()=>{$('lsp1').className=simSpeed===1?'on':'';$('lsp2').className=simSpeed===2?'on':''};
$('lStart').onclick=()=>enter($('lsc').value);$('lPause').onclick=()=>$('bPause').click();$('lReset').onclick=()=>doReset();$('lsc').onchange=mark;
$('lsp1').onclick=()=>{setSp(1);syncSp()};$('lsp2').onclick=()=>{setSp(2);syncSp()};$('bLobby').onclick=()=>$('lobby').classList.add('show');
// ---------- flight view size 50 / 75 / 100 % of the screen ----------
let VS=75;try{VS=parseInt(localStorage.getItem('skynexVS'))||75}catch(e){}
function setVS(v){if(![50,75,100].includes(v))v=75;VS=v;document.body.classList.remove('vs50','vs75','vs100');document.body.classList.add('vs'+v);document.querySelectorAll('[data-vs]').forEach(b=>b.classList.toggle('on',+b.dataset.vs===v));try{localStorage.setItem('skynexVS',v)}catch(e){}setTimeout(fit,50)}
document.querySelectorAll('[data-vs]').forEach(b=>b.onclick=()=>setVS(+b.dataset.vs));setVS(VS);
$('bFull').onclick=()=>{try{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}catch(e){}};
buildLobby();$('lobby').classList.add('show');
try{const p=JSON.parse(localStorage.getItem('skynexSel')||'null'); // remember the last UAV + scenario picked in the lobby
 if(p&&[...$('lac').options].some(o=>o.value===p.ac))$('lac').value=p.ac;
 if(p&&$('lsc').querySelector('option[value="'+p.k+'"]'))$('lsc').value=p.k;
 mark()}catch(e){}
