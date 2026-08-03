export type ReflectFileResolution<T> =
  | { kind: "found"; file: T; reflected: boolean }
  | { kind: "missing" }
  | { kind: "ambiguous"; files: T[] }
  | { kind: "unresolved" };

export interface ReflectCandidate<T> {
  file: T;
  path: string;
  id?: string;
  reflected?: boolean;
  reliable: boolean;
}

export function classifyReflectCandidates<T>(candidates: ReflectCandidate<T>[], highlightId: string): ReflectFileResolution<T> {
  const matches = [...new Map(candidates.filter((candidate) => candidate.id === highlightId).map((candidate) => [candidate.path, candidate])).values()];
  if (matches.length > 1) return { kind: "ambiguous", files: matches.map((match) => match.file) };
  // Even one known match is not unique while another file could not be read.
  if (candidates.some((candidate) => !candidate.reliable)) return { kind: "unresolved" };
  if (matches.length === 0) return { kind: "missing" };
  return { kind: "found", file: matches[0].file, reflected: matches[0].reflected === true };
}
