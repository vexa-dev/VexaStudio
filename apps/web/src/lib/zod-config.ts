import { z } from "zod";

/**
 * Zod compiles validators with `new Function` when it can. A strict CSP (no
 * `unsafe-eval`, see `vercel.json`) reports that probe as a violation even
 * though zod falls back safely, so JIT is turned off. The forms here validate a
 * handful of fields, so the speed-up is not needed.
 */
export function configureZod(): void {
  z.config({ jitless: true });
}
