# HOLD — unpublished sections

**Nothing in this file may be rendered on any public surface.** It is not part of the
published document set (`01`–`06`) and must not be imported by the web or mobile legal
screens. The `lint:legal` check excludes this file from the placeholder scan for that reason.

Each section below describes a feature that does **not exist in the codebase**. Paste a
section back into its target document only when the corresponding feature actually ships,
then renumber the surrounding sections and any survival/cross-reference clauses.

---

## Terms of Use — "SOS and safety features"

**Target:** `03-terms-of-use.md`, as a numbered section.
**Blocked on:** no SOS screen, service, endpoint, or location permission exists anywhere in
the repo. Verified absent during the Phase 0 compliance audit.
**On reinstatement:** renumber sections 9–17 and update the survival clause in Section 12,
which currently names sections 5, 6, 10, 11, and 13.

> ### SOS and safety features — important limitations
>
> The SOS feature lets you alert contacts you've chosen. You must understand:
>
> - **SOS is NOT an emergency service.** It does not contact police, ambulance, fire services, or any emergency responder. **In an emergency, call 112 first.**
> - **We cannot guarantee delivery.** SOS depends on your device, battery, network connectivity, notification permissions, operating system behaviour, and your contacts' devices and availability — much of which is outside our control.
> - **We cannot guarantee anyone responds.** Your contacts are individuals, not a monitoring service. Nobody is on duty.
> - **Location may be unavailable or inaccurate**, depending on permissions, device settings, and signal.
> - **Do not rely on SOS as your only safety measure.** It supplements your safety planning; it does not replace it.
>
> To the fullest extent permitted by law, we are not liable for any failure, delay, or inaccuracy of SOS alerts, or for any action or inaction by your contacts.

---

## Community Guidelines — "Feature restriction" enforcement tier

**Target:** `02-community-guidelines.md`, the enforcement ladder table.
**Blocked on:** no partial-restriction user state exists. The admin panel can warn, suspend,
ban, and remove content, but there is no tier that limits posting or messaging while leaving
the account otherwise active. Adding it requires a new user state plus a gate in both the
chat send path and the forum post path.
**On reinstatement:** restore this row between "Warning" and "Temporary suspension".

> | **Feature restriction** (temporary posting/messaging limits) | Repeated lower-severity violations |

---

## ⛔ PUBLICATION BLOCKER — encryption-in-transit claims

**These are not sections to hold back. They are claims already in the documents
that are currently untrue.** Both must be true before Terms of Use or the
Privacy Policy is published anywhere.

| Document | Claim |
|---|---|
| `03-terms-of-use.md` §7 | "Your messages are encrypted in transit and access-controlled at rest" |
| `01-privacy-policy.md` §10 | "Data is encrypted in transit." |

All app builds pointed at plain `http://` on a raw IP, with iOS ATS and Android
cleartext protections explicitly disabled. Tokens, private messages and
disability disclosures crossed the network readable.

The application side is fixed — production builds now enforce ATS, deny
cleartext, and target https placeholders, guarded by `npm run check:transport`.
**The infrastructure side is not**: there is still no domain and no certificate.

Publishing a binding agreement that claims encryption we do not provide is worse
than having no document. Do not publish either until
`docs/runbooks/transport-security.md` is complete and a production build
connects over TLS.

Do **not** resolve this by softening the wording. Encryption in transit is a
baseline expectation for an app carrying health data, not an optional feature to
write around.
