import "dotenv/config";
import { buildApp } from "./app.js";
import { BedrockProvider, loadAwsFilm, signedMedia } from "./aws.js";

const mode = process.env.SCENEBRIDGE_MODE || "fixture";
if (!["fixture", "aws"].includes(mode)) throw new Error("SCENEBRIDGE_MODE must be fixture or aws.");
const app = await buildApp(mode === "aws" ? {
  logger: true,
  film: await loadAwsFilm(),
  provider: new BedrockProvider(event => console.info(JSON.stringify(event))),
  mediaUrls: async () => ({ mediaUrl: await signedMedia("mystery.mp4"), captionsUrl: await signedMedia("captions.vtt") }),
} : { logger: true });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { void app.close(); });
await app.listen({ host: process.env.HOST || "127.0.0.1", port: Number(process.env.PORT || 3000) });
console.info(`SceneBridge running in ${mode.toUpperCase()} mode. ${mode === "fixture" ? "Offline extractive fixtures — no AWS calls." : "Real Bedrock + S3 integration enabled."}`);
