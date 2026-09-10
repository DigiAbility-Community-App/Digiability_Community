// ─────────────────────────────────────────────────────
// Report Severity — forum content
//
// forum-svc stores `reason` as free text (the client sends a category label,
// optionally followed by details), so severity is inferred from that label
// rather than read from an enum as it is in user-svc.
//
// Encodes the "How we respond to reports" table in
// docs/legal/02-community-guidelines.md. Keep the two in step.
// ─────────────────────────────────────────────────────

export type ReportSeverity = 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MEDIUM' | 'LOW';

// Ordered most-severe first: the first match wins, so "child safety" is checked
// before the generic terms that might also appear in the same sentence.
const RULES: Array<{ severity: ReportSeverity; patterns: RegExp }> = [
  { severity: 'CRITICAL', patterns: /child safety|child sexual|csae|csam|grooming|trafficking|threat of violence|credible threat/i },
  { severity: 'HIGH', patterns: /self[- ]?harm|suicide|eating disorder/i },
  { severity: 'ELEVATED', patterns: /impersonat|intimate image|non[- ]?consensual|doxx|privacy violation/i },
  { severity: 'MEDIUM', patterns: /harass|hate speech|sexual content|nudity|scam|fraud|health misinformation|violence|illegal/i },
  { severity: 'LOW', patterns: /spam|misinformation|intellectual property|copyright/i },
];

export function severityForReason(reason: string): ReportSeverity {
  for (const rule of RULES) {
    if (rule.patterns.test(reason)) return rule.severity;
  }
  // Unknown intent sits mid-tier rather than lowest, so an unusual report is
  // not buried behind spam.
  return 'MEDIUM';
}
