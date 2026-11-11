import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/Root.ts',
    'src/Stack.ts',
    'src/Storage.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: ['effect', 'react', 'react-native', 'tea-effect'],
})
