import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';
import fs from 'fs';
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { configDefaults, type UserConfig as VitestUserConfigInterface } from 'vitest/config';
import { crx, ManifestV3Export } from '@crxjs/vite-plugin';

import manifest from './manifest.json';
import devManifest from './manifest.dev.json';
import pkg from './package.json';


const vitestConfig: VitestUserConfigInterface = {
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests-setup.ts',
    coverage: {
      provider: 'istanbul',
      exclude: [
        ...configDefaults.exclude,
        'src/global.d.ts',
        'src/vite-env.d.ts',
        'src/pages/mock/**',
        'src/assets/**',
        'src/pages/background/**',
        'src/pages/content/index.tsx',
        '**tailwind.config.cjs',
        '**postcss.config.cjs',
        'src/pages/newtab/**',
        'src/pages/options/**',
        'src/pages/devtools/**',
        'src/pages/panel/**',
      ]
    }
  }
};


const root = resolve(__dirname, 'src');
const pagesDir = resolve(root, 'pages');
const assetsDir = resolve(root, 'assets');
const outDir = resolve(__dirname, 'dist');
const publicDir = resolve(__dirname, 'public');

const isDev = process.env.__DEV__ === 'true';

const extensionManifest = {
  ...manifest,
  ...(isDev ? devManifest : {} as ManifestV3Export),
  name: isDev ? `DEV: ${ manifest.name }` : manifest.name,
  version: pkg.version,
};

// plugin to remove dev icons from prod build
function stripDevIcons (apply: boolean) {
  if (apply) return null

  return {
    name: 'strip-dev-icons',
    resolveId (source: string) {
      return source === 'virtual-module' ? source : null
    },
    renderStart (outputOptions: any, inputOptions: any) {
      const outDir = outputOptions.dir
      fs.rm(resolve(outDir, 'dev-icon-32.png'), () => console.log(`Deleted dev-icon-32.png frm prod build`))
      fs.rm(resolve(outDir, 'dev-icon-128.png'), () => console.log(`Deleted dev-icon-128.png frm prod build`))
      fs.rm(resolve(outDir, 'followers_data_v1.ts'), () => console.log(`Deleted followers_data_v1.ts frm prod build`))
      fs.rm(resolve(outDir, 'followers_data_v2.ts'), () => console.log(`Deleted followers_data_v2.ts frm prod build`))
      fs.rm(resolve(outDir, 'followers_data_v3.ts'), () => console.log(`Deleted followers_data_v3.ts frm prod build`))
    }
  }
}

export default defineConfig(() => ({
  resolve: {
    alias: {
      '@src': root,
      '@assets': assetsDir,
      '@pages': pagesDir,
    },
  },
  plugins: [
    react(),
    crx({
      manifest: extensionManifest as ManifestV3Export,
      contentScripts: {
        injectCss: true,
      }
    }),
    stripDevIcons(isDev)
  ],
  test: vitestConfig.test,
  publicDir,
  build: {
    outDir,
    sourcemap: isDev,
    emptyOutDir: !isDev
  }
}));
