import "dotenv/config";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const region = process.env.AWS_REGION || "us-east-1";
const identity = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
console.info(`AWS authentication verified for account ending ${identity.Account?.slice(-4)}. No credentials are printed.`);
const response = await new BedrockRuntimeClient({ region, maxAttempts: 1 }).send(new ConverseCommand({
  modelId: process.env.BEDROCK_MODEL_ID || "us.amazon.nova-2-lite-v1:0",
  messages: [{ role: "user", content: [{ text: "Reply with exactly: SceneBridge ready" }] }],
  inferenceConfig: { maxTokens: 20, temperature: 0 },
}), { abortSignal: AbortSignal.timeout(20000) });
console.info({ bedrock: response.output?.message?.content?.map(c => c.text ?? "").join(""), usage: response.usage });
