// next.config.js
const withNextIntl = require('next-intl/plugin')('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },

  async rewrites() {
    return [
      // i18n: serve /en/... and /pl/... from your unprefixed /app routes
      { source: '/:locale(en|pl)', destination: '/' },
      { source: '/:locale(en|pl)/:path*', destination: '/:path*' },

      // existing API rewrite
      { source: '/api/scout/players/:id/follow', destination: '/api/scout/follow?player_id=:id' },
    ]
  },
}

module.exports = withNextIntl(nextConfig)
