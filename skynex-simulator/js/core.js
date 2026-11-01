// Pure helpers (no DOM): shared by the app and tests.html
function sstep(a){a=Math.max(0,Math.min(1,a));return a*a*(3-2*a)}
const hash=(i,j)=>{const n=Math.sin(i*127.1+j*311.7)*43758.5453;return n-Math.floor(n)};
function vnoise(x,z){const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
 return hash(i,j)*(1-u)*(1-v)+hash(i+1,j)*u*(1-v)+hash(i,j+1)*(1-u)*v+hash(i+1,j+1)*u*v}
function fbm(x,z,o){let a=.5,f=1,s=0,n=0;for(let k=0;k<o;k++){s+=a*vnoise(x*f,z*f);n+=a;a*=.5;f*=2}return s/n}
const num=(v,lo,hi,d)=>typeof v==='number'&&Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):d;
const altAt=(t,ca)=>t<4?0:t<12?((t-4)/8<.5?0:((t-4)/8-.5)*60):t<26?30+(t-12)/14*(ca-30):t<80?ca:t<98?ca-(ca-20)*(t-80)/18:20*(1-(t-98)/12);
const toXZo=(o,la,lo)=>({x:(lo-o.lon)*111320*Math.cos(o.lat*Math.PI/180),z:-(la-o.lat)*110574});
const UNITS={imperial:false};
function convUnit(v,u){if(!UNITS.imperial)return[v,u];switch(u){case 'm':return[v*3.28084,'ft'];case 'm/s':return[v*1.943844,'kt'];case '°C':return[v*9/5+32,'°F'];case 'km':return[v*.621371,'mi'];case 'L/h':return[v*.264172,'gal/h'];default:return[v,u]}}
function uv(v,u,d){const r=convUnit(v,u);return r[0].toFixed(d)+' '+r[1]}
const alertSeverity=c=>['ENGINE_OVERHEAT','LOW_BATTERY','LINK_LOSS'].includes(c)?'CRITICAL':'WARNING';
const protocolOk=p=>typeof p!=='number'||p===1;
function routeLen(p){let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i].x-p[i-1].x,p[i].z-p[i-1].z);return L}
function routePos(p,f){const L=routeLen(p);if(p.length<2||L<=0)return{x:p[0]?p[0].x:0,z:p[0]?p[0].z:0,hdg:90};let s=Math.max(0,Math.min(1,f))*L;
 for(let i=1;i<p.length;i++){const dx=p[i].x-p[i-1].x,dz=p[i].z-p[i-1].z,l=Math.hypot(dx,dz);if(s<=l||i===p.length-1){const u=l?Math.min(1,s/l):0;return{x:p[i-1].x+dx*u,z:p[i-1].z+dz*u,hdg:((Math.atan2(dx,-dz)*180/Math.PI)+360)%360}}s-=l}}
