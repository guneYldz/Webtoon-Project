/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: false, // Nginx gzip aktif oldugu icin devre disi
  transpilePackages: ['swiper'],
  images: {
    // Optimize edilen görseller 31 gün önbellekte tutulur
    minimumCacheTTL: 2678400,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'kaosmanga.net',
        pathname: '/api/static/**',
      },
      {
        protocol: 'https',
        hostname: 'api.kaosmanga.net',
        pathname: '/static/**',
      },
      {
        protocol: 'http',
        hostname: 'kaosmanga.net',
        port: '8000',
        pathname: '/static/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/static/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
        pathname: '/static/**',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=60, stale-while-revalidate=120, must-revalidate",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // www → non-www 301 (SEO: tek tercih edilen alan adı)
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.kaosmanga.net" }],
        destination: "https://kaosmanga.net/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
