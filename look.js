import * as THREE from 'three';
import {ImprovedNoise} from 'three/addons/math/ImprovedNoise.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

// The look of the castle: sky, distant ranges, environment light and surface detail.
// Surfaces are dressed on the GPU from world position: procedural patterns plus tiling CC0 photographs (public/textures).

// ---------------------------------------------------------------- shared GLSL
const NOISE = `
float lkHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float lkNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(lkHash(i),lkHash(i+vec3(1,0,0)),f.x),mix(lkHash(i+vec3(0,1,0)),lkHash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(lkHash(i+vec3(0,0,1)),lkHash(i+vec3(1,0,1)),f.x),mix(lkHash(i+vec3(0,1,1)),lkHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float lkFbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*lkNoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
`;

// Adds world-space position and normal to a built-in material and splices GLSL into its fragment stages.
function extend(material, key, {uniforms = {}, head = '', color = '', roughness = '', metalness = '', emissive = '', vertex = '', vertexHead = '', normal = ''}) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 lkPos;\nvarying vec3 lkNrm;\nuniform float lkTime;\n' + vertexHead + '\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n' + vertex + '\nlkPos=(modelMatrix*vec4(transformed,1.)).xyz;\nlkNrm=normalize(mat3(modelMatrix)*objectNormal);');
    shader.uniforms.lkTime = uniforms.lkTime || sharedTime;
    shader.fragmentShader = 'varying vec3 lkPos;\nvarying vec3 lkNrm;\n' + NOISE + head + '\n' + shader.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat lkRough=-1.,lkMetal=-1.,lkRoughOff=0.;\n' + color)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=lkRough>=0.?lkRough:clamp(roughnessFactor+lkRoughOff,0.,1.);\n' + roughness)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif(lkMetal>=0.)metalnessFactor=lkMetal;\n' + metalness)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + emissive)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + normal);
  };
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
}

// ---------------------------------------------------------------- photographic stone (Poly Haven, CC0)
// Tiling photo textures are projected from world position (triplanar), so the model needs no UVs and does not grow.
// A set: color (sRGB), normal (OpenGL), arm (AO, roughness, metal). Scale: metres per tile.
export const TEXTURE_SETS = {
  wall: {files: ['medieval_blocks_03_color', 'medieval_blocks_03_normal', 'medieval_blocks_03_arm'], scale: 2.6, lum: .150},
  trim: {files: [null, 'worn_rock_natural_01_normal', 'worn_rock_natural_01_arm'], scale: 1.6},
  bridge: {files: ['stone_brick_wall_001_color', 'stone_brick_wall_001_normal', 'stone_brick_wall_001_arm'], scale: 2.5, lum: .057},
  roof: {files: ['roof_slates_02_color', 'roof_slates_02_normal', 'roof_slates_02_arm'], scale: 2.4},
  rock: {files: ['cliff_side_color', 'cliff_side_normal', 'cliff_side_arm'], scale: 7},
  grass: {files: ['aerial_grass_rock_color', 'aerial_grass_rock_normal', 'aerial_grass_rock_arm'], scale: 9, lum: .121},
  paving: {files: ['cobblestone_floor_08_color', 'cobblestone_floor_08_normal', 'cobblestone_floor_08_arm'], scale: 2.3, lum: .277},
  forecourt: {files: ['rock_surface_color', 'rock_surface_normal', 'rock_surface_arm'], scale: 2.6, lum: .126},
  oak: {files: ['rough_wood_color', 'rough_wood_normal', 'rough_wood_arm'], scale: .9, lum: .13},
  hallFloor: {files: ['marble_01_stone_color', 'marble_01_stone_normal', 'marble_01_stone_arm'], scale: 2.3, lum: .349},
  galleryFloor: {files: ['large_floor_tiles_02_stone_color', 'large_floor_tiles_02_stone_normal', 'large_floor_tiles_02_stone_arm'], scale: 1.7, lum: .19},
  mountain: {files: ['aerial_rocks_02_color', 'aerial_rocks_02_normal', null], scale: 90, lum: .120},
  snow: {files: ['snow_field_aerial_color', null, null], scale: 140, lum: .257}
};
export async function loadTextureSets(renderer, base = 'textures/') {
  const loader = new THREE.TextureLoader(), aniso = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 1), out = {};
  await Promise.all(Object.entries(TEXTURE_SETS).map(async ([key, set]) => {
    const [c, n, a] = await Promise.all(set.files.map((f, i) => f ? loader.loadAsync(base + f + '.jpg').catch(() => { throw Error('brak pliku ' + f + '.jpg'); }).then(t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.colorSpace = i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t;
    }) : null));
    out[key] = {color: c, normal: n, arm: a, scale: set.scale, lum: set.lum || .2};
  }));
  return out;
}
const TRI_HEAD = `uniform sampler2D tpColor;uniform sampler2D tpNormal;uniform sampler2D tpArm;uniform float tpScale;uniform vec3 tpTint;uniform float tpNormalStrength;uniform float tpSides;uniform float tpLum;uniform float tpDesat;
vec3 tpWeights(vec3 n){vec3 a=abs(n)+1e-4;vec3 w=a*a*a;w*=w;w.y*=1.-tpSides;return w/max(1e-4,w.x+w.y+w.z);}
vec4 tpSample(sampler2D t,vec3 p,vec3 w){vec4 c=vec4(0.);if(w.x>.01)c+=texture2D(t,p.zy)*w.x;if(w.y>.01)c+=texture2D(t,p.xz)*w.y;if(w.z>.01)c+=texture2D(t,p.xy)*w.z;return c;}
// Like tpSample, but each projection plane gets its own tile offset (corners do not repeat the same stones) and a mip bias.
vec4 tpSampleOffset(sampler2D t,vec3 p,vec3 w,float b){vec4 c=vec4(0.);if(w.x>.01)c+=texture2D(t,p.zy+vec2(.37,.13),b)*w.x;if(w.y>.01)c+=texture2D(t,p.xz,b)*w.y;if(w.z>.01)c+=texture2D(t,p.xy+vec2(.61,.29),b)*w.z;return c;}
// Whiteout blend of the three tangent-space normals into a world normal.
vec3 tpWorldNormal(sampler2D nm,vec3 q,vec3 n,vec3 w,float k){
 vec3 tx=texture2D(nm,q.zy).xyz*2.-1.,ty=texture2D(nm,q.xz).xyz*2.-1.,tz=texture2D(nm,q.xy).xyz*2.-1.;
 tx.xy*=k;ty.xy*=k;tz.xy*=k;
 tx=vec3(tx.xy+n.zy,abs(tx.z)*n.x);ty=vec3(ty.xy+n.xz,abs(ty.z)*n.y);tz=vec3(tz.xy+n.xy,abs(tz.z)*n.z);
 return tx.zyx*w.x+ty.xzy*w.y+tz.xyz*w.z;}
vec3 tpWorldNormalOffset(sampler2D nm,vec3 q,vec3 n,vec3 w,float k){
 vec3 tx=texture2D(nm,q.zy+vec2(.37,.13)).xyz*2.-1.,ty=texture2D(nm,q.xz).xyz*2.-1.,tz=texture2D(nm,q.xy+vec2(.61,.29)).xyz*2.-1.;
 tx.xy*=k;ty.xy*=k;tz.xy*=k;
 tx=vec3(tx.xy+n.zy,abs(tx.z)*n.x);ty=vec3(ty.xy+n.xz,abs(ty.z)*n.y);tz=vec3(tz.xy+n.xy,abs(tz.z)*n.z);
 return tx.zyx*w.x+ty.xzy*w.y+tz.xyz*w.z;}
// Detail fades with distance so the tiling of a photo never reads as a grid across a landscape.
float tpFade(){return 1.-smoothstep(45.,240.,length(lkPos-cameraPosition));}
`;
// Colour and ARM replace the flat material colour; the procedural drift and grime applied after it keep the tiling from reading.
const TRI_COLOR = (withColor, withArm, detail, aoOnly) => `
vec3 tpP=lkPos/tpScale;tpP.y*=mix(1.,.72,tpSides);vec3 tpW=tpWeights(lkNrm);
${withColor ? (detail ? '{vec3 lw=vec3(.3,.55,.15);float la=dot(tpSample(tpColor,tpP,tpW).rgb,lw);vec3 p2=vec3(lkPos.x*.766+lkPos.z*.643,lkPos.y,lkPos.z*.766-lkPos.x*.643)/(tpScale*2.6);float lb=dot(tpSample(tpColor,p2+.37,tpW).rgb,lw);float lm=mix(la,lb,smoothstep(.32,.68,lkFbm(lkPos*.016)));diffuseColor.rgb*=mix(1.,clamp(lm/tpLum,.2,2.),mix(.3,1.,tpFade()))*tpTint;}' : '{vec3 c=tpSample(tpColor,tpP,tpW).rgb;c=mix(c,vec3(dot(c,vec3(.3,.55,.15))),tpDesat);diffuseColor.rgb=c*tpTint;}') : ''}
${withArm ? 'vec3 tpArmV=tpSample(tpArm,tpP,tpW).rgb;diffuseColor.rgb*=mix(1.,tpArmV.r,.65);' + (aoOnly ? 'lkRough=clamp(.9+(tpArmV.g-.5)*.15,0.,1.);' : 'lkRough=clamp(tpArmV.g+lkRoughOff,0.,1.);') : ''}
`;
// Whiteout blend of the three tangent-space normals into a world normal, then to view space for three.js lighting.
const TRI_NORMAL = `
if(dot(lkNrm,lkNrm)>1e-6){vec3 n=normalize(lkNrm);vec3 tpQ=lkPos/tpScale;tpQ.y*=mix(1.,.72,tpSides);vec3 w=tpWeights(n);
 vec3 nw=tpWorldNormal(tpNormal,tpQ,n,w,tpNormalStrength*mix(.25,1.,tpFade()));
 if(dot(nw,nw)>1e-8)normal=normalize((viewMatrix*vec4(normalize(nw)*faceDirection,0.)).xyz);}
`;
function triplanar(set, {tint = [1, 1, 1], normalStrength = 1, sides = 0, detail = false, desat = 0, aoOnly = false} = {}) {
  return {
    uniforms: {tpColor: {value: set.color}, tpNormal: {value: set.normal}, tpArm: {value: set.arm}, tpScale: {value: set.scale},
      tpTint: {value: new THREE.Vector3(...tint)}, tpNormalStrength: {value: normalStrength}, tpSides: {value: sides}, tpLum: {value: set.lum || .2}, tpDesat: {value: desat}},
    head: TRI_HEAD, color: TRI_COLOR(!!set.color, !!set.arm, detail, aoOnly), normal: set.normal ? TRI_NORMAL : ''
  };
}
// Castle footprint in three.js coordinates (Blender y = -z); the gate zone ends before the first span of the bridge.
const FOOTPRINT = `float lkBridge(vec3 p){float ax=abs(p.x);float inside=step(ax,38.5)*step(p.z,mix(54.6,51.6,step(ax,12.)))*step(-90.5,p.z);return 1.-inside;}
`;
const WALL_HEAD = `uniform sampler2D tpColor2;uniform sampler2D tpNormal2;uniform sampler2D tpArm2;uniform float tpScale2;uniform vec3 tpTint2;
` + FOOTPRINT;
const WALL_COLOR = `
float lkBr=lkBridge(lkPos);vec3 tpW=tpWeights(lkNrm);vec3 tpCol,tpArmV;
if(lkBr>.5){vec3 q=lkPos/tpScale2;tpCol=tpSample(tpColor2,q,tpW).rgb;tpCol=mix(tpCol,vec3(dot(tpCol,vec3(.3,.55,.15))),.85)*tpTint2;tpArmV=tpSample(tpArm2,q,tpW).rgb;}
else{vec3 q=lkPos/tpScale;
 // Anti-tiling: divide out the photo's block-scale tones (a blurred mip of itself), keep grain and joints,
 // then give the blocks non-repeating tones from world-space noise.
 vec3 c=tpSampleOffset(tpColor,q,tpW,0.).rgb,cb=tpSampleOffset(tpColor,q,tpW,6.5).rgb;
 c=mix(c,c/max(cb,vec3(.004))*vec3(.185,.145,.098),.8);
 float blk=lkNoise(vec3(lkPos.x*1.6+lkPos.z*1.6,lkPos.y*3.3,lkPos.z*.9-lkPos.x*.9));
 c*=.84+.32*blk;
 tpCol=mix(c,vec3(dot(c,vec3(.3,.55,.15))),tpDesat)*tpTint;tpArmV=tpSampleOffset(tpArm,q,tpW,0.).rgb;}
diffuseColor.rgb=tpCol*mix(1.,tpArmV.r,.65);lkRough=clamp(tpArmV.g,0.,1.);
`;
const WALL_NORMAL = `
if(dot(lkNrm,lkNrm)>1e-6){vec3 n=normalize(lkNrm);vec3 w=tpWeights(n);float k=tpNormalStrength*mix(.25,1.,tpFade());
 vec3 nw=lkBridge(lkPos)>.5?tpWorldNormal(tpNormal2,lkPos/tpScale2,n,w,k):tpWorldNormalOffset(tpNormal,lkPos/tpScale,n,w,k);
 if(dot(nw,nw)>1e-8)normal=normalize((viewMatrix*vec4(normalize(nw)*faceDirection,0.)).xyz);}
`;
// Cobbles of the bridge, promenade and terrace. Anti-tiling as on the walls: the photo's patch-scale tones are divided out
// (blurred mip), then slow world-space drifts of warm and cool stone take their place; worn tops are a little smoother.
const COBBLE_COLOR = `
vec3 tpW=tpWeights(lkNrm);vec3 q=lkPos/tpScale;
vec3 c=tpSampleOffset(tpColor,q,tpW,0.).rgb,cb=tpSampleOffset(tpColor,q,tpW,6.5).rgb;
c=mix(c,c/max(cb,vec3(.004))*vec3(.302,.275,.231),.75);
c*=mix(vec3(.93,.96,1.02),vec3(1.07,1.,.9),lkFbm(lkPos*.07))*(.86+.28*lkFbm(lkPos*.45+5.));
vec3 tpArmV=tpSampleOffset(tpArm,q,tpW,0.).rgb;
diffuseColor.rgb=mix(c,vec3(dot(c,vec3(.3,.55,.15))),tpDesat)*tpTint*mix(1.,tpArmV.r,.7);
lkRough=clamp(tpArmV.g+.04,0.,1.);
`;
// Forecourt flags: the model lays the slabs (joints and four slab tones); the jointless rock photo adds pores, stains and
// hue within each slab. The line walked from the bridge to the lodge is a little lighter and smoother; damp patches drift across.
const FORECOURT = `
vec3 tpW=tpWeights(lkNrm);vec3 q=lkPos/tpScale;
vec3 c=tpSampleOffset(tpColor,q,tpW,0.).rgb,cb=tpSampleOffset(tpColor,q,tpW,6.5).rgb;
vec3 r=mix(c/vec3(.16,.119,.084),c/max(cb,vec3(.004)),.5);r=mix(vec3(dot(r,vec3(.3,.55,.15))),r,.8);
float walk=(1.-smoothstep(1.,3.8,abs(lkPos.x)))*step(.9,lkNrm.y);
float damp=smoothstep(.52,.76,lkFbm(lkPos*.11+2.));
vec3 tpArmV=tpSampleOffset(tpArm,q,tpW,0.).rgb;
diffuseColor.rgb*=clamp(r,.3,2.2)*tpTint*(1.+.08*walk)*(1.-.2*damp)*mix(1.,tpArmV.r,.6);
lkRough=clamp(.78+.3*(tpArmV.g-.5)-.12*walk-.08*damp,0.,1.);
`;
// Old oak of the gate leaves and benches: each 0.5 m board takes its own stretch of the grain photo and its own tone.
// Projected in object space (the gate leaves swing open; the grain must stay on the boards), normals brought back to world.
const OAK_HEAD = 'varying vec3 lkObj;varying vec3 lkObjN;varying vec3 lkM0;varying vec3 lkM1;varying vec3 lkM2;';
const OAK_VERTEX = 'lkObj=transformed;lkObjN=objectNormal;lkM0=modelMatrix[0].xyz;lkM1=modelMatrix[1].xyz;lkM2=modelMatrix[2].xyz;';
const OAK_Q = `float lkBoard=lkHash(vec3(floor(lkObj.x*2.),floor(lkObj.z*2.),7.));vec3 lkOq=lkObj/tpScale*vec3(1.,.34,1.)+vec3(5.3,7.1,3.7)*lkBoard;`;
const OAK = OAK_Q + `
vec3 tpW=tpWeights(normalize(lkObjN));vec3 c=tpSample(tpColor,lkOq,tpW).rgb;c=vec3(dot(c,vec3(.3,.55,.15)));
vec3 tpArmV=tpSample(tpArm,lkOq,tpW).rgb;
float lkDamp=(1.-smoothstep(.1,1.6,lkObj.y))*step(-.3,lkObj.y);
diffuseColor.rgb*=pow(c/.128,vec3(1.8))*tpTint*(.75+.4*lkBoard)*(1.-.35*lkDamp)*mix(1.,tpArmV.r,.8);lkRough=clamp(.55+.45*tpArmV.g,0.,1.);
`;
const OAK_NORMAL = `
if(dot(lkObjN,lkObjN)>1e-6){${OAK_Q}vec3 n=normalize(lkObjN);vec3 w=tpWeights(n);
 vec3 nw=mat3(lkM0,lkM1,lkM2)*tpWorldNormal(tpNormal,lkOq,n,w,tpNormalStrength*mix(.25,1.,tpFade()));
 if(dot(nw,nw)>1e-8)normal=normalize((viewMatrix*vec4(normalize(nw)*faceDirection,0.)).xyz);}
`;
// Stone outside the castle (balustrades, piers, lodge trims): rain streaks on the sides, grime at the foot and under
// the cap, lichen and dark spots on the tops. Inside the footprint the carved stone stays clean.
const WEATHERED = `
if(lkBridge(lkPos)>.5){
 float side=1.-smoothstep(.35,.75,abs(lkNrm.y));
 float streak=side*smoothstep(.5,.85,lkNoise(vec3(lkPos.x*7.,lkPos.y*.8,lkPos.z*7.)))*(.6+.4*lkNoise(lkPos*.5));
 float low=(1.-smoothstep(.05,.6,lkPos.y))*step(-.4,lkPos.y);
 float under=1.-smoothstep(-.6,-.15,lkNrm.y);
 float dirt=clamp(streak*.45+low*.4+under*.35,0.,.7);
 diffuseColor.rgb*=mix(vec3(.9,.88,.85)*(.88+.24*lkFbm(lkPos*1.3)),vec3(.5,.49,.44),dirt);
 float top=smoothstep(.55,.85,lkNrm.y);
 float lich=top*smoothstep(.58,.72,lkFbm(lkPos*2.6+9.));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.3,.31,.2)*(.7+.6*lkNoise(lkPos*20.)),lich*.55);
 diffuseColor.rgb*=1.-smoothstep(.78,.86,lkNoise(lkPos*11.))*(.4+.6*top+.3*side)*.3;
 lkRoughOff+=dirt*.1+lich*.1;}
`;
// Bark of the trees: vertical fissures and ridges, lighter weathered plates, a green tinge of algae low on the trunk.
const BARK = `
float lkFis=lkNoise(vec3(lkPos.x*11.,lkPos.y*1.4,lkPos.z*11.));float lkPl=lkFbm(lkPos*vec3(5.,1.1,5.));
diffuseColor.rgb*=(.55+.6*smoothstep(.28,.7,lkFis))*(.8+.4*lkPl);
float lkAlg=(1.-smoothstep(.2,1.4,lkPos.y))*smoothstep(.45,.7,lkFbm(lkPos*2.3));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.05,.07,.03),lkAlg*.5);lkRoughOff=.12;
`;
function strip(m) { m.map = null; m.normalMap = null; m.roughnessMap = null; m.aoMap = null; m.color.setRGB(1, 1, 1); return m; }

// ---------------------------------------------------------------- surfaces
const sharedTime = {value: 0};
const uniforms = {
  lkInterior: {value: 0},          // 1 inside the castle: windows glow with daylight
  lkWinGlow: {value: new THREE.Color(0, 0, 0)},
  lkStarGlow: {value: .35},
  lkTime: sharedTime
};

// Warm limestone: macro colour drift of weathered blocks, fine grain and grime towards the ground.
// Exterior faces keep the earlier patina under ledges and at the plinth.
const STONE = `
float lkM=lkFbm(lkPos*vec3(.13,.19,.13));
float lkF=lkNoise(lkPos*vec3(2.1,3.4,2.1));
diffuseColor.rgb*=mix(vec3(.80,.79,.78),vec3(1.10,1.03,.93),lkM)*(.92+.16*lkF);
float lkBase=(1.-smoothstep(-.2,1.5,lkPos.y))*step(-.35,lkPos.y);
diffuseColor.rgb*=1.-lkBase*.2;
lkRoughOff=(lkF-.5)*.16;
`;
// Exterior weathering under ledges and at the plinth (formerly patina.js), in three.js world coordinates.
const PATINA_HEAD = `float lkRange(float x,float a,float b){return step(a,x)*step(x,b);}
float lkUnder(float h,float ledge){return smoothstep(ledge-.65,ledge-.09,h)*(1.-smoothstep(ledge-.08,ledge,h));}`;
const PATINA = `
{vec3 p=lkPos;float ax=abs(p.x);
 float sides=lkRange(ax,35.12,37.8)*lkRange(p.z,-45.3,53.8);
 float front=lkRange(ax,14.,35.9)*lkRange(p.z,53.25,54.2);
 float gate=lkRange(ax,4.,12.)*lkRange(p.z,49.35,51.6);
 float pavilion=lkRange(ax,13.85,14.8)*lkRange(p.z,-77.,-54.8);
 float exterior=min(1.,sides+front+gate+pavilion)*(1.-smoothstep(.25,.6,abs(lkNrm.y)));
 float grain=clamp(.65+.18*sin(p.x*1.73+p.z*.37)+.14*sin(p.z*2.31-p.x*.29),.25,1.);
 float base=(1.-smoothstep(.10,1.25,p.y))*lkRange(p.y,-.15,1.25);
 float ledges=sides*lkUnder(p.y,9.85)+front*(lkUnder(p.y,8.58)+lkUnder(p.y,10.18))+gate*lkUnder(p.y,13.8)+pavilion*lkUnder(p.y,25.8);
 float weather=exterior*grain*clamp(base*.40+ledges*.28,0.,.48);
 diffuseColor.rgb*=mix(vec3(1.),vec3(.57,.56,.48),weather);
 lkRoughOff+=weather*.12;}`;
// Polished room floors: 1.4 m slabs of dark basalt and grey limestone laid as a chequer, with veining and fine joints.
const FLOOR = `
float lkFloor=step(.9,lkNrm.y)*step(lkPos.y,.07);
if(lkFloor>.5){
 vec2 q=lkPos.xz/1.4;vec2 cell=floor(q),f=fract(q);
 float jd=min(min(f.x,1.-f.x),min(f.y,1.-f.y))*1.4;
 float joint=1.-smoothstep(.003,.008,jd);
 float chk=mod(cell.x+cell.y,2.);
 float h=lkHash(vec3(cell,3.1));
 // Marble veins: thin meandering lines (an iso-line of warped noise), not cloudy smears.
 vec3 vp=vec3(lkPos.x*.55+lkPos.z*.3,lkPos.z*.55-lkPos.x*.2,h*11.);
 float warp=lkFbm(vp*1.1);
 float vein=(1.-smoothstep(.0,.012,abs(lkFbm(vp*.45+warp*.9)-.5)))*smoothstep(.35,.65,lkNoise(vp*.8+7.));
 float vein2=(1.-smoothstep(.0,.006,abs(lkFbm(vp*1.2+3.+warp*.6)-.5)))*.6;
 vec3 a=vec3(.026,.029,.033),b=vec3(.17,.162,.145);
 vec3 c=mix(a,b,chk)*(.86+.28*h)*(.94+.12*warp);
 c=mix(c,mix(vec3(.2,.19,.18),vec3(.08,.075,.07),chk),vein*.35+vein2*.15);
 diffuseColor.rgb=mix(c,vec3(.008),joint);
 lkRough=mix(.16+.1*h+.06*warp,.85,joint);lkMetal=0.;
}else{
 // Plinths, batteries, archive volumes: dark polished limestone with faint cloudy veining.
 float cl=lkFbm(lkPos*vec3(1.7,2.3,1.7));
 diffuseColor.rgb=vec3(.021,.022,.025)*(.75+.5*cl);
 lkRough=.36+.12*cl;lkMetal=0.;
}`;
// Painted starry vault after Sainte-Chapelle and the Scrovegni chapel: azurite blue brushed on lime plaster (mottled,
// fine grain, hairline craquelure, soot towards the springing), gilded eight-point stars laid out as painters did, on a
// staggered lattice, with worn leaf where the gold has flaked.
const VAULT = `
float lkStar=0.;
if(lkNrm.y<.35){
 vec3 an=abs(lkNrm);
 vec2 uv=an.y>max(an.x,an.z)?lkPos.xz:(an.x>an.z?lkPos.zy:lkPos.xy);
 vec2 g=uv/.92;g.x+=.5*mod(floor(g.y),2.);vec2 cell=floor(g),d=(fract(g)-.5)*.92;
 float sq=max(abs(d.x),abs(d.y)),dm=max(abs(d.x+d.y),abs(d.x-d.y))*.7071,sd=min(sq,dm);
 float w=fwidth(sd)*1.2+1e-4,s=.072;
 lkStar=1.-smoothstep(s-w,s+w,sd);
 float flake=smoothstep(.62,.8,lkNoise(lkPos*22.+cell.xyx))*.85;
 lkStar*=1.-flake*step(.55,lkHash(vec3(cell,3.)));
 float boss=1.-smoothstep(.014-w,.014+w,length(d));
 float brush=lkNoise(vec3(uv.x*1.3+uv.y*.4,uv.y*5.,uv.x*.7))*.5+lkFbm(lkPos*.55)*.8;
 vec3 blue=vec3(.011,.021,.068)*(.62+.55*brush)*(.9+.2*lkNoise(lkPos*9.));
 float crack=1.-smoothstep(.0,.018,abs(lkNoise(lkPos*3.1)-.5))*.35;
 float soot=smoothstep(.5,.82,lkFbm(lkPos*.21+4.))*.3;
 blue*=crack*(1.-soot);
 vec3 gold=vec3(.78,.53,.2)*(.72+.4*lkNoise(lkPos*30.))*(1.-.35*boss);
 diffuseColor.rgb=mix(blue,gold,lkStar);
 lkRough=mix(.88,.34,lkStar);lkMetal=mix(0.,.9,lkStar);
 lkStar*=.8;
}`;
const VAULT_EMISSIVE = `totalEmissiveRadiance+=vec3(1.,.66,.28)*lkStar*lkStarGlow;`;
// Leaded glazing in lozenge quarries. From inside the panes carry daylight; outside they read as dark glass.
const LEADED = `
vec3 an=abs(lkNrm);
vec2 uv=an.x>an.z?lkPos.zy:lkPos.xy;
vec2 q=vec2(uv.x+uv.y*.62,uv.x-uv.y*.62)/.2;
vec2 f=fract(q);float lead=min(min(f.x,1.-f.x),min(f.y,1.-f.y));
float leadMask=1.-smoothstep(.035,.085,lead);
float h=lkHash(vec3(floor(q),2.));
vec3 glass=mix(vec3(.62,.74,.72),vec3(.86,.80,.60),h*h);
diffuseColor.rgb=mix(glass*.035,vec3(.012),leadMask);
float lkPane=(1.-leadMask)*(.75+.5*h);
lkRough=mix(.07,.6,leadMask);lkMetal=0.;
`;
const LEADED_EMISSIVE = `totalEmissiveRadiance=glass*lkPane*mix(lkWinGlow,vec3(1.35,1.3,1.2),lkInterior);`;
// Meadows: small-scale mottling so the grass is not a flat colour.
const MEADOW = `
// The exported shore colours drift from meadow green to teal-grey over the last 8 m above the lake and read as a faded
// band from above: keep the green down to the water, then a narrow darker, glossy strip of wet ground at the waterline.
float lkShore=1.-smoothstep(-13.,-9.,lkPos.y);diffuseColor.b=mix(diffuseColor.b,diffuseColor.g*.52,lkShore);
float lkWetB=1.-smoothstep(.05,.75,lkPos.y+18.82);diffuseColor.rgb*=1.-.45*lkWetB;
float lkG=lkFbm(lkPos*vec3(.09,.09,.09));float lkG2=lkNoise(lkPos*vec3(1.3,1.3,1.3));
diffuseColor.rgb*=mix(vec3(.78,.86,.72),vec3(1.12,1.06,.92),lkG)*(.9+.2*lkG2);
// Distant slopes: stands of spruce and bare rock, so the hills read as landscape rather than smooth domes.
float lkFar=smoothstep(60.,160.,length(lkPos.xz));
float lkWood=smoothstep(.47,.58,lkFbm(lkPos*vec3(.011,.02,.011))+.12*lkNoise(lkPos*.09))*lkFar*step(-12.,lkPos.y);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.018,.036,.02)*(.7+.6*lkNoise(lkPos*.35)),lkWood*.92);
float lkSteep=(1.-smoothstep(.62,.8,lkNrm.y))*lkFar;
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.15,.13)*(.8+.4*lkNoise(lkPos*.2)),lkSteep*.85);
lkRoughOff=lkWood*.1-lkWetB*.35;
`;
const SLATE = `
float lkS=lkFbm(lkPos*vec3(.21,.3,.21));
diffuseColor.rgb*=mix(vec3(.82,.86,.9),vec3(1.12,1.08,1.02),lkS);
`;
const PAVING_TONE = `
float lkP=lkFbm(lkPos*vec3(.25,.25,.25));float lkP2=lkNoise(lkPos*3.1);
diffuseColor.rgb*=mix(vec3(.9,.88,.86),vec3(1.14,1.08,1.0),lkP)*(.94+.12*lkP2);
lkRoughOff=-.08+.14*lkP2;
`;
const PAVING = PAVING_TONE + `
// Walkways: flags laid in running bond with sunken joints, each stone slightly different.
if(lkNrm.y>.9){vec2 sz=vec2(.9,.6);vec2 q=lkPos.xz/sz;q.x+=floor(q.y)*.5;vec2 c=floor(q),f=fract(q);vec2 dd=min(f,1.-f)*sz;float jd=min(dd.x,dd.y);
 float joint=1.-smoothstep(.004,.013,jd);float h=lkHash(vec3(c,4.));
 diffuseColor.rgb*=(.86+.26*h)*(1.-.08*smoothstep(.02,.1,jd)*(1.-smoothstep(.1,.3,jd)));
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.38,joint);lkRoughOff+=joint*.25+(h-.5)*.08;}
`;
// Great Hall: honed cream limestone slabs with soft veining and a satin sheen that catches the chandeliers.
const HALL_FLOOR = `
float lkV=lkFbm(vec3(lkPos.x*.8+lkPos.z*.3,lkPos.z*2.4,lkPos.x*.2));
diffuseColor.rgb*=vec3(.62,.56,.47)*(.9+.16*lkNoise(lkPos*.6));
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.72,.7,.68),smoothstep(.52,.7,lkV)*.8);
lkRough=.3+.14*lkV;
`;
// The castle rock: bedding planes, darker wet stone at the waterline and moss on the ledges.
const ROCK = `
float lkBed=sin(lkPos.y*2.3+lkFbm(lkPos*vec3(.12,.05,.12))*4.)*.5+.5;
diffuseColor.rgb*=mix(vec3(1.02,1.0,.96),vec3(1.4,1.34,1.24),lkBed)*(.82+.36*lkFbm(lkPos*.35));
float lkWet=1.-smoothstep(-18.9,-16.6,lkPos.y);
diffuseColor.rgb*=1.-lkWet*.5;lkRoughOff=-lkWet*.35;
float lkMoss=smoothstep(.5,.82,lkNrm.y)*smoothstep(.38,.62,lkFbm(lkPos*.28+3.));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.045,.07,.028)*(.8+.4*lkNoise(lkPos*2.)),lkMoss*.85);
`;
const ROCK_PHOTO = ROCK.replace('vec3(1.02,1.0,.96),vec3(1.4,1.34,1.24)','vec3(.9,.9,.88),vec3(1.06,1.04,1.0)');
const BRASS = `
float lkB=lkFbm(lkPos*vec3(2.6,2.6,2.6));float lkB2=lkNoise(lkPos*vec3(22.,22.,22.));
vec3 lkBr=diffuseColor.rgb;float lkBl=dot(lkBr,vec3(.3,.55,.15));
lkBr=mix(vec3(lkBl),lkBr,.78)*vec3(1.02,.97,.9);
diffuseColor.rgb=lkBr*mix(.62,1.06,smoothstep(.25,.75,lkB))*(.93+.14*lkB2);
lkRoughOff=(1.-lkB)*.14+(lkB2-.5)*.06;
`;
// Foliage: every leaf a slightly different green, and a gentle sway in the wind.
const LEAF = `
float lkL=lkHash(floor(lkPos*3.)+.5);
diffuseColor.rgb*=vec3(.82+.36*lkL,.9+.24*lkL,.78+.2*lkNoise(lkPos*.4));
`;

// Room banners were flat blue rectangles. Each banner (a connected piece of the merged mesh) gets its own
// coordinates, and the shader weaves wool with a gilded border, the castle's compass star and a swallowtail hem.
function bannerCoordinates(geometry) {
  const pos = geometry.attributes.position, index = geometry.index, n = pos.count, parent = [...Array(n).keys()];
  const find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const tri = index ? index.array : [...Array(n).keys()];
  for (let i = 0; i < tri.length; i += 3) { const a = find(tri[i]); parent[find(tri[i + 1])] = a; parent[find(tri[i + 2])] = a; }
  // Vertices sharing a position (split normals) belong to the same banner too.
  const byKey = new Map();
  for (let i = 0; i < n; i++) { const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`; if (byKey.has(k)) parent[find(i)] = find(byKey.get(k)); else byKey.set(k, i); }
  const boxes = new Map();
  for (let i = 0; i < n; i++) { const r = find(i), b = boxes.get(r) || new THREE.Box3(); b.expandByPoint(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))); boxes.set(r, b); }
  const uv = new Float32Array(n * 2), size = new Float32Array(n * 2), v = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const b = boxes.get(find(i)); b.getSize(d); v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(b.min);
    const alongX = d.x >= d.z, w = Math.max(.01, alongX ? d.x : d.z);
    uv[i * 2] = (alongX ? v.x : v.z) / w; uv[i * 2 + 1] = v.y / Math.max(.01, d.y);
    size[i * 2] = w; size[i * 2 + 1] = d.y;
  }
  geometry.setAttribute('bannerUv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('bannerSize', new THREE.BufferAttribute(size, 2));
}
const BANNER_HEAD = 'varying vec2 vBan;varying vec2 vBanSize;';
const BANNER = `
vec2 bs=vBanSize;vec2 bp=vBan*bs;
float notch=.16*bs.x*(1.-abs(vBan.x-.5)*2.);
if(bp.y<notch)discard;
float edge=min(min(bp.x,bs.x-bp.x),min(bs.y-bp.y,bp.y-notch));
float weave=.5+.25*sin(lkPos.x*420.+lkPos.z*420.)*sin(lkPos.y*380.)+.25*lkNoise(lkPos*vec3(40.,6.,40.));
vec3 wool=vec3(.014,.026,.07)*(.8+.35*weave)*(.85+.3*lkFbm(lkPos*1.5));
float gold=1.-smoothstep(.07,.085,edge);
gold=max(gold,(1.-smoothstep(.02,.03,abs(edge-.14))));
vec2 c=vec2(.5*bs.x,bs.y*.64);vec2 q=bp-c;float r=length(q),R=bs.x*.3;
gold=max(gold,1.-smoothstep(.018,.03,abs(r-R)));
float ang=atan(q.y,q.x);float star=R*.82*(.42+.58*pow(abs(cos(ang*4.)),6.));
gold=max(gold,1.-smoothstep(star-.015,star,r));
diffuseColor.rgb=mix(wool,vec3(.72,.5,.2),gold);
lkRough=mix(.95,.38,gold);lkMetal=mix(0.,.8,gold);
`;

// Without the photographs (offline copy, blocked download) the dressed materials keep colours close to them, not the pale export averages.
const FALLBACK = {'Limestone · warm honed blocks': [.2, .15, .1], 'P2 · weathered limestone': [.14, .12, .1], 'Slate · blue grey': [.045, .055, .07],
  'Silhouette · fractured limestone': [.13, .12, .11], 'P2 · warm sandstone paving': [.24, .22, .19]};
export function dressSurfaces(castle, renderer, tex = null) {
  const done = new Map();
  const upgrade = source => {
    if (done.has(source)) return done.get(source);
    let m = source;
    const name = m.name;
    if (!tex && FALLBACK[name]) { m = m.clone(); m.color.setRGB(...FALLBACK[name]); m.name = name; }
    let n = m;
    const photo = (set, opts, key, head, color) => { const t = triplanar(set, opts); n = strip(m.clone()); extend(n, key, {uniforms: t.uniforms, head: t.head + (head || ''), color: t.color + (color || ''), normal: t.normal}); };
    if (tex && name === 'Limestone · warm honed blocks') {
      const t = triplanar(tex.wall, {tint: [1.12, .95, .84], normalStrength: 1.1, desat: .08}); n = strip(m.clone());
      Object.assign(t.uniforms, {tpColor2: {value: tex.bridge.color}, tpNormal2: {value: tex.bridge.normal}, tpArm2: {value: tex.bridge.arm}, tpScale2: {value: tex.bridge.scale}, tpTint2: {value: new THREE.Vector3(2.05, 2.1, 2.3)}});
      extend(n, 'lk-wall-bridge-photo', {uniforms: t.uniforms, head: t.head + WALL_HEAD + PATINA_HEAD, color: WALL_COLOR + STONE + PATINA, normal: WALL_NORMAL});
    }
    else if (tex && name === 'Limestone · carved edges') { const t = triplanar(tex.trim, {normalStrength: .24}); n = m.clone(); n.normalMap = null; extend(n, 'lk-trim-photo', {uniforms: t.uniforms, head: t.head + PATINA_HEAD + FOOTPRINT, color: STONE + PATINA + WEATHERED + t.color, normal: t.normal}); }
    else if (tex && name === 'Oak · smoked') { const t = triplanar(tex.oak, {tint: [.62, .6, .6], normalStrength: 1.2}); n = m.clone(); n.map = n.normalMap = n.roughnessMap = null; n.userData.lkPhoto = true; extend(n, 'lk-oak-photo', {uniforms: t.uniforms, head: t.head + OAK_HEAD, vertexHead: OAK_HEAD, vertex: OAK_VERTEX, color: OAK, normal: OAK_NORMAL}); }
    else if (tex && (name.startsWith('Final · hall limestone') || name.startsWith('Gallery · honed grey limestone'))) {
      // Each of the model's slab tones keeps its relative brightness; the stone itself comes from the photo.
      const hall = name.startsWith('Final'), k = (m.color.r * .3 + m.color.g * .55 + m.color.b * .15) / (hall ? .245 : .222);
      const tint = hall ? [.5 * k, .47 * k, .43 * k] : [.95 * k, .97 * k, 1.0 * k];
      photo(hall ? tex.hallFloor : tex.galleryFloor, {tint, normalStrength: hall ? .5 : .6, desat: hall ? .45 : 0}, hall ? 'lk-hall-floor-photo' : 'lk-gallery-floor-photo', '', '');
    }
    else if (tex && name === 'P2 · weathered limestone') photo(tex.wall, {tint: [.8, .78, .72]}, 'lk-wall-photo-dark', PATINA_HEAD, STONE);
    else if (tex && name === 'Slate · blue grey') photo(tex.roof, {tint: [.3, .35, .44], normalStrength: 1.2, sides: 1, desat: .65}, 'lk-roof-photo', '', SLATE);
    else if (tex && name === 'Silhouette · fractured limestone') photo(tex.rock, {tint: [.92, .9, .86], normalStrength: 1.3, desat: .72}, 'lk-rock-photo', '', ROCK_PHOTO);
    else if (tex && name.startsWith('P2 · warm sandstone paving')) { const t = triplanar(tex.paving, {tint: [.8, .74, .67], normalStrength: 1.15, desat: .2}); n = strip(m.clone()); extend(n, 'lk-cobble-photo', {uniforms: t.uniforms, head: t.head, color: COBBLE_COLOR, normal: t.normal}); }
    // The lake reflection sees the slopes from below the water: light the back faces with the upper normal, so the
    // hills mirror green instead of a pale band of underside shading.
    else if (tex && name === 'Lake · meadow and weathered shore') { const t = triplanar(tex.grass, {normalStrength: .8, detail: true, aoOnly: true}); n = m.clone(); n.normalMap = null; extend(n, 'lk-meadow-photo', {uniforms: t.uniforms, head: t.head, color: t.color + MEADOW, normal: t.normal.replace('*faceDirection', '')}); }
    else if (tex && name === 'P2 · garden earth') { const t = triplanar({...tex.grass, scale: 6}, {normalStrength: .8, detail: true, aoOnly: true}); n = m.clone(); n.color.setRGB(.075, .11, .035); n.normalMap = null; extend(n, 'lk-earth-grass', {uniforms: t.uniforms, head: t.head, color: t.color + MEADOW, normal: t.normal}); }
    else if (tex && name === 'P2 · mountain meadow') { const t = triplanar({...tex.grass, scale: 6}, {normalStrength: .8, detail: true, aoOnly: true}); n = m.clone(); n.normalMap = null; extend(n, 'lk-lawn-photo', {uniforms: t.uniforms, head: t.head, color: t.color + MEADOW, normal: t.normal}); }
    else if (name === 'Limestone · warm honed blocks' || name === 'Limestone · carved edges') { n = m.clone(); extend(n, 'lk-stone', {head: PATINA_HEAD, color: STONE + PATINA}); }
    else if (name === 'P2 · textured bark') { n = m.clone(); extend(n, 'lk-bark', {color: BARK}); }
    else if (name.startsWith('Brass · ')) { n = m.clone(); extend(n, 'lk-brass', {color: BRASS}); }
    else if (name === 'Basalt · satin floor') { n = m.clone(); extend(n, 'lk-floor', {color: FLOOR}); }
    else if (name === 'P2 · lime plaster vault') { n = m.clone(); n.side = THREE.DoubleSide; extend(n, 'lk-vault', {uniforms, head: 'uniform float lkStarGlow;', color: VAULT, emissive: VAULT_EMISSIVE}); }
    else if (name === 'Midnight blue · woven banners') { n = m.clone(); extend(n, 'lk-leaded', {uniforms, head: 'uniform float lkInterior;uniform vec3 lkWinGlow;', color: LEADED, emissive: LEADED_EMISSIVE}); }
    else if (name === 'P2 · patinated bronze') { n = m.clone(); n.color.setRGB(.028, .026, .024); n.metalness = .55; n.roughness = .48; n.name = 'Iron · forged dark'; }
    else if (name === 'Lake · meadow and weathered shore' || name === 'P2 · mountain meadow') { n = m.clone(); extend(n, 'lk-meadow', {color: MEADOW}); }
    else if (name.startsWith('Final · hall limestone')) { n = m.clone(); extend(n, 'lk-hall-floor', {color: HALL_FLOOR}); }
    else if (name.startsWith('P2 · leaf') || name.startsWith('Silhouette · ivy leaf')) { n = m.clone(); extend(n, 'lk-leaf', {uniforms, color: LEAF,
      vertex: 'vec3 lkW=(modelMatrix*vec4(transformed,1.)).xyz;transformed+=vec3(.045,.02,.035)*sin(lkTime*1.6+dot(lkW.xz,vec2(.45,.31))+lkW.y*.8)*smoothstep(.5,3.,lkW.y+19.)*(1.+.6*sin(lkTime*.37+lkW.x*.05));'}); }
    else if (name === 'Silhouette · fractured limestone') { n = m.clone(); extend(n, 'lk-rock', {color: ROCK}); }
    else if (name === 'Slate · blue grey') { n = m.clone(); extend(n, 'lk-slate', {color: SLATE}); }
    else if (name.startsWith('P2 · warm sandstone paving')) { n = m.clone(); extend(n, 'lk-paving', {color: PAVING}); }
    // The forecourt stones are laid radially in the model itself: only colour drift, no extra joints.
    // The four slab tones of the model differ by only 3 %; spread them so the flags read as separate stones.
    else if (tex && name.startsWith('Final · radial paving')) { const t = triplanar(tex.forecourt, {tint: [.8, .7, .6], normalStrength: .9}); n = m.clone(); n.color.multiplyScalar([.86, 1.07, .94, 1.13][+name.slice(-1)] || 1); extend(n, 'lk-radial-photo', {uniforms: t.uniforms, head: t.head, color: FORECOURT, normal: t.normal}); }
    else if (name.startsWith('Final · radial paving')) { n = m.clone(); extend(n, 'lk-radial', {color: PAVING_TONE}); }
    if (n !== m) n.name = n.name || name;
    done.set(source, n);
    return n;
  };
  castle.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(upgrade) : upgrade(o.material); });
  // Draco-quantised normals drew faint contour rings across the meadows: recompute them from the terrain itself.
  castle.traverse(o => { if (o.isMesh && o.geometry.index && [o.material].flat()[0]?.name === 'Lake · meadow and weathered shore') o.geometry.computeVertexNormals(); });
  // The rock reads as weathered stone with smooth normals; flat facets made it look low-poly.
  castle.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material) || o.material.name !== 'Silhouette · fractured limestone') return;
    const g = o.geometry.clone(); g.deleteAttribute('normal'); const merged = mergeVertices(g, 1e-3); merged.computeVertexNormals();
    o.geometry.dispose(); o.geometry = merged;
  });
  castle.traverse(o => {
    // Only the cloth banners: the leaded window panes share the word 'banners' in their material name and must stay glass.
    if (!o.isMesh || Array.isArray(o.material) || !o.name.startsWith('15_ARCHITECTURAL_REFINEMENT') || !o.material.name.startsWith('Cloth ·')) return;
    bannerCoordinates(o.geometry);
    const m = o.material.clone(); m.side = THREE.DoubleSide;
    extend(m, 'lk-banner', {head: BANNER_HEAD, color: BANNER, vertex: 'vBan=bannerUv;vBanSize=bannerSize;', vertexHead: 'attribute vec2 bannerUv;attribute vec2 bannerSize;' + BANNER_HEAD});
    o.material = m;
  });
  return {
    set({interior, windowGlow, starGlow}) {
      if (interior !== undefined) uniforms.lkInterior.value = interior ? 1 : 0;
      if (windowGlow) uniforms.lkWinGlow.value.copy(windowGlow);
      if (starGlow !== undefined) uniforms.lkStarGlow.value = starGlow;
    },
    tick(seconds) { sharedTime.value = seconds; }
  };
}

// ---------------------------------------------------------------- sky layer
// Sky, clouds and distant ranges follow the camera like a skybox and are drawn before the scene, so they always sit behind it.
const SKY_VERT = `varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
const SKY_FRAG = `
uniform vec3 zenith;uniform vec3 horizon;uniform vec3 haze;uniform vec3 ground;uniform vec3 sunDir;uniform vec3 sunColor;uniform float glow;varying vec3 vDir;
void main(){
 vec3 d=normalize(vDir);float h=d.y;
 vec3 col=mix(horizon,zenith,pow(clamp(h,0.,1.),.5));
 col=mix(col,haze,exp(-max(h,0.)*9.)*.85);
 col=mix(col,ground,smoothstep(0.,-.12,h));
 float s=max(dot(d,sunDir),0.);
 col+=sunColor*(pow(s,6.)*.18*glow+pow(s,48.)*.55*glow+smoothstep(.99955,.99975,s)*18.);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const CLOUD_FRAG = `
uniform float time;uniform vec3 sunDir;uniform vec3 lit;uniform vec3 shade;uniform float cover;uniform float opacity;varying vec3 vDir;
${NOISE}
void main(){
 vec3 d=normalize(vDir);if(d.y<.015)discard;
 vec2 p=d.xz/(d.y+.06)*1.15+vec2(time*.004,time*.0016);
 float n=lkFbm(vec3(p*1.25,time*.002));
 float n2=lkFbm(vec3(p*3.3+7.,1.3));
 float c=smoothstep(cover,cover+.24,n*.8+n2*.28);
 if(c<.004)discard;
 float sun=pow(max(dot(d,sunDir),0.),6.);
 float thick=smoothstep(cover+.05,cover+.5,n);
 vec3 col=mix(lit,shade,thick*.75)+lit*sun*.6;
 float fade=smoothstep(.015,.2,d.y);
 gl_FragColor=vec4(col,c*fade*opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const RANGE_VERT = `varying vec3 vN;varying float vH;varying vec3 vW;attribute float height;
void main(){vN=normalize(normal);vH=height;vW=(modelMatrix*vec4(position,1.)).xyz;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=vec4(p.xy,p.w*.999995,p.w);}`;
const RANGE_FRAG = `
uniform vec3 sunDir;uniform vec3 sunColor;uniform vec3 rock;uniform vec3 haze;uniform float hazeAmount;uniform vec3 snowTint;uniform vec3 skyTint;
uniform sampler2D rockMap;uniform sampler2D snowMap;uniform float photo;varying vec3 vN;varying float vH;varying vec3 vW;
void main(){
 vec3 n=normalize(vN);
 float diff=max(dot(n,sunDir),0.);
 float rockDetail=mix(1.,clamp(dot(texture2D(rockMap,vW.xz/90.).rgb,vec3(.3,.55,.15))/.12,.3,2.),photo);
 float snowDetail=mix(1.,clamp(dot(texture2D(snowMap,vW.xz/140.).rgb,vec3(.3,.55,.15))/.257,.6,1.4),photo);
 float snow=smoothstep(.5,.6,vH-(1.-n.y)*.25+(rockDetail-1.)*.06*photo);
 vec3 base=mix(rock*rockDetail,snowTint*snowDetail,snow);
 vec3 col=base*(skyTint*.55+diff*sunColor*1.1);
 float h=clamp(hazeAmount+(1.-vH)*.35,0.,1.);
 col=mix(col,haze,h);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

function rangeGeometry(radius, depth, peak, seed, rows = 26, cols = 900) {
  const noise = new ImprovedNoise(), pos = [], hgt = [], idx = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows, rad = radius + depth * t;
    for (let c = 0; c <= cols; c++) {
      const a = c / cols * Math.PI * 2, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      let h = 0, amp = 1, f = 1;
      for (let o = 0; o < 5; o++) { const n = 1 - Math.abs(noise.noise(Math.cos(a) * 2.2 * f + seed, Math.sin(a) * 2.2 * f - seed, t * 1.6 * f + seed * .3)); h += n * n * amp; amp *= .42; f *= 2.3; }
      h /= 1.7;
      // Rises from the near foot towards the crest and falls again behind it.
      const profile = Math.sin(Math.min(1, t * 1.25) * Math.PI) ** .8;
      const massif = .55 + .45 * noise.noise(Math.cos(a) * .9 + seed * 2, Math.sin(a) * .9, seed);
      const y = profile * h * peak * (.45 + .8 * massif);
      pos.push(x, y - 30, z); hgt.push(Math.min(1, y / peak));
    }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = r * (cols + 1) + c, b = a + cols + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('height', new THREE.Float32BufferAttribute(hgt, 1));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// Two times of day. Colours are sRGB hex; THREE.Color converts them to the linear working space.
export const SKY_MODES = {
  day: {
    sun: new THREE.Vector3(.5, .5, .7).normalize(), sunColor: '#ffe4bd', sunIntensity: 3.5,
    zenith: '#2c64a8', horizon: '#9fbfdc', haze: '#dfe3df', ground: '#4a5046', glow: 1,
    fog: '#b4c6d2', fogDensity: .00075, hemiSky: '#9ec0e4', hemiGround: '#50493a', hemi: .55, env: .7, exposure: 1,
    cloudLit: '#fffaf0', cloudShade: '#a9b7c8', cloudCover: .5, cloudOpacity: .95,
    rock: '#6a7584', far: '#56645e', rangeHaze: '#b7c9d8', hazeNear: .12, snow: '#f4f6f8', rangeSky: '#9ec0e4', rangeSun: '#fff0dc',
    water: '#123341', waterSun: '#ffe2b8', envGround: '#3c4336'
  },
  dusk: {
    // A summer evening: the sun sets in the north-west, low over the ranges to the left of the bridge view.
    sun: new THREE.Vector3(-.66, .045, -.75).normalize(), sunColor: '#ff9a52', sunIntensity: 2.6,
    zenith: '#232b55', horizon: '#e8906a', haze: '#f3b27c', ground: '#2c2630', glow: 1.6,
    fog: '#9c8290', fogDensity: .0009, hemiSky: '#9a92c0', hemiGround: '#6a4a3a', hemi: .95, env: .85, exposure: 1.18,
    cloudLit: '#ffb07a', cloudShade: '#58496a', cloudCover: .52, cloudOpacity: .95,
    rock: '#4a4660', far: '#3a3a4a', rangeHaze: '#c3928a', hazeNear: .2, snow: '#ffcfae', rangeSky: '#7a78a8', rangeSun: '#ffae78',
    water: '#1a2838', waterSun: '#ffa868', envGround: '#2b2622'
  }
};

export function createAtmosphere({scene, renderer}) {
  const group = new THREE.Group(); group.name = 'Atmosphere · sky layer'; scene.add(group);
  const sunDir = new THREE.Vector3(), sunColor = new THREE.Color();
  const skyUniforms = {zenith: {value: new THREE.Color()}, horizon: {value: new THREE.Color()}, haze: {value: new THREE.Color()}, ground: {value: new THREE.Color()}, sunDir: {value: sunDir}, sunColor: {value: sunColor}, glow: {value: 1}};
  const skyMat = new THREE.ShaderMaterial({vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false});
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 48, 24), skyMat); sky.renderOrder = -10; sky.frustumCulled = false; sky.name = 'Atmosphere · sky';
  // Clouds sit exactly on the far plane: anything drawn earlier (ranges, castle, terrain) hides them.
  const cloudMat = new THREE.ShaderMaterial({vertexShader: SKY_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth, side: THREE.BackSide,
    uniforms: {time: {value: 0}, sunDir: {value: sunDir}, lit: {value: new THREE.Color()}, shade: {value: new THREE.Color()}, cover: {value: .5}, opacity: {value: .95}}});
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), cloudMat); clouds.renderOrder = -9; clouds.frustumCulled = false;
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); blank.needsUpdate = true;
  const rangeUniforms = () => ({rockMap: {value: blank}, snowMap: {value: blank}, photo: {value: 0}, sunDir: {value: sunDir}, sunColor: {value: new THREE.Color()}, rock: {value: new THREE.Color()}, haze: {value: new THREE.Color()}, hazeAmount: {value: .3}, snowTint: {value: new THREE.Color()}, skyTint: {value: new THREE.Color()}});
  // Ranges write depth just in front of the far plane (always, before the scene): far range, then near range, then the scene overdraw in order.
  const ranges = [
    new THREE.Mesh(rangeGeometry(1150, 280, 300, 3.7, 34, 1400), new THREE.ShaderMaterial({vertexShader: RANGE_VERT, fragmentShader: RANGE_FRAG, uniforms: rangeUniforms(), depthFunc: THREE.AlwaysDepth, depthWrite: true})),
    new THREE.Mesh(rangeGeometry(880, 200, 150, 11.3, 26, 1100), new THREE.ShaderMaterial({vertexShader: RANGE_VERT, fragmentShader: RANGE_FRAG, uniforms: rangeUniforms(), depthFunc: THREE.AlwaysDepth, depthWrite: true}))
  ];
  ranges[0].renderOrder = -8; ranges[1].renderOrder = -7;
  for (const m of ranges) m.frustumCulled = false;
  group.add(sky, clouds, ...ranges);

  // Environment light from the same sky (plus a dim ground) so reflections and ambient share the scene's colours.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(sky.geometry, skyMat));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(300, 32), new THREE.MeshBasicMaterial({color: '#3b4034'})); ground.rotation.x = -Math.PI / 2; ground.position.y = -8; envScene.add(ground);
  let envTarget = null;

  let t = 0;
  const atmosphere = {
    group, sunDir, sunColor, environment: null,
    setMode(name) {
      const m = SKY_MODES[name];
      sunDir.copy(m.sun); sunColor.set(m.sunColor);
      skyUniforms.zenith.value.set(m.zenith); skyUniforms.horizon.value.set(m.horizon); skyUniforms.haze.value.set(m.haze); skyUniforms.ground.value.set(m.ground); skyUniforms.glow.value = m.glow;
      cloudMat.uniforms.lit.value.set(m.cloudLit); cloudMat.uniforms.shade.value.set(m.cloudShade); cloudMat.uniforms.cover.value = m.cloudCover; cloudMat.uniforms.opacity.value = m.cloudOpacity;
      for (const [i, r] of ranges.entries()) {
        const u = r.material.uniforms;
        u.rock.value.set(i ? m.far : m.rock); u.haze.value.set(m.rangeHaze); u.snowTint.value.set(m.snow); u.skyTint.value.set(m.rangeSky); u.sunColor.value.set(m.rangeSun);
        u.hazeAmount.value = i ? m.hazeNear : m.hazeNear + .16;
      }
      ground.material.color.set(m.envGround);
      envTarget?.dispose(); envTarget = pmrem.fromScene(envScene, 0, .1, 2000); atmosphere.environment = envTarget.texture;
      return m;
    },
    setTextures(tex) {
      if (!tex?.mountain?.color || !tex?.snow?.color) return;
      for (const r of ranges) { const u = r.material.uniforms; u.rockMap.value = tex.mountain.color; u.snowMap.value = tex.snow.color; u.photo.value = 1; }
    },
    update(dt, camera, reduced) {
      if (!reduced) t += dt;
      cloudMat.uniforms.time.value = t;
      group.position.set(camera.position.x, -18.8, camera.position.z);
    }
  };
  return atmosphere;
}

// Reflections inside the castle: a dim warm stone room under a blue vault, lit by a few lamps and a window,
// instead of a bright photographic studio. Rendered once into a PMREM.
export function createInteriorEnvironment(renderer) {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.ShaderMaterial({side: THREE.BackSide,
    vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 vP;void main(){float h=clamp(vP.y/6.*.5+.5,0.,1.);vec3 floorC=vec3(.035,.03,.026),wall=vec3(.16,.13,.1),vault=vec3(.012,.02,.055);vec3 c=mix(floorC,wall,smoothstep(.02,.2,h));c=mix(c,vault,smoothstep(.72,.9,h));gl_FragColor=vec4(c,1.);}'}));
  scene.add(room);
  const lamp = (x, y, z, w, h, color, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide})); m.position.set(x, y, z); m.lookAt(0, 1, 0); scene.add(m); };
  lamp(-11.8, 2, -4, 1.4, 3.2, '#bcd4f0', 2.2);   // a tall window
  lamp(11.8, 3, 5, .6, .8, '#ffc27a', 6);         // wall sconces
  lamp(11.8, 3, -5, .6, .8, '#ffc27a', 6);
  lamp(0, 5.9, 0, 3, 3, '#ffd6a0', 1.6);           // chandelier glow
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(scene, 0, .1, 50).texture;
  pmrem.dispose();
  return texture;
}
