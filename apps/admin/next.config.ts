import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source.
  transpilePackages: ['@rn-booking/shared'],
  typedRoutes: true,
  poweredByHeader: false,
};

export default nextConfig;
