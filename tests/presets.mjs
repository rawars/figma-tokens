import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync('dist/code.js', 'utf8');
const original = { variableId:'custom',name:'bg',kind:'colors',day:{r:.2,g:.3,b:.4},night:{r:0,g:0,b:0} };
const data = { 'figma-theme-tokens-v3': JSON.stringify([original]) };
const collection = { id:'c', defaultModeId:'m' };
const variables = new Map(), styles = new Map();
let serial = 0;
function variable(id,name,type) { return {id,name,resolvedType:type,variableCollectionId:'c',setValueForMode(mode,value){this.value=value;},remove(){variables.delete(id);}}; }
variables.set('custom',variable('custom','bg','COLOR'));
const messages=[];
const figma={command:'setup',root:{getPluginData:k=>data[k]||'',setPluginData:(k,v)=>data[k]=v},variables:{getVariableByIdAsync:async id=>variables.get(id),getVariableCollectionByIdAsync:async()=>collection,createVariableCollection:()=>collection,createVariable(name,c,type){const v=variable('v'+serial++,name,type);variables.set(v.id,v);return v;}},getStyleByIdAsync:async id=>styles.get(id),createEffectStyle(){const id='s'+serial++;const style={id,type:'EFFECT',name:'',effects:[],remove(){styles.delete(id);}};styles.set(id,style);return style;},ui:{postMessage:m=>messages.push(m)},showUI(){},commitUndo(){},closePlugin(msg){throw Error(msg);}};
const tick=()=>new Promise(r=>setTimeout(r,0));
async function open(){vm.runInNewContext(code,{figma,__html__:'',console:{error(){}}});await tick();}
const tokens=()=>JSON.parse(data['figma-theme-tokens-v3']);
const send=async msg=>{figma.ui.onmessage(msg);await tick();};
await open();
assert.equal(tokens().length,76); // 75 official/adapted presets + original user token.
assert.equal(tokens().find(t=>t.variableId==='custom').day.r,.2);
assert(!tokens().some(t=>t.kind==='colors'&&t.name.startsWith('tailwind/')));
for (const t of tokens().filter(t=>t.presetId&&t.kind==='colors')) {
 for(const mode of ['day','night']) { assert.equal(t[mode].r,t[mode].g);assert.equal(t[mode].g,t[mode].b); }
}
const counts={};for(const t of tokens())if(t.presetId)counts[t.kind]=(counts[t.kind]||0)+1;
assert.deepEqual(counts,{fontSize:13,fontWeight:9,letterSpacing:6,borderRadius:8,shadow:8,colors:31});
const size=tokens().find(t=>t.presetId==='shadcn/text-base');
assert.equal(size.day,16);
await send({type:'value',id:size.variableId,mode:'day',value:'22'});
await send({type:'restore',kind:'fontSize'});
assert.equal(tokens().find(t=>t.presetId===size.presetId).variableId,size.variableId);
assert.equal(variables.get(size.variableId).value,16);
assert.equal(tokens().find(t=>t.variableId==='custom').day.r,.2);
const shadow=tokens().find(t=>t.presetId==='shadcn/shadow-sm');
assert.equal(styles.get(shadow.variableId).effects.length,2);
assert.equal(styles.get(shadow.variableId).effects[0].radius,3);
await send({type:'value',id:shadow.variableId,mode:'night',value:'0 4px 8px 0 #00000080'});
await send({type:'theme',theme:'night'});
assert.equal(styles.get(shadow.variableId).effects[0].radius,8);
await send({type:'restore',kind:'shadow'});
assert.equal(tokens().find(t=>t.presetId===shadow.presetId).variableId,shadow.variableId);
assert.equal(styles.get(shadow.variableId).effects.length,2);
const deleted=tokens().find(t=>t.presetId==='shadcn/shadow-xs');
await send({type:'delete',id:deleted.variableId});await open();
assert(!tokens().some(t=>t.presetId===deleted.presetId));
await send({type:'restore',kind:'shadow'});
assert.equal(tokens().filter(t=>t.presetId===deleted.presetId).length,1);
await send({type:'restore',kind:'shadow'});assert.equal(tokens().length,76);
await send({type:'export'});
const exported=JSON.parse(messages.findLast(m=>m.type==='export').text);
assert.equal(exported.tokens.length,76);assert.equal(exported.activeTheme,'night');
assert(exported.tokens.some(t=>t.category==='shadow'));
assert.equal(exported.tokens.find(t=>t.preset==='border').night,'#ffffff1a');
assert.equal(exported.tokens.find(t=>t.name==='bg').day,'#334d66');
assert.equal(messages.filter(m=>m.type==='error').length,0);
console.log('Passed: 75 presets, custom-token preservation, stable IDs, shadow styles/themes, per-section restore, persistent deletion, alpha and full export.');

// Migrate old prefixed catalogs while preserving user edits and bound resource IDs.
const oldWeight=variable('old-weight','tailwind/font-medium','FLOAT');variables.set(oldWeight.id,oldWeight);
const oldRadius=variable('old-radius','tailwind/rounded-sm','FLOAT');variables.set(oldRadius.id,oldRadius);
data['figma-theme-tokens-v3']=JSON.stringify([original,{variableId:oldWeight.id,name:'tailwind/font-medium',kind:'fontWeight',day:500,night:600,presetId:'tailwind/font-medium'},{variableId:oldRadius.id,name:'tailwind/rounded-sm',kind:'borderRadius',day:4,night:4,presetId:'tailwind/rounded-sm'}]);
delete data['figma-theme-unified-presets-v1'];
await open();
assert.equal(tokens().find(t=>t.variableId==='old-weight').name,'font-medium');
assert.equal(tokens().find(t=>t.variableId==='old-weight').night,600);
assert.equal(tokens().find(t=>t.variableId==='old-weight').presetId,'shadcn/font-medium');
assert(!tokens().some(t=>t.variableId==='old-radius'));assert(variables.has('old-radius'));
assert.equal(oldRadius.name,'rounded-sm');assert.equal(tokens().find(t=>t.variableId==='custom').name,'bg');
console.log('Passed: prefix migration preserves identifiers/custom edits; retired radius variables remain bound safely.');
