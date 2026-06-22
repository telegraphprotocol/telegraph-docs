/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  experimental: {
    serverComponentsExternalPackages: ['highlight.js'],
  },
}

export default nextConfig
