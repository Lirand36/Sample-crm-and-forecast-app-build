import type { NextConfig } from "next";

// One app, two areas (/crm and /forecast) on one origin (DR-16).
// No server state: every page reads browser-held data through the repository ports.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
