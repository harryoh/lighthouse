/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Enable standalone output for Docker production builds
  ...(process.env.NODE_ENV === 'production' && {
    output: 'standalone',
    outputFileTracingRoot: require('path').join(__dirname, '../../'),
  }),
};

module.exports = nextConfig;