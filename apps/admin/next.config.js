const isDev = process.env.NODE_ENV !== "production";

// The browser only ever talks to this app's own /api routes (they proxy to the
// backend services server-side), so connect-src is 'self'. Dev adds what
// Next's hot reload needs: eval and the HMR websocket.
const ENFORCED_CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // No X-Powered-By: Next.js header.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Clickjacking protection — admin should never be framed
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Force HTTPS and include subdomains (1 year)
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Disable browser features not needed by the admin panel
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          // Referrer: send origin only so admin URLs stay internal
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Enforced baseline CSP. The stricter nonce-based policy is sent as
          // Content-Security-Policy-Report-Only by middleware.ts; once it shows
          // no violations it replaces this one (see middleware.ts).
          { key: "Content-Security-Policy", value: ENFORCED_CSP },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
