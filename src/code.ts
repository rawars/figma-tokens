import { presets } from "./presets";
type Theme = "day" | "night";
type Kind = "colors" | "fontSize" | "fontWeight" | "letterSpacing" | "borderRadius" | "shadow";
type Token = { variableId: string; name: string; kind: Kind; day: RGB | number | string; night: RGB | number | string; presetId?: string };
const kinds: Kind[] = ["colors", "fontSize", "fontWeight", "letterSpacing", "borderRadius", "shadow"];
const scopes: Record<Kind, VariableScope[]> = { colors: ["ALL_SCOPES"], fontSize: ["FONT_SIZE"], fontWeight: ["FONT_WEIGHT"], letterSpacing: ["LETTER_SPACING"], borderRadius: ["CORNER_RADIUS"], shadow: [] };
const defaults: Record<Kind, number> = { colors: 0, fontSize: 16, fontWeight: 400, letterSpacing: 0, borderRadius: 8, shadow: 0 };
function parseValue(kind: Kind, input: string): RGB | number | string {
  if (kind === "shadow") { shadowEffects(input); return input.trim(); }
  if (kind === "colors") return parseHex(input);
  if (!input.trim()) throw new Error("Introduce un valor numérico.");
  const value = Number(input);
  if (!Number.isFinite(value)) throw new Error("Introduce un número válido.");
  if (kind === "fontSize" && value <= 0) throw new Error("Font size debe ser mayor que cero.");
  if (kind === "borderRadius" && value < 0) throw new Error("Border radius no puede ser negativo.");
  if (kind === "fontWeight" && (value < 1 || value > 1000)) throw new Error("Font weight debe estar entre 1 y 1000.");
  return value;
}
function serializeValue(value: RGB | number | string) { return typeof value === "object" ? hex(value) : String(value); }
type LegacyToken = { variableId: string; labelId: string; dayId: string; nightId: string };
const storageKey = "figma-theme-tokens-v3";
const white: RGB = { r: 1, g: 1, b: 1 };
const dark: RGB = { r: .06, g: .06, b: .08 };
function hex(color: RGB) {
  return "#" + [color.r, color.g, color.b].map(value => Math.round(value * 255).toString(16).padStart(2, "0")).join("") + ("a" in color && typeof color.a === "number" && color.a < 1 ? Math.round(color.a * 255).toString(16).padStart(2, "0") : "");
}
function parseHex(value: string): RGB {
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) throw new Error("Usa un hexadecimal de seis dígitos, u ocho para incluir opacidad.");
  return { r: parseInt(value.slice(1, 3), 16) / 255, g: parseInt(value.slice(3, 5), 16) / 255, b: parseInt(value.slice(5, 7), 16) / 255, ...(value.length === 9 ? { a: parseInt(value.slice(7, 9), 16) / 255 } : {}) };
}
function active(): Theme { return figma.root.getPluginData("figma-theme-active") === "night" ? "night" : "day"; }
function save(tokens: Token[]) { figma.root.setPluginData(storageKey, JSON.stringify(tokens)); }
function shadowEffects(value: string): Effect[] {
  if (value.trim() === "none") return [];
  if (!value.trim()) throw new Error("Introduce una sombra CSS o none.");
  return value.split(",").map(part => {
    const pieces = part.trim().split(/\s+/);
    const colorValue = pieces.pop() || "";
    const color = parseHex(colorValue);
    if (pieces.length < 2 || pieces.length > 4 || pieces.some(piece => !/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px)?$/.test(piece))) throw new Error("Sombra: X Y blur spread #RRGGBBAA. Separa capas con comas.");
    const [x, y, blur = 0, spread = 0] = pieces.map(piece => parseFloat(piece));
    if (blur < 0) throw new Error("El blur de la sombra no puede ser negativo.");
    return { type: "DROP_SHADOW", color: { ...color, a: "a" in color && typeof color.a === "number" ? color.a : 1 }, offset: { x, y }, radius: blur, spread, visible: true, blendMode: "NORMAL" };
  });
}
async function getResource(token: Token): Promise<Variable | EffectStyle | null> {
  if (token.kind !== "shadow") return figma.variables.getVariableByIdAsync(token.variableId);
  const style = await figma.getStyleByIdAsync(token.variableId);
  return style?.type === "EFFECT" ? style as EffectStyle : null;
}
async function writeResource(token: Token, resource: Variable | EffectStyle, theme: Theme) {
  resource.name = token.name;
  if ("effects" in resource) { resource.effects = shadowEffects(String(token[theme])); return; }
  const collection = await figma.variables.getVariableCollectionByIdAsync(resource.variableCollectionId);
  if (!collection) throw new Error(`Falta la colección de ${token.name}.`);
  resource.setValueForMode(collection.defaultModeId, token[theme] as RGB | number);
}
async function createToken(name: string, kind: Kind = "colors"): Promise<Token> {
  if (kind === "shadow") {
    const style = figma.createEffectStyle();
    style.name = name;
    const value = "0 1px 3px 0 #0000001a";
    style.effects = shadowEffects(value);
    return { variableId: style.id, name, kind, day: value, night: value };
  }
  const id = figma.root.getPluginData("figma-theme-collection");
  const existing = id ? await figma.variables.getVariableCollectionByIdAsync(id) : null;
  const collection = existing || figma.variables.createVariableCollection("figma-tokens");
  figma.root.setPluginData("figma-theme-collection", collection.id);
  const variable = figma.variables.createVariable(name, collection, kind === "colors" ? "COLOR" : "FLOAT");
  variable.scopes = scopes[kind];
  variable.setValueForMode(collection.defaultModeId, kind === "colors" ? (active() === "day" ? white : dark) : defaults[kind]);
  return { variableId: variable.id, name, kind, day: kind === "colors" ? { ...white } : defaults[kind], night: kind === "colors" ? { ...dark } : defaults[kind] };
}
async function legacyColor(id: string | undefined): Promise<RGB | null> {
  if (!id) return null;
  const node = await figma.getNodeByIdAsync(id);
  if (!node || !("fills" in node) || node.fills === figma.mixed || node.fills.length !== 1 || node.fills[0].type !== "SOLID") return null;
  return node.fills[0].color;
}
async function initialize(): Promise<Token[]> {
  const saved = figma.root.getPluginData(storageKey) || figma.root.getPluginData("figma-theme-colors-v2");
  if (saved) {
    const tokens = JSON.parse(saved) as Token[];
    for (const token of tokens) {
      token.kind ||= "colors";
      const variable = token.kind === "shadow" ? null : await figma.variables.getVariableByIdAsync(token.variableId);
      if (variable) variable.scopes = scopes[token.kind];
    }
    save(tokens);
    return tokens;
  }
  const legacy: LegacyToken[] = JSON.parse(figma.root.getPluginData("figma-theme-tokens") || "[]");
  if (!legacy.length) {
    const variableId = figma.root.getPluginData("figma-theme-variable");
    const samples: string[] = JSON.parse(figma.root.getPluginData("figma-theme-references") || "[]");
    if (variableId) legacy.push({ variableId, labelId: "", dayId: samples[0], nightId: samples[1] });
  }
  const tokens: Token[] = [];
  let recovered = false;
  for (const old of legacy) {
    const variable = await figma.variables.getVariableByIdAsync(old.variableId);
    if (!variable || variable.resolvedType !== "COLOR") continue;
    const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
    if (!collection) continue;
    variable.scopes = ["ALL_SCOPES"];
    figma.root.setPluginData("figma-theme-collection", collection.id);
    const label = old.labelId ? await figma.getNodeByIdAsync(old.labelId) : null;
    const day = await legacyColor(old.dayId);
    const night = await legacyColor(old.nightId);
    const current = variable.valuesByMode[collection.defaultModeId];
    const currentColor = current && typeof current === "object" && "r" in current ? { r: current.r, g: current.g, b: current.b } : null;
    recovered ||= !day || !night;
    tokens.push({ variableId: variable.id, kind: "colors", name: label?.type === "TEXT" && label.characters.trim() ? label.characters.trim() : variable.name, day: day || (active() === "day" ? currentColor : null) || { ...white }, night: night || (active() === "night" ? currentColor : null) || { ...dark } });
  }
  if (!tokens.length) tokens.push(await createToken("bg"));
  save(tokens);
  if (recovered) figma.notify("Colores recuperados: conservamos el valor activo; revisa el otro modo si sus muestras fueron eliminadas.");
  return tokens;
}
async function applyTheme(tokens: Token[], theme: Theme) {
  const updates: { token: Token; resource: Variable | EffectStyle }[] = [];
  const names = new Set<string>();
  for (const token of tokens) {
    const name = token.name.trim();
    if (!name || names.has(name) || name.split("/").some(part => !part.trim())) throw new Error("Usa nombres únicos y no vacíos.");
    names.add(name);
    parseValue(token.kind, serializeValue(token[theme]));
    const resource = await getResource(token);
    if (!resource) throw new Error(`El token ${name} fue eliminado de Figma. Deshaz esa eliminación o regenera sus defaults.`);
    if (token.kind !== "shadow") {
      const variable = resource as Variable;
      if (variable.resolvedType !== (token.kind === "colors" ? "COLOR" : "FLOAT")) throw new Error(`Tipo de variable incorrecto: ${name}.`);
      if (!await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId)) throw new Error(`Falta la colección de ${name}.`);
    }
    updates.push({ token, resource });
  }
  for (const update of updates) await writeResource(update.token, update.resource, theme);
  figma.root.setPluginData("figma-theme-active", theme);
  save(tokens);
}
async function restorePresets(tokens: Token[], kind?: Kind, reset = false) {
  for (const preset of presets.filter(item => !kind || item.kind === kind)) {
    let token = tokens.find(item => item.presetId === preset.id);
    if (token && !reset) continue;
    let name = preset.name;
    let suffix = 2;
    while (tokens.some(item => item !== token && item.name === name)) name = `${preset.name} ${suffix++}`;
    if (!token) {
      token = await createToken(name, preset.kind);
      token.presetId = preset.id;
      tokens.push(token);
    } else {
      const variable = await getResource(token);
      if (!variable) {
        const replacement = await createToken(name, preset.kind);
        token.variableId = replacement.variableId;
      }
    }
    token.name = name;
    token.day = parseValue(preset.kind, String(preset.day));
    token.night = parseValue(preset.kind, String(preset.night));
    const resource = await getResource(token);
    if (!resource) throw new Error(`No se pudo crear ${name}.`);
    await writeResource(token, resource, active());
    save(tokens);
  }
}
function exportTokens(tokens: Token[]) {
  return JSON.stringify({
    format: "figma-tokens", version: 1, activeTheme: active(),
    implementation: {
      themes: ["day", "night"], rootFontSizePx: 16,
      colors: "sRGB hexadecimal; #RRGGBBAA includes alpha",
      shadow: "CSS box-shadow strings: X Y blur spread #RRGGBBAA; comma-separated layers. Figma effect styles, not variables.",
      fontSize: "px", borderRadius: "px", fontWeight: "numeric weight, dependent on font support",
      letterSpacing: "px; Tailwind tracking presets convert em at a 16px font size. For other font sizes, convert the original em value proportionally.",
      presets: "Tailwind 4.3.3 typography/radius + monochromatic shadcn Neutral (chart/destructive chroma removed). Shadows use the Tailwind scale used by shadcn. shadcn radius presets are snapshots, not live aliases. Typography uses the Tailwind scales inherited by shadcn; names have no source prefix.",
      figmaThemeSwitching: "Changes the single variable mode value globally; does not use paid multi-mode collections.",
    },
    tokens: tokens.map(token => ({ name: token.name, category: token.kind, preset: token.presetId ? token.presetId.split("/").slice(1).join("/") : null, day: typeof token.day === "object" ? hex(token.day) : token.day, night: typeof token.night === "object" ? hex(token.night) : token.night })),
  }, null, 2);
}
async function unifyPresetNames(tokens: Token[]) {
  if (figma.root.getPluginData("figma-theme-unified-presets-v1")) return;
  // Retire the old, separate Tailwind radius catalog without deleting bound variables.
  for (let index = tokens.length - 1; index >= 0; index--) {
    const token = tokens[index];
    if (!token.presetId) continue;
    if (token.presetId.startsWith("tailwind/rounded-")) {
      const resource = await getResource(token);
      if (resource && resource.name === token.presetId) resource.name = token.name.split("/").slice(1).join("/");
      tokens.splice(index, 1);
      continue;
    }
    const previousId = token.presetId;
    if (previousId.startsWith("tailwind/")) token.presetId = previousId.replace("tailwind/", "shadcn/");
    if (token.name === previousId) {
      const desired = previousId.split("/").slice(1).join("/");
      let name = desired, suffix = 2;
      while (tokens.some(other => other !== token && other.name === name)) name = `${desired} ${suffix++}`;
      token.name = name;
      const resource = await getResource(token);
      if (resource) resource.name = name;
    }
  }
  save(tokens);
  figma.root.setPluginData("figma-theme-unified-presets-v1", "done");
}
async function run() {
  const tokens = await initialize();
  await unifyPresetNames(tokens);
  if (!figma.root.getPluginData("figma-theme-presets-v2")) {
    await restorePresets(tokens, figma.root.getPluginData("figma-theme-presets-v1") ? "shadow" : undefined);
    figma.root.setPluginData("figma-theme-presets-v2", "seeded");
  }
  const sendState = () => figma.ui.postMessage({ type: "state", theme: active(), rows: tokens.map(token => ({ id: token.variableId, name: token.name, kind: token.kind, day: serializeValue(token.day), night: serializeValue(token.night) })) });
  if (figma.command === "day" || figma.command === "night") {
    await applyTheme(tokens, figma.command);
    figma.closePlugin(`Modo ${figma.command === "day" ? "día" : "noche"} aplicado.`);
    return;
  }
  const savedSize = JSON.parse(figma.root.getPluginData("figma-theme-panel-size") || "{}");
  const clampSize = (width: number, height: number) => ({ width: Math.min(1000, Math.max(340, Math.round(width))), height: Math.min(1000, Math.max(240, Math.round(height))) });
  const initialSize = clampSize(Number.isFinite(savedSize.width) ? savedSize.width : 340, Number.isFinite(savedSize.height) ? savedSize.height : 340);
  figma.showUI(__html__, { ...initialSize, themeColors: true });
  let queue = Promise.resolve();
  figma.ui.onmessage = (message: { type: string; id?: string; name?: string; theme?: Theme; mode?: Theme; value?: string; kind?: Kind; width?: number; height?: number; persist?: boolean }) => {
    if (message.type === "resize") {
      if (typeof message.width !== "number" || typeof message.height !== "number" || !Number.isFinite(message.width) || !Number.isFinite(message.height)) return;
      const size = clampSize(message.width, message.height);
      figma.ui.resize(size.width, size.height);
      if (message.persist) figma.root.setPluginData("figma-theme-panel-size", JSON.stringify(size));
      return;
    }
    queue = queue.then(async () => {
      if (message.type === "export") {
        figma.ui.postMessage({ type: "export", text: exportTokens(tokens) });
        return;
      }
      if (message.type === "restore") {
        if (!message.kind || !kinds.includes(message.kind)) throw new Error("Categoría desconocida.");
        await restorePresets(tokens, message.kind, true);
        figma.ui.postMessage({ type: "notice", message: "Defaults restaurados; tus tokens personalizados se conservaron." });
      } else if (message.type === "add") {
        const kind = message.kind || "colors";
        if (!kinds.includes(kind)) throw new Error("Categoría desconocida.");
        const prefix = kind === "colors" ? "color" : kind;
        let number = 1;
        while (tokens.some(t => t.name === `${prefix} ${number}`)) number++;
        tokens.push(await createToken(`${prefix} ${number}`, kind));
        save(tokens);
      } else if (message.type === "delete") {
        const index = tokens.findIndex(token => token.variableId === message.id);
        if (index === -1) throw new Error("No se encontró ese color.");
        const variable = await getResource(tokens[index]);
        if (variable) variable.remove();
        tokens.splice(index, 1);
        save(tokens);
      } else if (message.type === "theme" && (message.theme === "day" || message.theme === "night")) {
        await applyTheme(tokens, message.theme);
      } else if (message.type === "rename") {
        const token = tokens.find(t => t.variableId === message.id);
        const name = message.name?.trim();
        if (!token || !name || name.split("/").some(part => !part.trim())) throw new Error("Usa un nombre válido y no vacío.");
        if (tokens.some(other => other !== token && other.name === name)) throw new Error("Ese nombre ya existe.");
        const variable = await getResource(token);
        if (!variable) throw new Error("La variable fue eliminada.");
        variable.name = name;
        token.name = name;
        save(tokens);
      } else if (message.type === "value" || message.type === "color") {
        const token = tokens.find(t => t.variableId === message.id);
        if (!token || (message.mode !== "day" && message.mode !== "night")) throw new Error("Color o modo desconocido.");
        const value = parseValue(token.kind, message.value || "");
        const previous = token[message.mode];
        token[message.mode] = value;
        try { await applyTheme(tokens, active()); } catch (error) { token[message.mode] = previous; throw error; }
      }
      figma.commitUndo();
      sendState();
    }).catch(error => {
      console.error(error);
      figma.ui.postMessage({ type: "error", message: error instanceof Error ? error.message : "No se pudo actualizar el color." });
      sendState();
    });
  };
  sendState();
}
run().catch(error => { console.error(error); figma.closePlugin(error instanceof Error ? error.message : "No se pudo actualizar el tema."); });
