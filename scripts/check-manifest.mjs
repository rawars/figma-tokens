import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
if (typeof manifest.id !== "string" || !manifest.id.trim()) throw new Error("Falta el identificador del plugin para guardar pluginData.");
if (manifest.api !== "1.0.0" || manifest.documentAccess !== "dynamic-page") {
  throw new Error("Configuración de API o documentAccess inválida.");
}
if (!manifest.editorType.includes("figma") || !manifest.main) {
  throw new Error("Falta el editor Figma o el archivo principal.");
}
await access(resolve(manifest.main));
if (typeof manifest.ui === "string") await access(resolve(manifest.ui));
const code = await readFile(manifest.main, "utf8");
if (!code.trim()) throw new Error("El archivo compilado está vacío.");
console.log(`Manifest verificado: ${manifest.main} existe y contiene código.`);
