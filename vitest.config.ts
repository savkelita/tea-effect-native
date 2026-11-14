import * as path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // react-native ships Flow source, which Node cannot load, and react-native-screens
  // needs it. Tests get doubles with the members src/ uses; `npm run typecheck` still
  // checks src/ against the real types.
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: path.resolve(__dirname, 'tests/testing/react-native.ts') },
      { find: /^react-native-screens$/, replacement: path.resolve(__dirname, 'tests/testing/react-native-screens.ts') },
    ],
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
})
