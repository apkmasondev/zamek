import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {Water} from 'three/addons/objects/Water.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {drawExperiment,explanation,formatPl} from './science.js';
import {initMusic} from './music.js';
import {createEntranceGates} from './gates.js';
import {createFlagWind} from './flags.js';
import {dressSurfaces,createAtmosphere,createInteriorEnvironment,loadTextureSets,SKY_MODES} from './look.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {createEveningLighting,createLanternHalo} from './evening.js';
import {tearSheet} from './paper.js';
import {createObservatory} from './observatory.js';
import {dressExhibits} from './exhibits.js';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
// Without the exhibit texts nothing can start: show the failure screen instead of an endless loader.
const stations=await fetch('stations.json').then(r=>{if(!r.ok)throw Error('Brak treści wystawy');return r.json();}).catch(e=>{$('loading').hidden=true;$('failure').hidden=false;$('accessible-open').hidden=true;$('failure-message').textContent='Nie udało się wczytać treści wystawy. Sprawdź połączenie i spróbuj ponownie.';throw e;});
const visited=new Set();
let current='gate',traveling=false,activeStation=null,castle,renderer,composer,aoPass,scene,camera,ready=false,accessible=false;
let lastTime=0,worldTime=0,frameTimes=[],lookYaw=0,lookPitch=0,lookBase=new THREE.Vector3(),move=null,lake,entranceGates;
let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,quality=true;
let evening=false,eveningLighting;
const videos=new Map(),screens=new Map(),hotspots=[],failedVideos=new Set();
const w=(x,y,z=2)=>new THREE.Vector3(x,z,-y);
const nodeDefs={
 gate:{p:w(79,-137,32),target:w(-8,-10,12),label:'Zamek nad jeziorem',next:'arrival'},
 arrival:{p:w(0,-120,2.1),target:w(0,-45,10.5),label:'Plac przedbramny',next:'hall',title:'Droga do<br>odkrywania.',copy:'Kamienny most prowadzi wprost do Wielkiej Sali. Wschodnia promenada zamyka spacer i wraca na ten sam plac.'},
 hall:{p:w(3,-43,2.3),target:w(0,-23,6.7),label:'Wielka Sala',next:1,title:'Przestrzeń dla<br>największych pytań.',copy:'Spójrz w górę. Potem podążaj za światłem do wschodniego skrzydła. Tu zaczyna się opowieść o rzeczywistości.'},
 court:{p:w(4,-10,2.1),target:w(0,4,2.4),label:'Dziedziniec Harmonii',next:5,title:'Oddech<br>między odkryciami.',copy:'Kamień, woda i światło. Zatrzymaj się na chwilę, zanim wejdziesz do kolejnych komnat.'},
 finale:{p:w(5.5,20,2.3),target:w(0,28,5.5),label:'Obserwatorium',next:'exit',title:'Wiedza<br>łączy światy.',copy:'Światło pozwala obserwować, z materii zbudowane jest wszystko, co żyje, a informacja pozwala to opisać. Dziesięć komnat to dziesięć sposobów zadawania pytań o ten sam świat.'},
 exit:{p:w(43,6,2.1),target:w(43,-38,2.5),label:'Taras nad jeziorem',next:'belvedere',title:'Spójrz szerzej<br>na krajobraz.',copy:'Za loggią szlak biegnie wzdłuż wschodniej skarpy do belwederu. Stamtąd kamienna promenada wraca do placu przedbramnego.'},
 belvedere:{p:w(43,-60,2.1),target:w(9,-121,1),label:'Belweder · Most ku Wiedzy',next:'arrival',title:'Pytania idą<br>z Tobą.',copy:'Dziesięć komnat masz już za sobą. Most prowadzi na ląd, do ogrodu i placu przed zamkiem. Możesz tam zakończyć spacer albo zacząć go od nowa.'}
};
stations.forEach(s=>{const[x,y]=s.position;nodeDefs[s.id]={p:w(x+5.6,y-6.8,2.4),target:w(x-1.7,y+.8,3.5),label:s.title,next:s.id===10?'finale':s.id+1};});
function viewTarget(key){if(innerWidth<600&&typeof key==='number'){const[x,y]=stations[key-1].position;return w(x+.3,y+1.3,3.6);}return nodeDefs[key].target;}
const sceneStatus={loaded:false,errors:[],metrics:{}};
// Every reading surface is a torn leaf of paper; the outline follows each sheet's size.
[['intro',10],['landmark',8],['exhibit',7],['film-caption',6]].forEach(([id,depth])=>tearSheet($(id),depth));document.querySelectorAll('.folio-dialog').forEach(d=>tearSheet(d,11));
// Read-only diagnostics exposed visibly through a query parameter, not used for navigation.
window.addEventListener('error',e=>sceneStatus.errors.push(e.message));
window.addEventListener('unhandledrejection',e=>sceneStatus.errors.push(String(e.reason)));
function setText(id,text){$(id).textContent=text;}
function dialogOpen(id){$(id).showModal();if(id==='map-dialog')renderMap();}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('map-open').onclick=()=>dialogOpen('map-dialog');$('about-open').onclick=()=>dialogOpen('about-dialog');
$('return-gate').onclick=()=>{ $('map-dialog').close();go('gate',true);};
$('reduced-motion').checked=reduced;document.body.classList.toggle('calm',reduced);$('reduced-motion').onchange=e=>{reduced=e.target.checked;document.body.classList.toggle('calm',reduced);};
$('start-journey').onclick=()=>go('arrival');
$('time-of-day').onclick=()=>{evening=!evening;$('time-of-day').setAttribute('aria-pressed',String(evening));$('time-of-day').setAttribute('aria-label',evening?'Pora dnia: wieczór. Włącz dzień':'Pora dnia: dzień. Włącz wieczór');$('time-label').textContent=evening?'Wieczór':'Dzień';document.body.classList.toggle('dusk',evening);updateLights();};
$('high-quality').onchange=e=>{quality=e.target.checked;if(renderer){renderer.setPixelRatio(quality?Math.min(devicePixelRatio,1.5):1);composer?.setPixelRatio(renderer.getPixelRatio());}};
$('reading-toggle').onclick=()=>{const collapsed=document.body.classList.toggle('reading-collapsed');$('reading-toggle').textContent=collapsed?'Rozwiń opis':'Zwiń opis';$('reading-toggle').setAttribute('aria-expanded',String(!collapsed));};
$('details-open').onclick=()=>{if(!activeStation)return;setText('detail-kicker',`Komnata ${String(activeStation.id).padStart(2,'0')} · za kulisami zjawiska`);setText('detail-title',activeStation.title);setText('detail-copy',activeStation.detail);$('source-list').replaceChildren(...activeStation.sources.map(([name,url])=>{const li=document.createElement('li'),a=document.createElement('a');a.textContent=name+' ↗';a.href=url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);return li;}));dialogOpen('detail-dialog');};
$('experiment-open').onclick=()=>{if(!activeStation)return;const s=activeStation;setText('experiment-kicker',`Komnata ${String(s.id).padStart(2,'0')} · ${s.title} · doświadczenie`);setText('experiment-title',s.interaction);setText('parameter-label',s.control);setText('experiment-limit',s.detail);const range=$('parameter');range.min=s.min;range.max=s.max;range.step=[8,9,10].includes(s.id)?1:s.id===4?.05:s.id===2?.1:1;range.value=s.value;updateExperiment();dialogOpen('experiment-dialog');};
$('parameter').oninput=updateExperiment;
function parameterText(s,v){if([8,9,10].includes(s.id))return s.control.split(': ')[1].split(' · ')[Math.round(v)];const n=Number.isInteger(v)?String(v):formatPl(v,s.id===4?2:1);return s.unit==='°'?n+'°':s.unit?n+' '+s.unit:n;}
function updateExperiment(){if(!activeStation)return;const v=Number($('parameter').value);setText('parameter-value',parameterText(activeStation,v));setText('experiment-result',explanation(activeStation.id,v));drawExperiment($('experiment-canvas'),activeStation.id,v,experimentTime());}
// With calm transitions the schematic stays still, frozen after the demonstrated event (e.g. after the collision in 04).
function experimentTime(){return reduced?3:worldTime;}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&film&&!document.querySelector('dialog[open]')){e.preventDefault();exitFilm();return;}if(e.key?.toLowerCase()==='m'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!document.querySelector('dialog[open]')){e.preventDefault();dialogOpen('map-dialog');}});
function renderMap(){const fp=$('floorplan');
 // SVG coordinates share the percentage layout of room buttons, at every aspect ratio.
 // Each separate arrow follows the actual tour: hall → 01 … 10 → observatory.
 const route=[
  ['arrival','hall','M250 562V496'],
  ['hall',1,'M250 488V450H322V369H338'],
  [1,2,'M407.5 408V418'],[2,3,'M407.5 498V508'],
  [3,4,'M340 546H325V570H175V483H162'],
  [4,5,'M92.5 444V422'],[5,6,'M92.5 342V314'],[6,7,'M92.5 234V200'],
  [7,8,'M92.5 120V45H180.5'],[8,9,'M317.5 45H407.5V118'],
  [9,10,'M407.5 198V232'],[10,'finale','M340 273H325V181H311']
 ];
 // The SVG stretches with the buttons, so round shapes get per-axis radii to stay circles on narrow phones.
 const sx=(fp.clientWidth||500)/500,sy=(fp.clientHeight||600)/600,k=Math.min(sx,sy),circle=(cx,cy,r,attrs)=>`<ellipse cx="${cx}" cy="${cy}" rx="${r*k/sx}" ry="${r*k/sy}" ${attrs}/>`;
 fp.innerHTML=`<svg viewBox="0 0 500 600" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="map-direction" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1L6.5 4L1 7" fill="none" stroke="#8b2f1d" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></marker><pattern id="map-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V7" stroke="#5e4c38" stroke-width="1" opacity=".35"/></pattern></defs><rect x="191" y="264" width="118" height="144" fill="url(#map-hatch)" stroke="#2b2016" stroke-opacity=".75" vector-effect="non-scaling-stroke"/>${circle(250,378,17,'fill="#e5d6b5" stroke="#2b2016" stroke-opacity=".7" vector-effect="non-scaling-stroke"')}${circle(250,181,59,'fill="#fbf3df55" stroke="#2b2016" stroke-width="1.5" vector-effect="non-scaling-stroke"')}${circle(250,181,51,'fill="none" stroke="#2b2016" stroke-opacity=".45" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"')}<path d="M250 ${181-52*k/sy}v${38*k/sy}M250 ${181+14*k/sy}v${38*k/sy}" stroke="#2b2016" stroke-opacity=".45" vector-effect="non-scaling-stroke"/><g stroke="#8b2f1d" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 5">${route.map(([from,to,d])=>`<path data-route-from="${from}" data-route-to="${to}" d="${d}" marker-end="url(#map-direction)" vector-effect="non-scaling-stroke"/>`).join('')}</g><circle cx="250" cy="488" r="3.5" fill="#8b2f1d"/><g transform="translate(${52} ${58}) scale(${k/sx} ${k/sy})" fill="none" stroke="#2b2016" stroke-width="1.2" vector-effect="non-scaling-stroke"><circle r="22" stroke-opacity=".55"/><path d="M0-30L5-5 0 0-5-5z" fill="#8b2f1d" stroke="#8b2f1d"/><path d="M0 30L5 5 0 0-5 5z" fill="#e5d6b5"/><path d="M-30 0H30" stroke-opacity=".55"/><text y="-35" text-anchor="middle" font-size="13" fill="#8b2f1d" stroke="none" font-family="Palatino Linotype, Palatino, Georgia, serif">N</text></g></svg>`;
 const pos={1:[68,55],2:[68,70],3:[68,85],4:[5,74],5:[5,57],6:[5,39],7:[5,20],8:[36.5,1],9:[68,20],10:[68,39]};
 stations.forEach(s=>{const b=document.createElement('button');b.className='map-room'+(visited.has(s.id)?' visited':'')+(current===s.id?' current':'');b.style.left=pos[s.id][0]+'%';b.style.top=pos[s.id][1]+'%';b.style.height=s.id===3?'12%':'13%';b.innerHTML=`<span>${String(s.id).padStart(2,'0')}</span><b>${s.title}</b>`;b.setAttribute('aria-label',`${s.id}. ${s.title}${visited.has(s.id)?', odkryta':''}`);b.onclick=()=>{$('map-dialog').close();go(s.id,true);};fp.append(b);});
 // Places outside the ten rooms are also stops on the plan: they can be chosen and show where the visitor is.
 const here=current==='belvedere'?'exit':current;
 [['court','DZIEDZINIEC<br><small>HARMONII</small>',37,53],['finale','OBSERWATORIUM',37,29],['hall','WIELKA SALA',37,83],['arrival','PLAC PRZEDBRAMNY',30,96,40],['exit','TARAS · BELWEDER',64,0,36]].forEach(([key,html,x,y,width])=>{const d=document.createElement('button');d.className='map-label'+(here===key?' current':'');d.innerHTML=html;d.style.left=x+'%';d.style.top=y+'%';if(width)d.style.width=width+'%';d.setAttribute('aria-label',nodeDefs[key].label+(here===key?', tu jesteś':''));d.onclick=()=>{$('map-dialog').close();go(key,true);};fp.append(d);});
 setText('map-where',`Tu jesteś: ${typeof current==='number'?`${String(current).padStart(2,'0')} · ${stations[current-1].title}`:nodeDefs[current].label}`);
 setText('map-count',`Odkryto ${visited.size} z 10 komnat`);
}
function updateUI(){
 activeStation=typeof current==='number'?stations[current-1]:null;
 $('intro').hidden=current!=='gate';$('exhibit').hidden=!activeStation;$('landmark').hidden=!!activeStation||current==='gate';
 document.body.classList.toggle('interior',!['gate','arrival','exit','belvedere'].includes(current));document.body.classList.toggle('station',!!activeStation);document.body.classList.toggle('at-gate',current==='gate');
 if(activeStation){const s=activeStation;visited.add(s.id);$('reading').scrollTop=0;$('exhibit').querySelector('.sheet').scrollTop=0;setText('station-number',String(s.id).padStart(2,'0'));setText('room-name',s.room);setText('station-title',s.title);setText('station-idea',s.idea);setText('station-explanation',s.explanation);setText('station-fact',s.fact);setText('video-note',failedVideos.has(s.id)?'Nie udało się wczytać filmu tej komnaty.':s.videoStatus==='replace'?'Film tej komnaty oczekuje na poprawioną wersję.':s.videoNote);$('video-note').classList.toggle('pending',s.videoStatus==='replace');setText('experiment-name',s.interaction);}
 else if(current!=='gate'){const def=nodeDefs[current];setText('place-kicker',{finale:'Obserwatorium · finał wystawy',exit:'Loggia i taras',belvedere:'Belweder · ostatni przystanek'}[current]||def.label);$('place-title').innerHTML=def.title;setText('place-copy',def.copy+(current==='finale'?` ${medallionLine()}`:''));}
 setText('location-label',nodeDefs[current].label);$('route-progress').replaceChildren(...stations.map(s=>{const el=document.createElement('span');el.className=(visited.has(s.id)?'visited ':'')+(current===s.id?'current':'');return el;}));
 setText('sr-announcement',activeStation?`Komnata ${activeStation.id}: ${activeStation.title}. ${activeStation.idea}`:nodeDefs[current].label);
 for(const [id,v]of videos){if(id===current&&ready&&!document.hidden)playVideo(id,v,v.paused);else v.pause();}
 observatory?.setVisited(visited,current==='finale'&&!accessible);
 rebuildHotspots();
}
// A rejected play() (e.g. the decoder is briefly busy) is retried while the visitor is still in that room.
function playVideo(id,v,restart=false){if(restart)v.currentTime=0;v.play().catch(()=>{const retry=()=>{if(current===id&&ready&&!traveling&&!document.hidden&&v.paused)v.play().catch(()=>{});};v.addEventListener('canplay',retry,{once:true});setTimeout(retry,800);});}
// The armillary in the observatory shows the journey: one lit medallion per room visited.
function medallionLine(){const n=visited.size;return n===10?'Na równiku sfery świecą wszystkie medaliony: dziesięć komnat masz już za sobą.':n===0?'Medaliony na równiku sfery zapalą się, gdy odwiedzisz komnaty.':`Na równiku sfery świeci ${n} z 10 medalionów — tyle komnat masz już za sobą.`;}
function textBox(){const root=activeStation?$('exhibit'):current==='gate'?$('intro'):$('landmark');if(!root||root.hidden)return null;const r=root.getBoundingClientRect();return r.width?{l:r.left,t:r.top,r:r.right,b:r.bottom}:null;}
function hotspot(label,target,p,small=false){const b=document.createElement('button');b.className='hotspot'+(small?' small':'');b.innerHTML='<span class="orb" aria-hidden="true"></span><span></span>';b.lastChild.textContent=label;b.setAttribute('aria-label',`Przejdź: ${label}`);b.onclick=()=>go(target);$('hotspots').append(b);hotspots.push({el:b,p});}
function rebuildHotspots(){hotspots.length=0;$('hotspots').replaceChildren();
 if(current==='gate'){hotspot('Plac przedbramny','arrival',w(0,-120,2.1));return;}
 if(current==='arrival'){hotspot('Wielka Sala','hall',w(0,-110,2.6));hotspot('Widok zamku','gate',w(14,-125,2),true);return;}
 if(current==='hall'){hotspot('01 · Światło',1,w(9,-23,2.4));hotspot('Dziedziniec Harmonii','court',w(0,-18,2.4),true);return;}
 if(current==='court'){hotspot('05 · Energia',5,w(-13,-4,2));hotspot('Wielka Sala','hall',w(0,-18,2),true);return;}
 if(current==='finale'){hotspot('Taras nad jeziorem','exit',w(10,23,2));hotspot('Dziedziniec Harmonii','court',w(0,18,2),true);return;}
 if(current==='exit'){hotspot('Belweder','belvedere',w(43,-12,2));return;}
 if(current==='belvedere'){hotspot('Powrót na plac','arrival',w(39,-69,2));return;}
 const s=activeStation;const[x,y]=s.position;const dest=nodeDefs[current].next;const label=typeof dest==='number'?`${String(dest).padStart(2,'0')} · ${stations[dest-1].title}`:'Obserwatorium';
 // Markers sit in actual portals. A plan is available for arbitrary revisits.
 hotspot(label,dest,s.id===8?w(0,40,2):w(x+(x>0?-9.5:9.5),y,2.2));
}
function roomDoor(id){const[x,y]=stations[id-1].position;return id===8?w(0,39,2.1):w(x>0?13:-13,y,2.1);}
function exitRoom(id){const[x,y]=stations[id-1].position;return id===8?[w(5.6,43,2.4),w(0,43,2.1),w(0,39,2.1)]:[w(x+5.6,y-4.6,2.3),w(x+(x>0?-5.8:5.8),y-4.6,2.1),w(x+(x>0?-5.8:5.8),y,2.1),roomDoor(id)];}
function enterRoom(id){return [...exitRoom(id)].reverse().concat([nodeDefs[id].p]);}
function route(from,to){
 if(from==='arrival'&&to==='hall')return [w(0,-110,2.1),w(0,-98,2.1),w(0,-86,2.1),w(0,-74,2.1),w(0,-62,2.1),w(0,-50,2.1),nodeDefs.hall.p];
 if(from==='exit'&&to==='belvedere')return [w(43,-12,2.1),w(43,-28,2.1),w(43,-44,2.1),nodeDefs.belvedere.p];
 if(from==='belvedere'&&to==='arrival')return [w(35,-80,2.1),w(19,-101,2.1),w(10,-115,2.1),w(0,-122,2.1),nodeDefs.arrival.p];
 if(from==='court'&&to==='hall')return [w(4,-13,2.1),w(13,-13,2.1),w(13,-24,2.1),w(0,-24,2.3),nodeDefs.hall.p];
 let a=[];
 if(typeof from==='number')a.push(...exitRoom(from));
 else if(from==='hall')a.push(w(0,-24,2.3),w(13,-24,2.1));
 else if(from==='court')a.push(w(4,-14,2.1),w(-10,-14,2.1),w(-13,-14,2.1));
 else if(from==='finale')a.push(w(8,23,2.1),w(13,23,2.1));
 if(typeof to==='number'){
  const d=roomDoor(to);const last=a.at(-1)||camera.position;
  if(typeof from==='number'&&from===3&&to===4)a.push(w(13,-24,2.1),w(7,-24,2.1),w(0,-24,2.1),w(-7,-24,2.1),w(-13,-24,2.1));
  else if(to===8)a.push(w(-13,39,2.1),w(0,39,2.1));
  else if(from===8)a.push(w(13,39,2.1));
  else if(Math.sign(last.x)!==Math.sign(d.x)&&Math.abs(last.x)>5)a.push(w(last.x,-24,2.1),w(d.x,-24,2.1));
  a.push(...enterRoom(to));
 }else if(to==='finale')a.push(w(13,22,2.1),w(8,22,2.1),w(5,23,2.1),nodeDefs.finale.p);
 else if(to==='exit')a.push(w(13,6,2.1),w(36,6,2.1),w(43,6,2.1),nodeDefs.exit.p);
 else if(to==='court')a.push(w(13,-13,2.1),w(4,-13,2.1),nodeDefs.court.p);
 else a.push(nodeDefs[to].p);
 return a;
}
async function go(to,fromMap=false){
 if(traveling||(!ready&&!accessible)||!nodeDefs[to])return;
 if(film)exitFilm(true);
 // A walk supersedes a camera tween still running (e.g. the return from film mode) and restores the normal lens.
 if(camTween&&camera){camTween=null;camera.fov=baseFov();camera.updateProjectionMatrix();}
 if(to==='gate'||current==='gate')fromMap=true;
 if(accessible){current=to;updateUI();return;}
 // The ceremony starts with the walk from the forecourt. Map jumps into the
 // interior open immediately; reduced-motion visits use the existing fade.
 if(!isOutside(to))entranceGates?.open(performance.now(),reduced||fromMap||current!=='arrival'||to!=='hall');
 traveling=true;document.body.classList.add('cinematic');$('travel').hidden=false;
 // Title card of the destination: rooms announce their number and hall, other places where the path leads.
 {const st=typeof to==='number'?stations[to-1]:null;setText('travel-kicker',st?`Komnata ${String(st.id).padStart(2,'0')}`:to==='gate'?'Powrót':'W drodze');setText('travel-label',st?st.title:nodeDefs[to].label);setText('travel-sub',st?st.room:'');$('travel').classList.toggle('room',!!st);$('travel').classList.toggle('quick',fromMap||reduced);$('travel').style.animation='none';void $('travel').offsetWidth;$('travel').style.animation='';}
 for(const v of videos.values())v.pause();lookYaw=lookPitch=0;
 const points=[camera.position.clone(),...(fromMap||reduced?[nodeDefs[to].p]:route(current,to))];
 const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances.at(-1)+points[i].distanceTo(points[i-1]));
 move={points,distances,total:distances.at(-1),start:performance.now(),duration:fromMap||reduced?450:Math.min(16000,Math.max(4000,distances.at(-1)*145)),target:to,initialLook:lookBase.clone(),teleport:fromMap||reduced};
}
function updateMove(now){if(!move)return;const t=Math.min(1,(now-move.start)/move.duration);
 // Reset only behind the black midpoint of the return-to-intro fade.
 if(move.teleport&&move.target==='gate'&&t>=.5&&!move.gatesReset){entranceGates?.reset();move.gatesReset=true;}
 // Light the destination as the camera reaches it (at black for fades), not only after stopping. Indoor-outdoor walks keep switching on arrival.
 if(!move.lit&&(move.teleport?t>=.5:t>.72&&!isOutside(current)&&!isOutside(move.target))){move.lit=true;updateLights(move.target);}
 if(move.teleport){$('scene').style.opacity=String(Math.abs(t*2-1));if(t>=.5){camera.position.copy(nodeDefs[move.target].p);lookBase.copy(viewTarget(move.target));camera.lookAt(lookBase);}if(t===1)finishTravel();return;}const ease=t*t*(3-2*t),dist=ease*move.total;camera.position.copy(pathPoint(move,dist));
 // Gaze follows the walkway up to 6 m ahead, but never more than 1.5 m past the next bend: the view turns with the corridor
 // instead of facing walls, and short zigzags (e.g. leaving the observatory) do not pull it through a corner.
 let bend=1;while(bend<move.distances.length-1&&move.distances[bend]<=dist)bend++;
 let target=pathPoint(move,Math.min(dist+6,move.distances[bend]+1.5));target.y=Math.max(target.y,2.1);
 // Stepping over a room's threshold lights it and turns the gaze to its artefact while the walk rounds the plinth.
 if(typeof move.target==='number'){const[sx,sy]=stations[move.target-1].position,cp=camera.position;if(Math.abs(cp.x-sx)<10.3&&Math.abs(-cp.z-sy)<9.3){if(!move.lit){move.lit=true;updateLights(move.target);}if(!move.film){move.film=true;const v=videos.get(move.target);if(v&&v.paused&&!document.hidden)v.currentTime=0,v.play().catch(()=>{});}target=w(sx,sy,2.8);}}
 if(t>.72)target=target.lerp(viewTarget(move.target),(t-.72)/.28);if(t<.15)target=move.initialLook.clone().lerp(target,t/.15);
 // Time-based smoothing keeps the same turning speed at 60 Hz and 120 Hz.
 const dt=Math.min(.1,(now-(move.last??now))/1000);move.last=now;lookBase.lerp(target,1-Math.exp(-dt*5));camera.lookAt(lookBase);
 if(t===1)finishTravel();
}
// Point at distance d along the walk; beyond the end it continues in the direction of the last segment.
function pathPoint(m,d){const n=m.points.length;if(d>=m.total){const a=m.points[Math.max(0,n-2)],b=m.points[n-1],dir=b.clone().sub(a),len=dir.length();return len>1e-4?b.clone().addScaledVector(dir,(d-m.total)/len):b.clone();}let i=1;while(i<n-1&&m.distances[i]<d)i++;const f=(d-m.distances[i-1])/Math.max(.0001,m.distances[i]-m.distances[i-1]);return m.points[i-1].clone().lerp(m.points[i],f);}
function finishTravel(){current=move.target;camera.position.copy(nodeDefs[current].p);lookBase.copy(viewTarget(current));camera.lookAt(lookBase);move=null;traveling=false;$('scene').style.opacity='1';document.body.classList.remove('cinematic');$('travel').hidden=true;updateUI();updateLights();}
let observatory,sun,hemisphere,localLights=[],flagWind,keySpot,screenLight,atmosphere,surfaces,interiorEnv,skyMode=null;
const SUN_DAY=SKY_MODES.day.sun;
const isOutside=key=>['gate','arrival','exit','belvedere'].includes(key);
function updateLights(key=current){if(!renderer)return;const outside=isOutside(key),station=typeof key==='number'?stations[key-1]:null;
 // Outside: sky light and a warm low sun. Inside: dim stone halls where the exhibits and films carry the light.
 const modeName=evening?'dusk':'day',mode=SKY_MODES[modeName];
 if(skyMode!==modeName){skyMode=modeName;atmosphere.setMode(modeName);sun.position.copy(mode.sun).multiplyScalar(220);sun.color.set(mode.sunColor);hemisphere.color.set(mode.hemiSky);hemisphere.groundColor.set(mode.hemiGround);scene.fog.color.set(mode.fog);scene.background.set(mode.fog);
  const u=lake.material.uniforms;u.sunDirection.value.copy(mode.sun);u.sunColor.value.set(mode.waterSun);u.waterColor.value.set(mode.water);}
 hemisphere.intensity=outside?mode.hemi:.05;sun.intensity=outside?mode.sunIntensity:.12;scene.environment=outside?atmosphere.environment:interiorEnv;scene.environmentIntensity=outside?mode.env:1;scene.fog.density=outside?mode.fogDensity:.0006;renderer.toneMappingExposure=outside?mode.exposure:1.25;if(lake)lake.visible=outside;atmosphere.group.visible=outside||key==='finale'||key==='court'||key==='hall';
 surfaces.set({interior:!outside,starGlow:outside?.1:.32});
 const p=station?station.position:key==='hall'?[0,-34]:key==='finale'?[0,28]:key==='court'?[0,4]:[0,0];
 // Room rig: warm wall wash from the entrance side, a cool counter-light and a halo in the room colour.
 const placements=station?[[p[0]+(p[0]>0?-7:7),p[1]-6,7.5],[p[0]+(p[0]>0?7:-7),p[1]+4,6],[p[0],p[1]+5.5,3.5]]:[[p[0]-4,p[1]-3,7],[p[0]+5,p[1]+3,6],[p[0],p[1]+6,4]];
 const palettes={1:['#ffe6c4','#a9c8ec',260,120],2:['#ffd3a4','#9db8d6',240,90],3:['#d7e5ff','#86aee0',200,130],4:['#ffe0b8','#c2d2de',250,100],5:['#ffc98c','#a2a7c0',260,80],6:['#dbeaf6','#9ad4e0',230,120],7:['#ddd6ff','#93c3cf',200,120],8:['#eef3ea','#b8dcdb',260,140],9:['#e3efc4','#9ccdbb',240,120],10:['#ead9b8','#94b3d6',210,110]};
 const palette=palettes[key]||(key==='hall'?['#ffd9a8','#9fbfe4',520,220]:['#ffd49c','#b8dafa',420,200]);
 localLights.forEach((l,i)=>{l.position.copy(w(...placements[i]));l.color.set(i<2?palette[i]:station?.color||'#ffd49c');l.distance=station?26:35;l.intensity=outside?0:i===0?palette[2]:i===1?palette[3]:station?60:110;});
 if(station){const [x,y]=station.position;keySpot.position.copy(w(x+(x>0?-3:3),y-4.5,9.4));keySpot.target.position.copy(w(x,y,1.4));keySpot.color.set(palette[0]);keySpot.intensity=1500;
  const screen=screens.get(station.id);if(screen){screenLight.position.copy(screen.position).add(new THREE.Vector3(0,0,.12));screenLight.lookAt(screen.position.clone().add(new THREE.Vector3(0,0,1)));screenLight.width=screen.geometry.parameters.width;screenLight.height=screen.geometry.parameters.height;screenLight.intensity=5;}}
 else{keySpot.intensity=0;screenLight.intensity=0;}
 keySpot.target.updateMatrixWorld();renderer.shadowMap.needsUpdate=true;
 eveningLighting?.apply(evening,outside);
 filmDim();
}
function canvasPoster(s){const cv=document.createElement('canvas');cv.width=1280;cv.height=720;const ctx=cv.getContext('2d');ctx.fillStyle='#0b1820';ctx.fillRect(0,0,1280,720);ctx.strokeStyle='#b99d6655';ctx.strokeRect(36,36,1208,648);ctx.textAlign='center';ctx.fillStyle='#d9be8a';ctx.font='22px Georgia';ctx.fillText(`KOMNATA ${String(s.id).padStart(2,'0')}`,640,145);ctx.font='65px Georgia';ctx.fillText(s.title,640,265);ctx.fillStyle='#c4cbc7';ctx.font='26px Georgia';ctx.fillText('Ta opowieść zasługuje na precyzyjny obraz.',640,390);ctx.font='20px Arial';ctx.fillStyle='#91a4aa';ctx.fillText('Film oczekuje na poprawioną wersję.',640,457);ctx.font='19px Arial';ctx.fillText('W tym czasie odkryj przestrzenny artefakt i interakcję.',640,503);const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;return tx;}
function addProjection(mesh,id){const s=stations[id-1],box=new THREE.Box3().setFromObject(mesh),size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);let texture;
 if(s.videoStatus!=='replace'){const video=document.createElement('video');video.src=`media/${s.video}.mp4`;video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='metadata';video.addEventListener('error',()=>{sceneStatus.errors.push('Video failed: '+s.video);failedVideos.add(id);if(current===id)setText('video-note','Nie udało się wczytać filmu tej komnaty.');});videos.set(id,video);texture=new THREE.VideoTexture(video);texture.colorSpace=THREE.SRGBColorSpace;}
 else texture=canvasPoster(s);
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(size.x,size.y),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));plane.position.set(center.x,center.y,box.max.z+.015);scene.add(plane);screens.set(id,plane);
}
async function init(){try{
 renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=params.get('tm')==='agx'?THREE.AgXToneMapping:THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.info.autoReset=false;
 scene=new THREE.Scene();scene.background=new THREE.Color('#9fb9cc');scene.fog=new THREE.FogExp2('#aabfcc',.0008);RectAreaLightUniformsLib.init();
 camera=new THREE.PerspectiveCamera(innerWidth<600?88:48,innerWidth/innerHeight,.08,1600);camera.position.copy(nodeDefs.gate.p);lookBase.copy(nodeDefs.gate.target);camera.lookAt(lookBase);
 interiorEnv=createInteriorEnvironment(renderer);
 atmosphere=createAtmosphere({scene,renderer});
 hemisphere=new THREE.HemisphereLight('#a9c6e2','#4a4536',1.5);scene.add(hemisphere);
 sun=new THREE.DirectionalLight('#ffe0b5',2.4);sun.position.copy(SUN_DAY).multiplyScalar(200);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-170,right:170,top:170,bottom:-170,near:1,far:450});sun.shadow.normalBias=.14;sun.shadow.bias=-.00035;scene.add(sun);
 for(let i=0;i<3;i++){const l=new THREE.PointLight(i===1?'#b8dafa':'#ffd49c',0,35,2);scene.add(l);localLights.push(l);}
 // Exhibit rig: a shadowed spot on the artefact and the film itself lighting the room through a rectangular area light.
 keySpot=new THREE.SpotLight('#fff2dc',0,34,.52,.8,2);keySpot.castShadow=true;keySpot.shadow.mapSize.set(1024,1024);keySpot.shadow.bias=-.0002;keySpot.shadow.normalBias=.03;keySpot.shadow.camera.near=1;scene.add(keySpot,keySpot.target);
 screenLight=new THREE.RectAreaLight('#9fb6d0',0,6.4,3.6);scene.add(screenLight);
 // The model geometry is Draco-compressed at export; the decoder (WebAssembly) ships locally in vendor/libs/draco.
 // Pages/Cloudflare send the model gzip-compressed: Content-Length is then the compressed size while progress counts
 // unpacked bytes (it reached 109%). The published page carries the real size; locally the header is exact (content 0).
 const modelBytes=Number(document.querySelector('meta[name="model-bytes"]')?.content)||0;
 const draco=new DRACOLoader().setDecoderPath('vendor/libs/draco/');
 // Photographic stone, slate, rock and grass load alongside the model; the tour still works with flat colours if they fail.
 const textureSets=loadTextureSets(renderer).catch(e=>{sceneStatus.errors.push('Textures: '+e);return null;});
 const gltf=await new GLTFLoader().setDRACOLoader(draco).loadAsync('models/castle.glb',e=>{const total=modelBytes||e.total;if(total){const v=Math.min(100,Math.round(e.loaded/total*100));$('load-bar').style.width=v+'%';setText('load-text',`Otwieranie zamku · ${v}%`);}});
 draco.dispose();castle=gltf.scene;scene.add(castle);castle.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.name.includes('00_ENVIRONMENT')&&o.name.includes('Water'))o.visible=false;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(m.map)m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(m.name.includes('Slate')||m.name.includes('leaf')||m.name.includes('meadow'))m.side=THREE.DoubleSide;if(m.name.includes('Glass')){m.transmission=0;m.transparent=true;m.opacity=.25;m.depthWrite=false;m.side=THREE.DoubleSide;}}if(o.name.startsWith('Projection_')){const id=Number(o.name.split('_')[1]);addProjection(o,id);}}});
 const photos=await textureSets;surfaces=dressSurfaces(castle,renderer,photos);atmosphere.setTextures(photos);
 let brass=null;castle.traverse(o=>{if(o.isMesh&&!brass){const m=[o.material].flat().find(m=>m.name==='Brass · polished inlay');if(m)brass=m;}});
 observatory=createObservatory(scene,stations,brass);dressExhibits(scene,brass);
 entranceGates=createEntranceGates(castle,scene,()=>{renderer.shadowMap.needsUpdate=true;});
 flagWind=createFlagWind(castle);
 const waterNormal=await new THREE.TextureLoader().loadAsync('models/pass2-water-normal.png');waterNormal.wrapS=waterNormal.wrapT=THREE.RepeatWrapping;
 lake=new Water(new THREE.PlaneGeometry(2400,2400),{textureWidth:768,textureHeight:768,waterNormals:waterNormal,sunDirection:SUN_DAY.clone(),sunColor:0xffe0b5,waterColor:0x16323d,distortionScale:2.2,fog:true});lake.name='Reflective alpine lake';lake.rotation.x=-Math.PI/2;lake.position.y=-18.82;scene.add(lake);
 composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));aoPass=new SSAOPass(scene,camera,innerWidth,innerHeight,16);aoPass.kernelRadius=1.1;aoPass.minDistance=.0001;aoPass.maxDistance=.025;composer.addPass(aoPass);composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.16,.35,.9));composer.addPass(new OutputPass());
 eveningLighting=createEveningLighting({scene,renderer,localLights,castle,haloMap:createLanternHalo(),surfaces});
 updateLights();
 // Compile every shader and upload the photo textures behind the loading screen, so the first views do not stutter.
 setText('load-text','Otwieranie zamku · przygotowanie światła');try{await renderer.compileAsync(scene,camera);}catch(e){}
 ready=true;sceneStatus.loaded=true;updateLights();updateUI();renderer.render(scene,camera);$('loading').style.opacity=0;setTimeout(()=>{$('loading').hidden=true;},900);
 renderer.setAnimationLoop(animate);
 // Development hook for audit screenshots from arbitrary viewpoints (only with ?dev).
 if(new URLSearchParams(location.search).has('dev'))window.__zamek={THREE,scene,camera,renderer,castle,go,stations,nodeDefs,updateLights,w,get current(){return current;},setView(p,t){camera.position.copy(p);lookBase.copy(t);lookYaw=lookPitch=0;camera.lookAt(lookBase);},
  pick(x,y){const r=new THREE.Raycaster();r.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-y/innerHeight*2+1),camera);const h=r.intersectObject(castle,true)[0];if(!h)return null;const m=Array.isArray(h.object.material)?h.object.material[h.face.materialIndex]:h.object.material;const p=h.point;return {mesh:h.object.name,material:m.name,point:[+p.x.toFixed(2),+(-p.z).toFixed(2),+p.y.toFixed(2)]};}};
 if(new URLSearchParams(location.search).has('diagnostics')){const d=document.createElement('output');d.id='diagnostics';d.style.cssText='position:absolute;right:15px;top:100px;background:#07121dcc;color:#ddd;padding:10px;font:11px monospace;z-index:15;white-space:pre';document.body.append(d);}
 }catch(e){sceneStatus.errors.push(String(e));console.error(e);$('loading').hidden=true;$('failure').hidden=false;
 // Visitors get a plain Polish reason; the technical error stays in the console and ?diagnostics.
 setText('failure-message',renderer?'Model zamku nie został wczytany. Sprawdź połączenie i spróbuj ponownie. Treść wystawy możesz przeczytać bez 3D.':'Ta przeglądarka lub karta graficzna nie udostępnia WebGL 2, potrzebnego do spaceru 3D. Treść wystawy możesz przeczytać bez 3D.');}}
// ---- Film mode: the camera leans in to the room's screen, the room dims like a cinema and a caption replaces the card.
let film=null,camTween=null;
function baseFov(){return innerWidth<600?88:48;}
function filmView(id){const sc=screens.get(id),c=sc.position.clone(),d=3.8,fovH=2*Math.atan(sc.geometry.parameters.width/2/.9/d);
 return {p:c.clone().add(new THREE.Vector3(0,-.25,d)),t:c,fov:THREE.MathUtils.clamp(2*Math.atan(Math.tan(fovH/2)/camera.aspect)*180/Math.PI,30,72)};}
function lookTarget(){const d=camera.getWorldDirection(new THREE.Vector3());return camera.position.clone().addScaledVector(d,Math.max(2,lookBase.distanceTo(camera.position)));}
function tweenCamera(to,dur,done,lift=0){const from=camera.position.clone();camTween={from:{p:from,t:lookTarget(),fov:camera.fov},to,ctrl:from.clone().lerp(to.p,.5).add(new THREE.Vector3(0,lift,0)),start:performance.now(),dur:reduced?1:dur,done};}
function updateCamTween(now){const m=camTween,t=Math.min(1,(now-m.start)/m.dur),e=t*t*t*(t*(t*6-15)+10);
 const q=1-e;camera.position.copy(m.from.p).multiplyScalar(q*q).addScaledVector(m.ctrl,2*q*e).addScaledVector(m.to.p,e*e);lookBase.lerpVectors(m.from.t,m.to.t,e);camera.fov=m.from.fov+(m.to.fov-m.from.fov)*e;camera.updateProjectionMatrix();camera.lookAt(lookBase);
 if(t===1){camTween=null;lookYaw=lookPitch=0;m.done?.();}}
function filmDim(){if(!film||film.dom)return;localLights.forEach(l=>l.intensity*=.3);keySpot.intensity*=.25;screenLight.intensity*=1.5;}
function enterFilm(){if(!activeStation||traveling||film||(!screens.has(activeStation.id)&&!accessible))return;const s=activeStation;let v=videos.get(s.id);
 // Reading mode without 3D has no screens: the film is created on demand and shown in the frame.
 if(!v&&accessible&&s.video){v=document.createElement('video');v.src=`media/${s.video}.mp4`;v.muted=true;v.loop=true;v.playsInline=true;v.addEventListener('error',()=>setText('film-text','Nie udało się wczytać filmu tej komnaty.'));videos.set(s.id,v);}
 // Portrait phones cannot frame a wide screen without extreme perspective: the same film opens in a frame above the scene.
 const dom=accessible||innerWidth<innerHeight;film={id:s.id,dom};document.body.classList.add('film-mode');
 setText('film-kicker',`Komnata ${String(s.id).padStart(2,'0')} · ${s.title} · film`);setText('film-text',failedVideos.has(s.id)?'Nie udało się wczytać filmu tej komnaty.':s.videoNote);$('film-caption').hidden=false;
 if(v){v.currentTime=0;if(dom){v.className='film-video';$('film-frame').replaceChildren(v);$('film-frame').hidden=false;}if(ready)playVideo(s.id,v);else v.play().catch(()=>{});}
 lookYaw=lookPitch=0;if(!dom){tweenCamera(filmView(s.id),1900,null,5.5);filmDim();}
 setText('sr-announcement',`Film komnaty ${s.id}. ${s.videoNote}`);$('film-close').focus({preventScroll:true});}
function exitFilm(instant=false){if(!film)return;const {id,dom}=film;film=null;document.body.classList.remove('film-mode');$('film-caption').hidden=true;
 if(dom){const v=videos.get(id);$('film-frame').hidden=true;$('film-frame').replaceChildren();// Detaching the video queues a pause in the browser; resume after it, on the room's 3D screen.
  if(v&&!instant&&ready)setTimeout(()=>{if(current===id&&!film&&!traveling)playVideo(id,v);},120);}
 if(ready)updateLights();if(!dom){if(instant){camTween=null;camera.fov=baseFov();camera.updateProjectionMatrix();}else tweenCamera({p:nodeDefs[current].p.clone(),t:viewTarget(current).clone(),fov:baseFov()},1600,null,5.5);}
 if(!instant)$('film-open').focus({preventScroll:true});}
$('film-open').onclick=enterFilm;$('film-close').onclick=()=>exitFilm();$('film-frame').onclick=e=>{if(e.target===$('film-frame'))exitFilm();};
let lastMetrics=0,lastSample=0;const screenTint=new THREE.Color('#9fb6d0');
// The film lights its room: a tiny sample of the current frame steers the colour of the area light in front of the screen.
const sampleCanvas=document.createElement('canvas');sampleCanvas.width=sampleCanvas.height=4;const sampleCtx=sampleCanvas.getContext('2d',{willReadFrequently:true});
function updateScreenLight(now,dt){if(!screenLight||!screenLight.intensity)return;const v=videos.get(current);
 if(v&&v.readyState>=2&&now-lastSample>180){lastSample=now;try{sampleCtx.drawImage(v,0,0,4,4);const d=sampleCtx.getImageData(0,0,4,4).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}const n=d.length/4*255;screenTint.setRGB(r/n,g/n,b/n,THREE.SRGBColorSpace);const l=Math.max(.08,screenTint.r*.3+screenTint.g*.55+screenTint.b*.15);screenTint.multiplyScalar(Math.min(2.2,.42/l));}catch{}}
 screenLight.color.lerp(screenTint,1-Math.exp(-dt*4));}
function animate(now){if(document.hidden){lastTime=now;return;}const dt=Math.min(.1,(now-(lastTime||now))/1000);lastTime=now;worldTime+=dt;frameTimes.push(dt);if(frameTimes.length>120)frameTimes.shift();
 if(lake&&!reduced)lake.material.uniforms.time.value+=dt*.3;
 entranceGates?.update(now,reduced);
 flagWind?.update(worldTime,reduced);
 if(move)updateMove(now);else if(camTween)updateCamTween(now);else{
  // On the title view the camera circles the castle by a few degrees, slowly enough to read as a breath of wind.
  if(current==='gate'&&!reduced){const o=nodeDefs.gate.p.clone().sub(nodeDefs.gate.target).applyAxisAngle(new THREE.Vector3(0,1,0),Math.sin(worldTime*.04)*.075);camera.position.copy(nodeDefs.gate.target).add(o);camera.position.y+=Math.sin(worldTime*.06)*.8;}
  const dir=lookBase.clone().sub(camera.position);const r=dir.length();const yaw=Math.atan2(dir.x,dir.z)+lookYaw,pitch=Math.asin(dir.y/r)+lookPitch;camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*r,Math.sin(pitch)*r,Math.cos(yaw)*Math.cos(pitch)*r)));
 }
 eveningLighting?.update(worldTime,camera);
 atmosphere?.update(dt,camera,reduced);observatory?.update(dt,reduced,camera.position.distanceToSquared(observatory.root.position)<55*55);if(!reduced)surfaces?.tick(worldTime);updateScreenLight(now,dt);
 const box=hotspots.length?textBox():null,placed=[];
 for(const h of hotspots){const p=h.p.clone().project(camera),behind=h.p.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()))<0;const offView=behind||Math.abs(p.x)>1;
 // A point behind the camera projects mirrored; pin it to the edge on its real side instead.
 if(behind){p.x=p.x<0?2:-2;p.y=-p.y;}
 const rawx=(p.x*.5+.5)*innerWidth,rawy=(-p.y*.5+.5)*innerHeight;const overText=activeStation&&innerWidth>=600&&rawx<430;let x=overText?innerWidth-95:Math.max(innerWidth<600?70:110,Math.min(innerWidth-95,rawx)),y=Math.max(140,Math.min(innerHeight-(innerWidth<600&&activeStation?innerHeight*.45:125),rawy));
 // Keep markers off the visible text: beside it on wide screens, above it on phones.
 if(box&&activeStation&&innerWidth<600)y=Math.max(140,Math.min(y,box.t-55));
 else if(box&&!activeStation&&x>box.l-80&&x<box.r+80&&y>box.t-55&&y<box.b+55){if(innerWidth>=600)x=Math.min(innerWidth-95,box.r+95);else y=Math.max(140,box.t-60);}
 // Two markers pinned to the same edge must not cover each other: lift the later (secondary) one.
 for(const q of placed)if(Math.abs(q.x-x)<150&&Math.abs(q.y-y)<70)y=q.y-75>=140?q.y-75:q.y+75;
 placed.push({x,y});
 h.el.style.left=x+'px';h.el.style.top=y+'px';h.el.style.opacity=traveling?'0':'1';h.el.classList.toggle('directional',overText);// edge-clamped physical portal markers remain discoverable while looking away
 h.el.classList.toggle('off-view',offView);}
 for(const [id,mesh]of screens)mesh.visible=id===current||traveling;
 if($('experiment-dialog').open&&activeStation)drawExperiment($('experiment-canvas'),activeStation.id,Number($('parameter').value),experimentTime());
 renderer.info.reset();if(quality)composer.render();else renderer.render(scene,camera);
 if(now-lastMetrics>1500){lastMetrics=now;const avg=frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length;sceneStatus.metrics={fps:Math.round(1/avg),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,location:String(current),playingVideos:[...videos.values()].filter(v=>!v.paused).length,gateOpenPercent:entranceGates?Math.round(entranceGates.fraction*100):null};if($('diagnostics'))$('diagnostics').textContent=JSON.stringify({...sceneStatus.metrics,errors:sceneStatus.errors},null,2);}
}
let dragging=false,dragX=0,dragY=0;
// Looking around must never start a text selection over the cards or labels the pointer passes.
let downX=0,downY=0;
$('scene').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')e.preventDefault();getSelection()?.removeAllRanges();downX=e.clientX;downY=e.clientY;if(traveling||film||camTween)return;dragging=true;document.body.classList.add('dragging');dragX=e.clientX;dragY=e.clientY;$('scene').setPointerCapture(e.pointerId);});
$('scene').addEventListener('pointermove',e=>{if(!dragging)return;lookYaw-= (e.clientX-dragX)*.003;lookPitch+= (e.clientY-dragY)*.002;lookPitch=THREE.MathUtils.clamp(lookPitch,-.65,.75);lookYaw=THREE.MathUtils.clamp(lookYaw,-1.45,1.45);dragX=e.clientX;dragY=e.clientY;});
document.addEventListener('selectstart',e=>{if(dragging)e.preventDefault();});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('scene').addEventListener(ev,()=>{dragging=false;document.body.classList.remove('dragging');});
// A click (not a drag) on the room's screen opens the film; the cursor shows it can be clicked.
function overScreen(e){if(!activeStation||film||traveling||!ready)return false;const sc=screens.get(activeStation.id);if(!sc)return false;const r=new THREE.Raycaster();r.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1),camera);return r.intersectObject(sc).length>0;}
$('scene').addEventListener('click',e=>{if(Math.hypot(e.clientX-downX,e.clientY-downY)<6&&overScreen(e))enterFilm();});
$('scene').addEventListener('pointermove',e=>{if(!dragging)$('scene').classList.toggle('over-screen',overScreen(e));});
addEventListener('resize',()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.fov=baseFov();if(film&&!film.dom){const v=filmView(film.id);camTween=null;camera.position.copy(v.p);camera.fov=v.fov;lookBase.copy(v.t);}camera.updateProjectionMatrix();if(!traveling&&!film){lookBase.copy(viewTarget(current));lookYaw=lookPitch=0;}renderer.setSize(innerWidth,innerHeight);if(composer)composer.setSize(innerWidth,innerHeight);});
document.addEventListener('visibilitychange',()=>{for(const [id,v]of videos)if(document.hidden)v.pause();else if(id===current&&ready&&!traveling)playVideo(id,v);});
addEventListener('resize',()=>{if($('map-dialog').open)renderMap();});
// The skip link lands on the room card when one is shown, otherwise on the next way forward.
document.querySelector('.skip').onclick=e=>{e.preventDefault();const t=activeStation?$('experiment-open'):$('hotspots').querySelector('button')||$('map-open');t.focus();};
$('accessible-open').onclick=()=>{accessible=true;document.body.classList.add('accessible');current=1;updateUI();};
initMusic($('castle-music'),$('sound'),message=>setText('sr-announcement',message));
init();
