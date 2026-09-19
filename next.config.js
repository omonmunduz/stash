const withNextIntl = require('next-intl/plugin')();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increased to support image uploads
    },
    // Client Router Cache. Next 15 changed the `dynamic` default to 0, so every
    // soft navigation refetched the RSC payload — even re-clicking a nav link
    // visited seconds earlier. 30s makes revisiting a section instant.
    //
    // Safe for freshness: Server Actions call revalidatePath() after writes,
    // which invalidates this cache immediately.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
}

module.exports = withNextIntl(nextConfig)
