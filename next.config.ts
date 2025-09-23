/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Map any old call to the new safe API
      { source: "/api/scout/players/:id/follow", destination: "/api/scout/follow?player_id=:id" },
    ]
  },
}
module.exports = nextConfig
