/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@rtsc/shared"],
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
