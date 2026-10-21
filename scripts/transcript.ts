import type { Passage } from "../server/types.js";

interface Word { type: string; start_time?: string; end_time?: string; alternatives: { content: string }[] }
// Sentence-sized passages, with timestamps from the actual audio, never guessed durations.
export function transcribePassages(words: Word[], durationMs: number): Passage[] {
  const result: Passage[] = [];
  let text = "", start = 0, end = 0;
  function flush() {
    if (text.trim()) result.push({ id: `t${String(result.length + 1).padStart(3,"0")}`, startMs: start, endMs: end, text: text.trim() });
    text = "";
  }
  for (const word of words) {
    const content = word.alternatives[0]?.content;
    if (!content) continue;
    if (word.type === "pronunciation") {
      const wordStart = Math.floor(Number(word.start_time) * 1000);
      const wordEnd = Math.ceil(Number(word.end_time) * 1000);
      if (!Number.isFinite(wordStart) || !Number.isFinite(wordEnd) || wordEnd > durationMs || wordEnd <= wordStart) throw new Error("Invalid Transcribe word timestamps.");
      if (!text) start = wordStart;
      end = wordEnd;
      text += `${text ? " " : ""}${content}`;
    } else if (word.type === "punctuation" && text) {
      text += content;
      if (/[.!?]/.test(content)) flush();
    }
  }
  flush();
  if (!result.length) throw new Error("Transcribe produced no speech; check the narrated video before uploading.");
  return result;
}

export function webVtt(passages: Passage[]) {
  const time = (ms: number) => `${String(Math.floor(ms/3600000)).padStart(2,"0")}:${String(Math.floor(ms/60000)%60).padStart(2,"0")}:${String(Math.floor(ms/1000)%60).padStart(2,"0")}.${String(ms%1000).padStart(3,"0")}`;
  return `WEBVTT\n\n${passages.map(p => `${p.id}\n${time(p.startMs)} --> ${time(p.endMs)}\n${p.text}\n`).join("\n")}`;
}
