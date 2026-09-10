// ─────────────────────────────────────────────────────────────
// Safety Resources — India
//
// The Community Guidelines direct people in crisis here:
//
//   "In India you can call Tele-MANAS on 14416 (free, 24×7, multiple
//    languages), KIRAN on 1800-599-0019, or Vandrevala Foundation on
//    9999 666 555. In an emergency, call 112. A fuller list is at
//    digiability.org/safety and in the app under Settings → Safety resources."
//
// ⚠️ This file replaced a hardcoded `CRISIS_HELPLINE = "988"` — the US Suicide
// & Crisis Lifeline — which was presented in an India-only app as the "24/7
// Crisis & Mental Health Lifeline". Dialling 988 from an Indian number does not
// reach a crisis service. Anyone adding a number here must verify it is
// reachable from India.
//
// Keep in step with docs/legal/02-community-guidelines.md §6 and
// apps/mobile/src/constants/safetyResources.ts — the two clients share no code
// by design, so this list is duplicated deliberately and must not drift.
// ─────────────────────────────────────────────────────────────

export interface SafetyResource {
  name: string;
  /** Digits only, as dialled. Displayed via `display`. */
  phone: string;
  display: string;
  description: string;
  availability: string;
  /** Emergency services and crisis lines are surfaced above the rest. */
  priority: "emergency" | "crisis" | "support";
  languages?: string;
}

export const SAFETY_RESOURCES: SafetyResource[] = [
  {
    name: "Emergency services",
    phone: "112",
    display: "112",
    description:
      "Police, ambulance and fire. Call this first if someone is in immediate danger.",
    availability: "24×7",
    priority: "emergency",
  },
  {
    name: "Tele-MANAS",
    phone: "14416",
    display: "14416",
    description:
      "The Government of India's national mental health helpline. Free, confidential counselling.",
    availability: "24×7",
    priority: "crisis",
    languages: "Available in 20+ Indian languages",
  },
  {
    name: "KIRAN Mental Health Helpline",
    phone: "18005990019",
    display: "1800-599-0019",
    description:
      "National toll-free helpline for distress, anxiety, depression and suicidal thoughts.",
    availability: "24×7",
    priority: "crisis",
    languages: "13 languages",
  },
  {
    name: "Vandrevala Foundation",
    phone: "9999666555",
    display: "9999 666 555",
    description: "Free counselling and crisis support, by phone or WhatsApp.",
    availability: "24×7",
    priority: "crisis",
  },
  {
    name: "Childline India",
    phone: "1098",
    display: "1098",
    description:
      "For a child in distress or at risk. Also the number to call about a child safety concern.",
    availability: "24×7",
    priority: "emergency",
  },
];

/** The single number to surface when space allows only one. */
export const PRIMARY_CRISIS_LINE = SAFETY_RESOURCES.find((r) => r.name === "Tele-MANAS")!;

export const EMERGENCY_NUMBER = "112";
