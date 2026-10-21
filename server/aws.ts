import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { filmSchema } from "./content.js";
import { makePrompt, modelAnswerSchema } from "./answers.js";
import type { AnswerProvider, Passage } from "./types.js";

export const awsRegion = process.env.AWS_REGION || "us-east-1";
export const prefix = (process.env.S3_PREFIX || "scenebridge").replace(/^\/+|\/+$/g, "");
export const s3 = new S3Client({ region: awsRegion, maxAttempts: 2 });

export function bucketName(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is required in AWS mode. Run npm run aws:prepare first.");
  return bucket;
}

export async function loadAwsFilm() {
  const object = await s3.send(new GetObjectCommand({ Bucket: bucketName(), Key: `${prefix}/story.json` }));
  const json = await object.Body?.transformToString();
  if (!json) throw new Error("The S3 transcript is empty.");
  return filmSchema.parse(JSON.parse(json));
}

export async function signedMedia(filename: string) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucketName(), Key: `${prefix}/${filename}` }), { expiresIn: 3600 });
}

export class BedrockProvider implements AnswerProvider {
  readonly mode = "aws" as const;
  private readonly client = new BedrockRuntimeClient({ region: awsRegion, maxAttempts: 1 });
  private count = 0;
  constructor(private readonly report: (event: object) => void = () => {}) {}
  async answer(question: string, eligible: Passage[]) {
    const maxRequests = Math.max(1, Number(process.env.MAX_MODEL_REQUESTS || 100));
    if (this.count >= maxRequests) throw new Error("Development model request limit reached. Review usage before restarting the server.");
    this.count++;
    const prompt = makePrompt(question, eligible);
    const started = Date.now();
    const result = await this.client.send(new ConverseCommand({
      modelId: process.env.BEDROCK_MODEL_ID || "us.amazon.nova-2-lite-v1:0",
      system: [{ text: prompt.system }],
      messages: [{ role: "user", content: [{ text: prompt.user }] }],
      inferenceConfig: { maxTokens: Number(process.env.MODEL_MAX_OUTPUT_TOKENS || 600), temperature: 0 },
    }), { abortSignal: AbortSignal.timeout(Number(process.env.MODEL_TIMEOUT_MS || 20000)) });
    this.report({ event: "bedrock_answer", requestId: result.$metadata.requestId, latencyMs: Date.now() - started,
      usage: result.usage, passageIds: eligible.map(p => p.id), maxEvidenceEndMs: eligible.at(-1)?.endMs });
    if (result.stopReason !== "end_turn") throw new Error("Model did not complete a grounded answer.");
    const text = result.output?.message?.content?.map(block => block.text ?? "").join("") ?? "";
    return modelAnswerSchema.parse(JSON.parse(text));
  }
}
