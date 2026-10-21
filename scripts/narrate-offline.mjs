import createEspeak from '@echogarden/espeak-ng-emscripten';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const film=JSON.parse(await readFile(new URL('../media/story.json',import.meta.url),'utf8'));
const output=new URL('../media/generated/narration/',import.meta.url);
await mkdir(output,{recursive:true});
const module=await createEspeak();
const voice=new module.eSpeakNGWorker();
voice.set_voice('','en-us',2,0,0);
voice.set_rate(205);
function wav(samples,rate){
  const result=Buffer.alloc(44+samples.length*2);
  result.write('RIFF',0);result.writeUInt32LE(result.length-8,4);result.write('WAVEfmt ',8);
  result.writeUInt32LE(16,16);result.writeUInt16LE(1,20);result.writeUInt16LE(1,22);
  result.writeUInt32LE(rate,24);result.writeUInt32LE(rate*2,28);result.writeUInt16LE(2,32);result.writeUInt16LE(16,34);
  result.write('data',36);result.writeUInt32LE(samples.length*2,40);
  for(let i=0;i<samples.length;i++)result.writeInt16LE(samples[i],44+i*2);
  return result;
}
for(const p of film.passages){
  let chunks=[];
  voice.synthesize(p.text,audio=>{if(audio.length)chunks.push(Int16Array.from(audio));return false;});
  const length=chunks.reduce((sum,a)=>sum+a.length,0);
  const samples=new Int16Array(length);let offset=0;
  for(const chunk of chunks){samples.set(chunk,offset);offset+=chunk.length;}
  if(!length)throw new Error(`No narration produced for ${p.id}`);
  await writeFile(new URL(p.id+'.wav',output),wav(samples,voice.get_samplerate()));
  console.info(`Offline narration ${p.id}: ${(length/voice.get_samplerate()).toFixed(1)}s`);
}
module.destroy(voice);
const result=spawnSync('python3',['scripts/render-mystery.py'],{cwd:root,stdio:'inherit'});
process.exit(result.status??1);
