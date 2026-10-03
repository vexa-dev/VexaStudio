import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const errors = [];
const browserGlobals = new Set([
  "window", "document", "navigator", "localStorage", "sessionStorage",
  "HTMLElement", "CustomEvent", "Audio",
]);
const allowed = { domain: new Set(["date-fns", "@date-fns/tz"]), services: new Set(["@vexa/domain"]) };

async function scan(directory, check) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) await scan(path, check);
    else if (/\.(ts|tsx)$/.test(item.name)) await check(path);
  }
}

async function checkFile(path, packageName) {
  const source = ts.createSourceFile(path, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true);
  const isTest = path.endsWith(".test.ts");
  const report = (message) => errors.push(`${relative(root, path)}: ${message}`);
  function visit(node) {
    const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      ? node.moduleSpecifier
      : ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === "require")
        ? node.arguments[0] : undefined;
    if (specifier && ts.isStringLiteral(specifier)) {
      const name = specifier.text;
      if (packageName) {
        if (name.startsWith(".")) {
          const target = relative(resolve(root, `packages/${packageName}/src`), resolve(dirname(path), name));
          if (target.startsWith(`..${sep}`) || target === "..") report("Import fuera del paquete compartido.");
        } else if (!(isTest && name === "vitest") && ![...allowed[packageName]].some((dep) => name === dep || name.startsWith(`${dep}/`))) {
          report(`Dependencia no permitida: ${name}.`);
        }
      } else if (!isTest && !path.includes(`${sep}services${sep}`) && (name.includes("services/mock") || name.includes("lib/supabase"))) {
        report("La interfaz debe acceder a los datos mediante servicios y hooks.");
      }
    }
    if (packageName && ts.isIdentifier(node) && browserGlobals.has(node.text)) report(`API de navegador en paquete compartido: ${node.text}.`);
    if (packageName && ts.isMetaProperty(node) && node.getText(source) === "import.meta") report("La configuración de la plataforma pertenece a la aplicación.");
    ts.forEachChild(node, visit);
  }
  visit(source);
}

for (const packageName of Object.keys(allowed)) {
  const manifest = JSON.parse(await readFile(resolve(root, `packages/${packageName}/package.json`), "utf8"));
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    if (!allowed[packageName].has(dependency)) errors.push(`${manifest.name}: dependencia no permitida ${dependency}.`);
  }
  await scan(resolve(root, `packages/${packageName}/src`), (path) => checkFile(path, packageName));
}
await scan(resolve(root, "apps/web/src"), (path) => checkFile(path));
if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else process.stdout.write("Límites de arquitectura verificados.\n");
