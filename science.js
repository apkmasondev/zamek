// All numeric inputs below are explicit teaching-model assumptions, not measured data.
export const pendulumPeriod=(length,g=9.81)=>2*Math.PI*Math.sqrt(length/g);
export function collision(e,u=1){return {v1:(1-e)*u/2,v2:(1+e)*u/2,pBefore:u,pAfter:u,energyBefore:u*u/2,energyAfter:((1-e)**2+(1+e)**2)*u*u/8};}
export const energyBalance=efficiency=>({useful:efficiency,environment:100-efficiency});
export const circuit=voltage=>({current:voltage/10,power:voltage*voltage/10});
export const illustrativeDistribution=context=>context<.5?[.65,.25,.10]:[.15,.70,.15];
export const states=['Ciało stałe','Ciecz','Gaz'];
// Polish decimal comma for every number shown to visitors.
export const formatPl=(n,digits)=>n.toFixed(digits).replace('.',',');
export function explanation(id,v){
 switch(id){
 case 1:return 'Pryzmat rozdziela barwy obecne w białym świetle. Suwak rozsuwa wachlarz na rysunku, żeby łatwiej było je rozróżnić; w prawdziwym pryzmacie rozszczepienie zależy od rodzaju szkła.';
 case 2:return `Przy długości ${formatPl(v,1)} m jedno pełne wahnięcie tam i z powrotem trwa około ${formatPl(pendulumPeriod(v),2)} s. Dłuższe wahadło kołysze się wolniej.`;
 case 3:return 'Na orbicie kołowej prędkość satelity jest zawsze prostopadła do kierunku ku Ziemi. Grawitacja zmienia kierunek ruchu, ale nie szybkość. Schemat nie zachowuje skali.';
 case 4:{const c=collision(v),kept=Math.abs(c.energyAfter-c.energyBefore)<.005;return `Po zderzeniu: v₁ = ${formatPl(c.v1,2)} m/s, v₂ = ${formatPl(c.v2,2)} m/s. Łączny pęd wciąż wynosi 1 kg·m/s, a energia ruchu ${kept?`pozostaje równa ${formatPl(c.energyBefore,2)} J`:`maleje z ${formatPl(c.energyBefore,2)} J do ${formatPl(c.energyAfter,2)} J`}.`;}
 case 5:{const e=energyBalance(v);return `Energia użyteczna: ${e.useful.toFixed(0)} ze 100 jednostek. Przekazana otoczeniu: ${e.environment.toFixed(0)}. Razem nadal 100 — energia nie znika.`;}
 case 6:{const c=circuit(v);return `Przy oporze 10 Ω: prąd ${formatPl(c.current,2)} A, moc ${formatPl(c.power,2)} W. ${v===0?'Przy zerowym napięciu prąd nie płynie.':'Ładunek krąży w obwodzie, a energia trafia do opornika.'}`;}
 case 7:return 'Obracając magnes, obracasz całe jego pole: igła kompasu w tym samym miejscu wskazałaby inny kierunek. Wewnątrz magnesu linie biegną od S do N.';
 case 8:return ['Uporządkowanie nie oznacza bezruchu: cząsteczki ciała stałego ciągle drgają.','W cieczy cząsteczki są wciąż blisko siebie, ale przesuwają się i zmieniają sąsiadów — dlatego ciecz płynie.','W gazie cząsteczki są daleko od siebie i poruszają się w różnych kierunkach, więc gaz wypełnia całe naczynie.'][Math.round(v)];
 case 9:return ['DNA jest matrycą, na której powstaje RNA. To etap transkrypcji.','Powstałe mRNA niesie zapis, który odczyta rybosom.','Rybosom łączy aminokwasy w łańcuch białkowy. To etap translacji.'][Math.round(v)];
 case 10:return v<.5?'„Zamek na wzgórzu ma…” — słowa „na wzgórzu” wskazują budowlę, więc najbardziej prawdopodobne są „wieże”. Liczby ustalono ręcznie.':'„Zamek w drzwiach ma…” — to samo słowo „zamek”, ale kontekst wskazuje mechanizm. Liczby nie pochodzą z prawdziwego modelu językowego.';
 }
}
export function drawExperiment(canvas,id,v,t=0){
 const ctx=canvas.getContext('2d');const W=1000,H=450;ctx.clearRect(0,0,W,H);ctx.fillStyle='#101e25';ctx.fillRect(0,0,W,H);
 const gold='#d9bc83',muted='#607e89',white='#e6e0d2',cyan='#9bd0d5';
 const line=(pts,c=gold,width=3)=>{ctx.beginPath();ctx.strokeStyle=c;ctx.lineWidth=width;pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();};
 const circle=(x,y,r,c=gold,fill=true)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=c;ctx.fill();}else{ctx.strokeStyle=c;ctx.lineWidth=2;ctx.stroke();}};
 const label=(s,x,y,size=23,c=white)=>{ctx.font=`${size}px Georgia`;ctx.textAlign='center';ctx.fillStyle=c;ctx.fillText(s,x,y);};
 const arrow=(a,b,c=gold)=>{line([a,b],c);const ang=Math.atan2(b[1]-a[1],b[0]-a[0]);line([[b[0]-12*Math.cos(ang-.5),b[1]-12*Math.sin(ang-.5)],b,[b[0]-12*Math.cos(ang+.5),b[1]-12*Math.sin(ang+.5)]],c);};
 ctx.strokeStyle='#20353f';ctx.lineWidth=1;for(let x=0;x<W;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
 switch(id){
 case 1:{line([[60,190],[427.6,220],[553.4,222]],white,7);ctx.beginPath();ctx.moveTo(360,350);ctx.lineTo(490,100);ctx.lineTo(620,350);ctx.closePath();ctx.fillStyle='#9ccdd022';ctx.fill();ctx.strokeStyle=cyan;ctx.lineWidth=3;ctx.stroke();const colors=['#f57363','#efab62','#e6d776','#87cfa2','#77aada','#b19ae2'];colors.forEach((c,j)=>line([[553.4,222],[940,252+j*(v/100)*20]],c,5));label('BIAŁE ŚWIATŁO',220,140,17);label('PRYZMAT',490,397,17);break;}
 case 2:{const len=100+v*55,a=.19*Math.sin(t*Math.PI*2/pendulumPeriod(v));line([[300,60],[700,60]],muted,6);line([[500,65],[500+Math.sin(a)*len,65+Math.cos(a)*len]],gold,4);circle(500+Math.sin(a)*len,65+Math.cos(a)*len,25,gold);label(`T ≈ ${formatPl(pendulumPeriod(v),2)} s`,760,240,35);label('g = 9,81 m/s² · małe wychylenie',760,280,17,muted);break;}
 case 3:{circle(490,225,72,'#527e91');circle(490,225,150,gold,false);const a=v*Math.PI/180,px=490+150*Math.cos(a),py=225+150*Math.sin(a);circle(px,py,13,white);arrow([px,py],[px-60*Math.sin(a),py+60*Math.cos(a)],gold);arrow([px,py],[px-65*Math.cos(a),py-65*Math.sin(a)],cyan);label('prędkość styczna',780,150,24,gold);label('przyspieszenie ku Ziemi',780,194,21,cyan);label('ORBITA · SCHEMAT BEZ SKALI',500,423,17,muted);break;}
 case 4:{const c=collision(v),phase=t%5;let x1=150+Math.min(phase,2)*125,x2=456;if(phase>2){x1=400+(phase-2)*125*c.v1;x2=456+(phase-2)*125*c.v2;}line([[70,304],[930,304]],muted,3);circle(x1,275,28,gold);circle(x2,275,28,cyan);if(phase<2)arrow([x1,220],[x1+60,220]);else{if(c.v1>.01)arrow([x1,220],[x1+100*c.v1,220]);arrow([x2,220],[x2+100*c.v2,220],cyan);}label('m₁ = m₂ = 1 kg · u₁ = 1 m/s · u₂ = 0',500,90,25);label(phase<2?'PRZED ZDERZENIEM':'PO ZDERZENIU',500,380,18);break;}
 case 5:{const e=energyBalance(v);ctx.fillStyle=muted;ctx.fillRect(130,150,150,130);label('100',205,222,40);arrow([300,215],[435,215]);ctx.fillStyle=gold;ctx.fillRect(450,150,420*e.useful/100,55);ctx.fillStyle=cyan;ctx.fillRect(450,235,420*e.environment/100,55);label('energia użyteczna',630,130,21,gold);label('energia do otoczenia',650,328,21,cyan);break;}
 case 6:{const c=circuit(v);line([[230,120],[730,120],[730,325],[230,325],[230,120]],gold,5);ctx.fillStyle='#101e25';ctx.fillRect(195,192,70,45);line([[195,202],[265,202]],gold,5);line([[211,225],[249,225]],gold,5);ctx.fillStyle='#101e25';ctx.fillRect(685,170,90,88);ctx.strokeStyle=cyan;ctx.lineWidth=3;ctx.strokeRect(708,170,44,88);if(v>0){ctx.shadowColor='#f8c772';ctx.shadowBlur=v*3;ctx.fillStyle=`rgba(238,190,110,${v/20})`;ctx.fillRect(710,172,40,84);ctx.shadowBlur=0;}label(`${formatPl(v,1)} V`,120,224,28);label('R = 10 Ω',850,222,26);label(`I = ${formatPl(c.current,2)} A`,500,385,25);label('IDEALNY OPORNIK · OBWÓD ZAMKNIĘTY',500, sixty(),16,muted);break;}
 case 7:{ctx.save();ctx.translate(500,225);ctx.rotate(v*Math.PI/180);for(const h of [60,100,150]){ctx.beginPath();ctx.ellipse(0,0,210,h,0,0,Math.PI*2);ctx.strokeStyle=cyan;ctx.lineWidth=2;ctx.stroke();arrow([-12,-h],[12,-h],cyan);arrow([-12,h],[12,h],cyan);}ctx.fillStyle=gold;ctx.fillRect(-100,-25,100,50);ctx.fillStyle=muted;ctx.fillRect(0,-25,100,50);label('N',-50,8,25,'#101e25');label('S',50,8,25);arrow([80,0],[-80,0],white);ctx.restore();break;}
 case 8:{const phase=Math.round(v);for(let j=0;j<36;j++){let x,y;if(phase===0){x=330+(j%6)*60+Math.sin(t*6+j)*3;y= ninety() +Math.floor(j/6)*50+Math.cos(t*6+j)*3;}else if(phase===1){x=280+((j*77.3+Math.sin(t*.7+j)*30)%420+420)%420;y=230+((j*34.6+Math.cos(t*.6+j)*25)%110+110)%110;}else{x=80+((j*89.3+t*(30+(j%5)*10)*(j%2?1:-1))%840+840)%840;y=60+((j*53.6+t*(20+(j%7)*4)*(j%3?1:-1))%300+300)%300;}circle(x,y,9,cyan);}label(states[phase].toUpperCase(),500,420,23);break;}
 case 9:{const step=Math.round(v);for(let j=0;j<28;j++){const y1=210+Math.sin(j*.4)*50,y2=210-Math.sin(j*.4)*50;circle(100+j*7,y1,3,gold);circle(100+j*7,y2,3,gold);if(j%2===0)line([[100+j*7,y1],[100+j*7,y2]],muted,2);}arrow([310,210],[390,210],step>=1?gold:muted);line(Array.from({length:35},(_,j)=>[410+j*5,210+Math.sin(j*.4)*10]),step>=1?cyan:muted,4);arrow([610,210],[680,210],step===2?gold:muted);circle(750,190,45,step===2?gold:muted);circle(750,245,28,step===2?gold:muted);if(step===2){for(let j=0;j<13;j++)circle(775+j*6,170-Math.sin(j*.2)*75,5,white);}label('DNA',190,330,26);label('RNA',500,330,26);label('BIAŁKO',800,330,26);label('transkrypcja',350,120,18);label('translacja',650,120,18);break;}
 case 10:{const p=illustrativeDistribution(v);label(v<.5?'Zamek na wzgórzu ma…':'Zamek w drzwiach ma…',500,76,29);['wieże','mechanizm','historię'].forEach((s,j)=>{label(s,200,172+j*78,24);ctx.fillStyle='#29404b';ctx.fillRect(330,148+j*78,420,32);ctx.fillStyle=j===p.indexOf(Math.max(...p))?gold:muted;ctx.fillRect(330,148+j*78,420*p[j],32);label(`${Math.round(p[j]*100)}%`,825,173+j*78,24);});label('UMOWNY ROZKŁAD · SUMA 100% · NIE POCHODZI Z MODELU JĘZYKOWEGO',500,420,15,muted);break;}
 }
}
function sixty(){return 60;}function ninety(){return 90;}


