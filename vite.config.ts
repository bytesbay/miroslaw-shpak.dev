import { defineConfig, type Plugin } from 'vite'
import { resolve } from 'node:path'
import { renderStory, renderNav, renderFooter, renderCv, head, llmsTxt, type Stars } from './src/render'
import { OPEN_SOURCE, SITE } from './src/content'

import { cloudflare } from "@cloudflare/vite-plugin";

// Live GitHub star counts at build time, falling back to the numbers in content.ts.
async function fetchStars(): Promise<Stars> {
  const out: Stars = {}
  await Promise.all(
    OPEN_SOURCE.map(async (p) => {
      try {
        const ctl = AbortSignal.timeout(4000)
        const r = await fetch(`https://api.github.com/repos/${p.repo}`, { signal: ctl, headers: { 'user-agent': 'miroslaw-shpak.dev' } })
        if (r.ok) {
          const j = (await r.json()) as { stargazers_count?: number }
          if (typeof j.stargazers_count === 'number' && j.stargazers_count >= p.stars) out[p.repo] = j.stargazers_count
        }
      } catch {}
    }),
  )
  return out
}

function site(): Plugin {
  let stars: Stars = {}
  return {
    name: 'site-content',
    async buildStart() {
      stars = process.env.OFFLINE ? {} : await fetchStars()
    },
    transformIndexHtml(html, ctx) {
      const page = ctx.path.startsWith('/cv') ? 'cv' : 'home'
      return html
        .replace('<!--@head-->', head(page))
        .replace('<!--@story-->', renderStory(stars))
        .replace('<!--@nav-->', renderNav())
        .replace('<!--@footer-->', renderFooter())
        .replace('<!--@cv-->', renderCv(stars))
    },
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE.url}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>
  <url><loc>${SITE.url}/cv/</loc><lastmod>${today}</lastmod><priority>0.9</priority></url>
</urlset>
`,
      })
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llmsTxt(stars) })
    },
  }
}

export default defineConfig({
  plugins: [site(), cloudflare()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        cv: resolve(__dirname, 'cv/index.html'),
        notfound: resolve(__dirname, '404.html'),
      },
    },
  },
})