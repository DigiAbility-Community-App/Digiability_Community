// ─────────────────────────────────────────────────────────────
// Expo config — network security varies by build profile.
//
// WHY THIS FILE EXISTS
//
// app.json is static, so every build got the same network policy. That policy
// was:
//     ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads = true
//     expo-build-properties.android.usesCleartextTraffic        = true
//
// — App Transport Security disabled globally on iOS, and cleartext HTTP allowed
// globally on Android, in every build including production. Combined with
// eas.json pointing production at http://<ip>, that meant every JWT, private
// message and disability disclosure crossed the network unencrypted, with the
// two OS-level protections that would have flagged it explicitly switched off.
//
// WHAT THIS CHANGES
//
// Development and preview builds keep the permissive settings: they are
// internal, never shipped to users, and developers need to reach arbitrary LAN
// addresses that change per machine.
//
// PRODUCTION BUILDS GET NO EXEMPTION. ATS is enforced and cleartext is denied.
// A production build pointed at an http:// endpoint will now fail to connect —
// loudly, at the network layer — rather than succeeding quietly and shipping
// people's health data in the clear. That failure is the intended behaviour
// until TLS terminates on a real domain.
//
// See docs/runbooks/transport-security.md for what the infrastructure needs.
// ─────────────────────────────────────────────────────────────

// EAS sets this during a build. Absent locally (`expo start`), which is a
// development context, so that is the safe default.
const profile = process.env.EAS_BUILD_PROFILE ?? "development";
const isProduction = profile === "production";

module.exports = ({ config }) => {
  const ios = { ...config.ios };
  const infoPlist = { ...(ios.infoPlist ?? {}) };

  if (isProduction) {
    // Enforce ATS: no arbitrary loads, no per-domain exceptions.
    delete infoPlist.NSAppTransportSecurity;
  } else {
    infoPlist.NSAppTransportSecurity = { NSAllowsArbitraryLoads: true };
  }
  ios.infoPlist = infoPlist;

  // expo-build-properties carries the Android cleartext flag. Rewrite that one
  // plugin entry and leave every other plugin untouched.
  const plugins = (config.plugins ?? []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === "expo-build-properties") {
      const [name, props] = plugin;
      return [
        name,
        {
          ...props,
          android: {
            ...(props?.android ?? {}),
            usesCleartextTraffic: !isProduction,
          },
        },
      ];
    }
    return plugin;
  });

  // Read at runtime by src/config/env.ts, which refuses to start a production
  // build whose endpoints aren't https/wss.
  const extra = { ...(config.extra ?? {}), buildProfile: profile };

  // Store builds: strip the dev-client URL scheme, unused permissions and
  // needlessly exported components (plugins/withAndroidReleaseHardening.js).
  if (isProduction) {
    plugins.push("./plugins/withAndroidReleaseHardening");
  }

  return { ...config, ios, plugins, extra };
};
