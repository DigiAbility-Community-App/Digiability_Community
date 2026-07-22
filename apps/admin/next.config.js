/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

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
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Referrer: send origin only so admin URLs stay internal
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            // Admin is a server-rendered Next.js app:
            //   - scripts from self + Next.js inline scripts (nonce-based would be better but requires middleware)
            //   - styles from self + inline (Next.js inlines some CSS)
            //   - images from self + data URIs (for avatars/thumbnails)
            //   - connects to self (API routes) and the backend services
            //   - no frames, no objects
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed by Next.js dev; tighten in prod with nonce
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' http://localhost:4001 http://localhost:4002 http://localhost:4003",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
