import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Cho phép build trong Docker không cần biến env thật
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'nodemailer'],
  },
}

export default nextConfig
