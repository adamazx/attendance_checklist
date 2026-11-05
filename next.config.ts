import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // Don't let `next dev` inject its agent-rules block into our committed AGENTS.md.
  agentRules: false,
  // Report PDFs embed the vendored Sarabun TTFs, read from disk at request time.
  outputFileTracingIncludes: {
    '/api/reports/**': ['./assets/fonts/sarabun/**'],
  },
  // pdfmake/pdfkit read their own data files with `fs`, so they must not be bundled.
  serverExternalPackages: ['pdfmake'],
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
