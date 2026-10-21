export interface Passage {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface Film {
  id: string;
  title: string;
  subtitle: string;
  durationMs: number;
  version: string;
  passages: Passage[];
}

export interface AskRequest {
  videoId: string;
  positionMs: number;
  question: string;
}

export interface Citation extends Passage {}

export interface ModelAnswer {
  status: "answered" | "insufficient_context";
  answer: string;
  evidenceIds: string[];
}

export interface AnswerResponse {
  answer: string;
  citations: Citation[];
  cutoffMs: number;
  status: ModelAnswer["status"];
  mode: "fixture" | "aws";
}

export interface AnswerProvider {
  mode: "fixture" | "aws";
  answer(question: string, eligible: Passage[]): Promise<ModelAnswer>;
}
