import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Film } from "./types.js";
import { z } from "zod";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const filmSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), title: z.string(), subtitle: z.string(),
  durationMs: z.number().int().positive(), version: z.string(),
  passages: z.array(z.object({
    id: z.string(), startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(), text: z.string().min(1),
  })).min(1),
}).superRefine((film, ctx) => {
  const ids = new Set<string>();
  let previousEnd = 0;
  for (const p of film.passages) {
    if (p.startMs < previousEnd || p.endMs <= p.startMs || p.endMs > film.durationMs || ids.has(p.id)) {
      ctx.addIssue({ code: "custom", message: "Transcript must have unique IDs, ordered non-overlapping passages within duration." });
    }
    previousEnd = p.endMs;
    ids.add(p.id);
  }
});

export async function loadLocalFilm(): Promise<Film> {
  return filmSchema.parse(JSON.parse(await readFile(new URL("../media/story.json", import.meta.url), "utf8")));
}

export function eligiblePassages(film: Film, cutoffMs: number) {
  // Filter before prompt construction. A partially completed passage is withheld.
  return film.passages.filter(p => p.endMs <= cutoffMs);
}
