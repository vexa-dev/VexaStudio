// Regenerates apps/web/src/services/supabase/database.types.ts from the local Supabase stack.
// The file is written only when the CLI succeeds with non-empty output.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const target = fileURLToPath(
  new URL(
    "../apps/web/src/services/supabase/database.types.ts",
    import.meta.url,
  ),
);

const result = spawnSync(
  "supabase",
  ["gen", "types", "typescript", "--local"],
  {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  },
);

if (result.error?.code === "ENOENT") {
  console.error(
    "No se encontró la CLI de Supabase. Instálala (brew install supabase/tap/supabase) y vuelve a intentar.",
  );
  process.exit(1);
}
if (result.error || result.status !== 0 || !result.stdout.trim()) {
  console.error(
    "No se pudieron generar los tipos. ¿Está corriendo la base local? Usa `npm run db:start`.",
  );
  if (result.stderr) console.error(result.stderr.trim());
  process.exit(1);
}

writeFileSync(target, result.stdout);
console.log(
  "Tipos regenerados en apps/web/src/services/supabase/database.types.ts",
);
