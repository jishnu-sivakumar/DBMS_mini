/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // native ML runtime must stay outside the bundle
    serverComponentsExternalPackages: ['@huggingface/transformers', 'onnxruntime-node', 'sharp'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
