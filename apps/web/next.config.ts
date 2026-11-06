import path from 'node:path';
import type { NextConfig } from 'next';

// `NEXT_OUTPUT=standalone` est positionné par le Dockerfile : serveur autonome, sans node_modules complet.
const standalone = process.env.NEXT_OUTPUT === 'standalone';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  ...(standalone
    ? { output: 'standalone', outputFileTracingRoot: path.join(__dirname, '../..') }
    : {}),
};

export default nextConfig;
