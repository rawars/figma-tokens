import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
class Surface {
 listeners = new Map();
 addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
 emit(type, event = {}) { for (const fn of this.listeners.get(type) || []) fn(event); }
}
class Element extends Surface {
 children = []; dataset = {}; style = {}; className = ''; value = ''; classList = { toggle() {} }; captured = new Set();
 append(child) { child.parent = this; this.children.push(child); }
 remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
 setAttribute() {}
 setPointerCapture(id) { this.captured.add(id); }
 hasPointerCapture(id) { return this.captured.has(id); }
 releasePointerCapture(id) { this.captured.delete(id); this.emit('lostpointercapture'); }
 querySelector(selector) {
  const match = node => selector === 'button' ? node.tag === 'button' : selector === '.empty' ? node.className === 'empty' : /data-field/.test(selector) ? node.dataset.field === selector.match(/"(.*?)"/)[1] : /data-mode/.test(selector) ? node.dataset.mode === selector.match(/"(.*?)"/)[1] : false;
  for (const child of this.children) { if (match(child)) return child; const nested = child.querySelector(selector); if (nested) return nested; }
  return null;
 }
}
const elements = new Map(['status','category','day','night','add','rows','resize','copy','search','restore','close-export','copy-fallback','export-text'].map(id => [id,new Element()]));
elements.get('category').value = 'colors';
const document = new Surface();document.getElementById = id => elements.get(id);document.createElement = tag => Object.assign(new Element(), { tag });document.activeElement = null;document.querySelector = () => new Element();
const window = new Surface();window.innerWidth = 340;window.innerHeight = 340;
const messages = [];
const copied=[];const navigator={clipboard:{writeText:async text=>copied.push(text)}};
vm.runInNewContext(readFileSync('src/ui.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1], { document, window, navigator, parent: { postMessage: message => messages.push(message.pluginMessage) } });
const token = { id: 'v', kind: 'colors', name: 'bg', day: '#ffffff', night: '#000000' };
const update = row => window.onmessage({ data: { pluginMessage: { type: 'state', theme: 'day', rows: [row] } } });
update(token);
const row = elements.get('rows').children[0];
const night = row.querySelector('[data-field="night"]');
document.activeElement = night;night.value = '#12';
update({ ...token, day: '#eeeeee', night: '#333333' });
assert.equal(elements.get('rows').children[0], row);
assert.equal(row.querySelector('[data-field="night"]'), night);
assert.equal(document.activeElement, night);assert.equal(night.value, '#12');
assert.equal(row.querySelector('[data-field="day"]').value, '#eeeeee');
const grip = elements.get('resize');
const down = () => grip.onpointerdown({ button: 0, pointerId: 1, screenX: 340, screenY: 340, preventDefault() {} });
const move = buttons => grip.onpointermove({ pointerId: 1, screenX: 400, screenY: 410, buttons });
for (const end of ['blur','pointerup','pointercancel','lostpointercapture','buttons']) {
 down();move(1);
 if (end === 'buttons') move(0);else if (end === 'lostpointercapture') grip.emit(end);else window.emit(end);
 const count = messages.length;move(1);
 assert.equal(messages.length, count, end + ' must stop resizing');
 assert.equal(messages.at(-1).persist, true);
 assert.equal(grip.hasPointerCapture(1), false);
}
console.log('Passed: input identity/focus/drafts preserved; resize stops on release, blur, cancellation, lost capture and released buttons.');

window.onmessage({data:{pluginMessage:{type:'export',text:'{"tokens":[]}'}}});
await new Promise(resolve=>setTimeout(resolve,0));assert.equal(copied[0],'{"tokens":[]}');
assert.equal(elements.get('status').textContent,'Todos los tokens copiados.');
navigator.clipboard.writeText=async()=>{throw Error('Clipboard blocked');};
const textarea=elements.get('export-text');textarea.focus=()=>document.activeElement=textarea;textarea.select=()=>{};document.execCommand=()=>false;
window.onmessage({data:{pluginMessage:{type:'export',text:'{"fallback":true}'}}});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(elements.get('copy-fallback').hidden,false);assert.equal(textarea.value,'{"fallback":true}');
console.log('Passed: global clipboard copy and manual fallback when permissions block copying.');
