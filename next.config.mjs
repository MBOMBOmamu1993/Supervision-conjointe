/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // xlsx (SheetJS) est importé côté serveur uniquement.
  experimental: {
    serverComponentsExternalPackages: ["xlsx"],
  },
};

export default nextConfig;
