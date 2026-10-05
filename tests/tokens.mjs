import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync('dist/code.js', 'utf8');
const html = readFileSync('src/ui.html', 'utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
const data = { 'figma-theme-presets-v2': 'seeded', 'figma-theme-colors-v2': JSON.stringify([{ variableId: 'original', name: 'bg', day: { r: 1, g: 1, b: 1 }, night: { r: 0, g: 0, b: 0 } }]) };
const collection = { id: 'collection', defaultModeId: 'mode' };
const variables = new Map();
function variable(id, name, type) { return { id, name, resolvedType: type, variableCollectionId: collection.id, setValueForMode(mode, value) { this.value = value; }, remove() { variables.delete(id); } }; }
variables.set('original', variable('original', 'bg', 'COLOR'));
const messages = [];
const figma = {
 command: 'setup', root: { getPluginData: key => data[key] || '', setPluginData: (key, value) => data[key] = value },
 variables: { getVariableByIdAsync: async id => variables.get(id), getVariableCollectionByIdAsync: async () => collection, createVariableCollection: () => collection, createVariable(name, col, type) { const v = variable('v' + variables.size, name, type); variables.set(v.id, v); return v; } },
 ui: { resize(width, height) { this.size = { width, height }; }, postMessage: msg => messages.push(msg) }, showUI() {}, commitUndo() {}, closePlugin(message) { throw Error(message); },
 getNodeByIdAsync() { throw Error('Must not depend on canvas nodes'); },
};
vm.runInNewContext(code, { figma, __html__: '', console: { error() {} } });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
await tick();
assert.equal(JSON.parse(data['figma-theme-tokens-v3'])[0].variableId, 'original');
const send = async msg => { figma.ui.onmessage(msg); await tick(); };
const expected = { fontSize: 'FONT_SIZE', fontWeight: 'FONT_WEIGHT', letterSpacing: 'LETTER_SPACING', borderRadius: 'CORNER_RADIUS' };
for (const [kind, scope] of Object.entries(expected)) {
 await send({ type: 'add', kind });
 const token = JSON.parse(data['figma-theme-tokens-v3']).at(-1);
 const v = variables.get(token.variableId);
 assert.equal(v.resolvedType, 'FLOAT'); assert.equal(v.scopes[0], scope);
 const value = kind === 'fontWeight' ? '600' : kind === 'letterSpacing' ? '-0.5' : '24';
 await send({ type: 'value', id: v.id, mode: 'night', value });
 await send({ type: 'theme', theme: 'night' });
 assert.equal(v.value, Number(value));
 await send({ type: 'rename', id: v.id, name: kind + '/custom' });
 assert.equal(v.name, kind + '/custom');
}
const size = JSON.parse(data['figma-theme-tokens-v3']).find(t => t.kind === 'fontSize');
await send({ type: 'value', id: size.variableId, mode: 'day', value: '-1' });
assert.equal(JSON.parse(data['figma-theme-tokens-v3']).find(t => t.variableId === size.variableId).day, 16);
assert(messages.some(m => m.type === 'error'));
await send({ type: 'theme', theme: 'day' });
assert.equal(variables.get(size.variableId).value, 16);
await send({ type: 'delete', id: size.variableId });
assert(!variables.has(size.variableId));
assert(!JSON.parse(data['figma-theme-tokens-v3']).some(t => t.variableId === size.variableId));
assert(variables.has('original'));
console.log('Passed: color migration, numeric types/scopes, day/night, rename, invalid input and deletion; no canvas dependency.');

await send({ type: 'resize', width: 500, height: 600, persist: true });
assert.equal(figma.ui.size.width, 500); assert.equal(figma.ui.size.height, 600);
assert.equal(JSON.parse(data['figma-theme-panel-size']).width, 500);
await send({ type: 'resize', width: 0, height: 99999 });
assert.equal(figma.ui.size.width, 340); assert.equal(figma.ui.size.height, 1000);
console.log('Passed: panel resizing, persistence and size limits.');
