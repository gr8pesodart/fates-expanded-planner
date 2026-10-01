import { defineConfig } from 'vitest/config'

// `npm run audit:skills`: slow exhaustive checks kept out of `npm test`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tools/audit/**/*.audit.ts'],
    testTimeout: 600_000,
  },
})
