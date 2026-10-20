/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  experimental: {
    serverComponentsExternalPackages: ['highlight.js'],
  },
  async rewrites() {
    return {
      // /docs/<page>.md serves that page as raw Markdown (src/app/raw).
      // beforeFiles so it wins over the /docs/[[...slug]] page route.
      beforeFiles: [
        { source: '/docs/:path(.+)\.md', destination: '/raw/:path' },
      ],
    }
  },
}

export default nextConfig
