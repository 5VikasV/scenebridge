import "dotenv/config";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { S3Client, CreateBucketCommand, PutPublicAccessBlockCommand, PutBucketEncryptionCommand, type BucketLocationConstraint } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "node:fs/promises";

const region=process.env.AWS_REGION || "us-east-1";
const identity=await new STSClient({region}).send(new GetCallerIdentityCommand({}));
if(!identity.Account)throw new Error("Could not determine the AWS account.");
const bucket=process.env.S3_BUCKET || `scenebridge-${identity.Account}-${region}`;
const s3=new S3Client({region});
try{
  await s3.send(new CreateBucketCommand({Bucket:bucket,...(region!=="us-east-1"?{CreateBucketConfiguration:{LocationConstraint:region as BucketLocationConstraint}}:{})}));
}catch(error){if(!(error instanceof Error && error.name==="BucketAlreadyOwnedByYou"))throw error;}
await s3.send(new PutPublicAccessBlockCommand({Bucket:bucket,PublicAccessBlockConfiguration:{BlockPublicAcls:true,IgnorePublicAcls:true,BlockPublicPolicy:true,RestrictPublicBuckets:true}}));
await s3.send(new PutBucketEncryptionCommand({Bucket:bucket,ServerSideEncryptionConfiguration:{Rules:[{ApplyServerSideEncryptionByDefault:{SSEAlgorithm:"AES256"}}]}}));
await mkdir(".local",{recursive:true});
await writeFile(".local/aws-storage.json",JSON.stringify({bucket,region,createdBy:"SceneBridge",createdAt:new Date().toISOString()},null,2));
console.info(`Private S3 storage ready. Set S3_BUCKET=${bucket} in .env, then run npm run aws:prepare.`);
