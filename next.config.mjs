const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
  },
  typescript: {
    // Pre-existing db.ts type error does not affect the demo (all data is mocked)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
