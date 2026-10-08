import { fileURLToPath } from 'node:url'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server for the Docker image (copied from .next/standalone).
  output: 'standalone',
  // Monorepo: trace dependencies from the repository root so workspace packages are bundled.
  outputFileTracingRoot: fileURLToPath(new URL('..', import.meta.url)),
  // @agriminds/api-types ships TypeScript source.
  transpilePackages: ['@agriminds/api-types'],
  images: { unoptimized: true },
}

export default withNextIntl(nextConfig)
