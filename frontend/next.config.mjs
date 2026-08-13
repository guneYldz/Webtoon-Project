/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: false, // Nginx gzip aktif oldugu icin devre disi
  transpilePackages: ['swiper'],
  images: {
    remotePatterns: [
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
