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

export interface ReflectCandidateIndex<T> {
  candidatesByHighlightId: Map<string, ReflectCandidate<T>[]>;
  unreliableCandidates: ReflectCandidate<T>[];
}

export async function buildReflectIndexIfNeeded<T>(highlightIds: string[], build: () => Promise<ReflectCandidateIndex<T>>): Promise<ReflectCandidateIndex<T> | null> {
  return highlightIds.length === 0 ? null : build();
}

export async function buildReflectCandidateIndex<T>(files: T[], readCandidate: (file: T) => Promise<ReflectCandidate<T>>, concurrency = 6): Promise<ReflectCandidateIndex<T>> {
  const candidates: ReflectCandidate<T>[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < files.length) {
      const index = next++;
      candidates[index] = await readCandidate(files[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()));
  const unique = [...new Map(candidates.map((candidate) => [candidate.path, candidate])).values()];
  const candidatesByHighlightId = new Map<string, ReflectCandidate<T>[]>();
  const unreliableCandidates: ReflectCandidate<T>[] = [];
  for (const candidate of unique) {
    if (!candidate.reliable) unreliableCandidates.push(candidate);
    else if (candidate.id) candidatesByHighlightId.set(candidate.id, [...(candidatesByHighlightId.get(candidate.id) ?? []), candidate]);
  }
  return { candidatesByHighlightId, unreliableCandidates };
}

export function resolveReflectFromIndex<T>(index: ReflectCandidateIndex<T>, highlightId: string): ReflectFileResolution<T> {
  const matches = index.candidatesByHighlightId.get(highlightId) ?? [];
  if (matches.length > 1) return { kind: "ambiguous", files: matches.map((match) => match.file) };
  if (index.unreliableCandidates.length > 0) return { kind: "unresolved" };
  if (matches.length === 0) return { kind: "missing" };
  return { kind: "found", file: matches[0].file, reflected: matches[0].reflected === true };
}

export function classifyReflectCandidates<T>(candidates: ReflectCandidate<T>[], highlightId: string): ReflectFileResolution<T> {
  const candidatesByHighlightId = new Map<string, ReflectCandidate<T>[]>();
  const unique = [...new Map(candidates.map((candidate) => [candidate.path, candidate])).values()];
  for (const candidate of unique.filter((item) => item.reliable && item.id)) candidatesByHighlightId.set(candidate.id!, [...(candidatesByHighlightId.get(candidate.id!) ?? []), candidate]);
  return resolveReflectFromIndex({ candidatesByHighlightId, unreliableCandidates: unique.filter((candidate) => !candidate.reliable) }, highlightId);
}
