import type { Highlight } from "./types";
export const POSITIVE_WORKFLOW_TAGS = ["make-anki", "make-atomic", "reflect"] as const;
export type PositiveWorkflowTag = typeof POSITIVE_WORKFLOW_TAGS[number];

const POSITIVE_WORKFLOW_TAG_SET = new Set<string>(POSITIVE_WORKFLOW_TAGS);

export function hasPositiveWorkflowTag(highlight: Pick<Highlight, "tags">): boolean {
  return highlight.tags.some((tag) => POSITIVE_WORKFLOW_TAG_SET.has(String(tag).trim().toLowerCase()));
}

export function isActiveWorkflowHighlight(highlight: Pick<Highlight, "tags">): boolean {
  return hasPositiveWorkflowTag(highlight);
}
