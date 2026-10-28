import * as esbuild from 'esbuild'
await esbuild.build({ 
  entryPoints: ['src/index.ts'],
  platform: 'node',
  bundle: true,
  outdir: './dist',
  sourcemap: 'linked',
  target: 'node24',
  minifySyntax:false,
  format: 'esm',
  external: ['node'],
    // ✅ This injects the missing 'require' into the ESM output
  banner: {
    js: `#!/usr/bin/env node
import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },  
})
console.log('build done') 