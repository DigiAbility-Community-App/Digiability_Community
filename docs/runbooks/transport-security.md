# Transport Security — what must exist before launch

**Status:** ⛔ **Launch blocker.** Not yet done.
**Owner:** whoever holds the `techonsy/ngo-devops` repo and DNS.
**Last updated:** [DATE]

---

## The problem

Every build of this app — development, preview and **production** — pointed at:

```
http://187.127.191.28:30501   (user-svc)
http://187.127.191.28:30502   (chat-svc)
http://187.127.191.28:30503   (forum-svc)
```

Plain HTTP, to a raw IP, on Kubernetes NodePorts. And both OS-level protections
that would have flagged it were switched off in `app.json`:

| Setting | Effect |
|---|---|
| `NSAppTransportSecurity.NSAllowsArbitraryLoads: true` | iOS App Transport Security disabled globally |
| `usesCleartextTraffic: true` | Android cleartext allowed globally |

So every access token, every private message, and every disability disclosure
crossed mobile networks in the clear — readable by anyone on the same Wi-Fi, any
intermediate network, or any carrier.

It also made two published statements untrue:

- **Terms of Use §7** — "Your messages are encrypted in transit"
- **Privacy Policy §10** — "Data is encrypted in transit"

Neither document may be published while this is the case.

## What has been done in the application repo

- `app.config.js` replaces the static `app.json` network settings. **Production
  builds now enforce ATS and deny cleartext.** Development and preview keep the
  permissive settings, because they are internal and target LAN addresses.
- Production endpoints are `https://REPLACE-WITH-*-DOMAIN` placeholders, so a
  production build **fails loudly** rather than quietly shipping cleartext.
- `npm run check:transport` fails the build if any of that is reverted.

**A production build cannot succeed until the work below is done.** That is
deliberate. The previous state — a working production build over cleartext — was
the more dangerous one.

## What the infrastructure needs

1. **A domain.** Three hostnames, or one with path routing:
   `api.` / `chat.` / `forum.` — whatever DNS you control.
2. **Ingress with TLS termination**, replacing direct NodePort exposure. The
   NodePorts should stop being reachable from the public internet once ingress
   is in front.
3. **Automated certificate renewal.** cert-manager with Let's Encrypt and an
   HTTP-01 or DNS-01 solver. Manual certificates lapse — usually at a weekend.
4. **HSTS** on the ingress: `Strict-Transport-Security: max-age=31536000;
   includeSubDomains`. Add `preload` only once you are confident, since it is
   hard to undo.
5. **Redirect HTTP → HTTPS** at the ingress rather than serving both.
6. **WebSocket over TLS.** chat-svc's WS endpoint must be `wss://`; check the
   ingress passes upgrade headers through.

## Then, in this repo

1. Replace the three `REPLACE-WITH-*-DOMAIN` placeholders in
   `apps/mobile/eas.json` and `apps/web/.env.production`.
2. Run `npm run check:transport` — it should still pass.
3. Cut a production build and confirm it connects.
4. Verify the certificate chain and that HTTP redirects:
   ```bash
   curl -sI https://<api-domain>/health | head -3
   curl -sI http://<api-domain>/health | grep -i location
   openssl s_client -connect <api-domain>:443 -servername <api-domain> </dev/null 2>/dev/null | openssl x509 -noout -dates
   ```
5. Only then publish the Terms of Use and Privacy Policy, whose encryption
   claims become true at this point.

## Certificate pinning

Deferred, and correctly so — there is no certificate to pin yet. Worth
revisiting once TLS is stable, given this app carries 1:1 messaging and
disability status. Pinning also carries an operational risk: a rotated
certificate with a pinned build in the wild bricks the app until users update,
so it needs a backup pin and a rotation plan before it is worth doing.

## A note on `preview` builds

The preview profile still uses cleartext, because it is the profile used to test
against the dev server. **Do not use preview builds with real user accounts or
real personal data.** If preview is ever distributed beyond the team, it needs
the same treatment as production.
