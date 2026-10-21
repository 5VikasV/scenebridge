import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import { askFilm, FixtureProvider } from "./answers.js";
import { loadLocalFilm, root } from "./content.js";
import type { AnswerProvider, Film } from "./types.js";
import { join } from "node:path";

export interface AppOptions {
  provider?: AnswerProvider;
  film?: Film;
  mediaUrls?: () => Promise<{ mediaUrl: string; captionsUrl: string }>;
  logger?: boolean;
}

export async function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 8192 });
  const provider = options.provider ?? new FixtureProvider();
  const film = options.film ?? await loadLocalFilm();
  // Static serving supports HTTP byte ranges for native player seeking.
  await app.register(fastifyStatic, { root: join(root, "media/generated"), prefix: "/media/", decorateReply: false,
    allowedPath: path => ["/mystery.mp4", "/captions.vtt"].includes(path),
  });
  await app.register(fastifyStatic, { root: join(root, "preview"), prefix: "/", decorateReply: false });
  app.get("/health", async () => ({ ok: true, mode: provider.mode, videoId: film.id }));
  app.get("/catalog", async () => {
    const urls = options.mediaUrls ? await options.mediaUrls() : { mediaUrl: "/media/mystery.mp4", captionsUrl: "/media/captions.vtt" };
    return { mode: provider.mode, videos: [{ id: film.id, title: film.title, subtitle: film.subtitle,
      durationMs: film.durationMs, version: film.version, ...urls }] };
  });
  const schema = z.object({
    videoId: z.string().max(80), positionMs: z.number().int().min(0).max(film.durationMs),
    question: z.string().trim().min(1).max(Number(process.env.MAX_QUESTION_CHARS || 600)),
  }).strict();
  // Limit simultaneous inference and rapid repeat submissions without cloud infrastructure.
  let active = 0;
  const recent = new Map<string, number[]>();
  app.post("/ask", async (request, reply) => {
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Provide videoId, an in-range integer positionMs, and a question of 1–600 characters." });
    if (parsed.data.videoId !== film.id) return reply.code(404).send({ error: "Video not found." });
    const now = Date.now();
    const times = (recent.get(request.ip) ?? []).filter(t => now - t < 60_000);
    if (times.length >= 12 || active >= 2) return reply.code(429).send({ error: "Please wait a moment before asking again." });
    if (recent.size > 1000) recent.clear();
    recent.set(request.ip, [...times, now]);
    active++;
    try {
      const answer = await askFilm(film, parsed.data.positionMs, parsed.data.question, provider);
      app.log.info({ event: "answer_boundary", cutoffMs: answer.cutoffMs,
        evidenceIds: answer.citations.map(c => c.id), status: answer.status, mode: answer.mode });
      return answer;
    } catch (error) {
      app.log.error({ err: error }, "Answer unavailable");
      return reply.code(503).send({ error: "SceneBridge couldn't reach its answer service. Your video position is saved; please retry.", mode: provider.mode });
    } finally { active--; }
  });
  return app;
}
