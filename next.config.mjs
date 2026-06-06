/** @type {import('next').NextConfig} */
const nextConfig = {

  serverExternalPackages: [
    "mongoose",
    "csv-parser",
    "xlsx",
  ],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  env: {
    JWT_SECRET: process.env.JWT_SECRET,
  },
};

export default nextConfig;