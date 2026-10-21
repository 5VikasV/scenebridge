import "dotenv/config";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { PutObjectCommand, HeadBucketCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from "@aws-sdk/client-transcribe";
import { awsRegion, bucketName, prefix, s3 } from "../server/aws.js";
import { loadLocalFilm, root, filmSchema } from "../server/content.js";
import { transcribePassages, webVtt } from "./transcript.js";

// Explicit operator command: paid AWS work is never run on server startup or npm install.
const bucket = bucketName();
await s3.send(new HeadBucketCommand({ Bucket: bucket }));
const film = await loadLocalFilm();
const generated = join(root, "media/generated");
await mkdir(join(generated,"narration"), { recursive: true });
const polly = new PollyClient({ region: awsRegion, maxAttempts: 2 });
for (const p of film.passages) {
  const path = join(generated,"narration",`${p.id}.mp3`);
  const response = await polly.send(new SynthesizeSpeechCommand({
    Engine: "standard", VoiceId: "Joanna", OutputFormat: "mp3",
    TextType: "ssml", Text: `<speak><prosody rate="fast">${p.text.replaceAll("&","&amp;").replaceAll("<","&lt;")}</prosody></speak>`,
  }));
  if (!response.AudioStream) throw new Error("Polly returned no audio.");
  await writeFile(path, await response.AudioStream.transformToByteArray());
  const probe = spawnSync("ffprobe",["-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",path],{encoding:"utf8"});
  if (probe.status !== 0 || Number(probe.stdout.trim()) > 8) throw new Error(`${p.id} narration exceeds its eight-second slot. Shorten the script or adjust voice speed before continuing.`);
  console.info(`Narrated ${p.id}`);
}
const rendered = spawnSync("python3",["scripts/render-mystery.py","--polly"],{cwd:root,stdio:"inherit"});
if (rendered.status !== 0) throw new Error("Video rendering failed.");
await s3.send(new PutObjectCommand({ Bucket:bucket,Key:`${prefix}/mystery.mp4`,Body:await readFile(join(generated,"mystery.mp4")),ContentType:"video/mp4" }));
const transcribe = new TranscribeClient({region:awsRegion,maxAttempts:2});
const jobName = `scenebridge-${Date.now()}`;
await transcribe.send(new StartTranscriptionJobCommand({
  TranscriptionJobName:jobName, LanguageCode:"en-US", MediaFormat:"mp4",
  Media:{MediaFileUri:`s3://${bucket}/${prefix}/mystery.mp4`},
  OutputBucketName:bucket,OutputKey:`${prefix}/transcribe/${jobName}.json`,
}));
console.info(`Started Transcribe job ${jobName}. Waiting up to 10 minutes.`);
let completed = false;
for (let i=0;i<60;i++) {
  await new Promise(r=>setTimeout(r,10000));
  const {TranscriptionJob:job} = await transcribe.send(new GetTranscriptionJobCommand({TranscriptionJobName:jobName}));
  if (job?.TranscriptionJobStatus === "FAILED") throw new Error(job.FailureReason || "Transcribe failed.");
  if (job?.TranscriptionJobStatus === "COMPLETED") { completed=true; break; }
}
if (!completed) throw new Error(`Transcribe is still running: ${jobName}. Inspect it in AWS before repeating preparation.`);
const transcript = await s3.send(new GetObjectCommand({Bucket:bucket,Key:`${prefix}/transcribe/${jobName}.json`}));
const raw = JSON.parse(await transcript.Body!.transformToString());
const processed = filmSchema.parse({...film,version:`aws-${jobName}`,passages:transcribePassages(raw.results.items,film.durationMs)});
await writeFile(join(generated,"aws-story.json"),JSON.stringify(processed,null,2));
await s3.send(new PutObjectCommand({Bucket:bucket,Key:`${prefix}/story.json`,Body:JSON.stringify(processed),ContentType:"application/json"}));
await s3.send(new PutObjectCommand({Bucket:bucket,Key:`${prefix}/captions.vtt`,Body:webVtt(processed.passages),ContentType:"text/vtt"}));
await writeFile(join(generated,"aws-preparation.json"),JSON.stringify({jobName,region:awsRegion,passageCount:processed.passages.length,completedAt:new Date().toISOString()},null,2));
console.info("AWS preparation complete. Set SCENEBRIDGE_MODE=aws and run npm start.");
