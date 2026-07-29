/**
 * Lightweight prompt moderation: blocks clearly disallowed content before any
 * credits are spent or provider calls made. This is a first line of defense —
 * fal.ai models apply their own safety filters as well. For production scale,
 * consider adding a dedicated moderation API in front of this list.
 */

const BLOCKED_PATTERNS: RegExp[] = [
  // Sexual content involving minors — zero tolerance
  /\b(child|minor|underage|preteen|teen)\b.*\b(nude|naked|sexual|nsfw|porn)\b/i,
  /\b(nude|naked|sexual|nsfw|porn)\b.*\b(child|minor|underage|preteen)\b/i,
  // Explicit sexual content
  /\b(porn|pornographic|xxx|explicit sex|hardcore sex)\b/i,
  // Graphic violence / gore
  /\b(beheading|dismember(ment|ed)?|torture porn|snuff)\b/i,
  // Real-person sexual deepfakes
  /\bdeepfake\b.*\b(nude|sex|porn)\b/i,
  // Hate symbols / glorification
  /\b(nazi propaganda|racial slur)\b/i,
];

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

export function moderatePrompt(prompt: string, negativePrompt?: string): ModerationResult {
  const text = `${prompt}\n${negativePrompt ?? ""}`;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        reason: "This prompt appears to violate our content policy. Please rephrase it.",
      };
    }
  }
  return { allowed: true };
}
