import { defineConfig, type Plugin } from 'vite'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

// Content date for sitemap and structured data: the last commit, not the build time,
// so rebuilds without changes do not look like fresh content.
const lastModified = (() => {
  try { return execSync('git log -1 --format=%cs', { encoding: 'utf8' }).trim() } catch { return new Date().toISOString().slice(0, 10) }
})()
process.env.SITE_LASTMOD = lastModified
import { renderStory, renderNav, renderFooter, renderCv, head, llmsTxt, type Stars } from './src/render'
import { OPEN_SOURCE, SITE } from './src/content'

import { cloudflare } from "@cloudflare/vite-plugin";

// Live GitHub star counts at build time, falling back to the numbers in content.ts.
async function fetchStars(): Promise<Stars> {
  const out: Stars = {}
  try {
    const headers: Record<string, string> = { 'user-agent': 'miroslaw-shpak.dev' }
    if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    const r = await fetch('https://api.github.com/users/bytesbay', { signal: AbortSignal.timeout(4000), headers })
    if (r.ok) {
      const j = (await r.json()) as { followers?: number }
      if (typeof j.followers === 'number') out['followers:bytesbay'] = j.followers
    }
  } catch {}
  await Promise.all(
    OPEN_SOURCE.map(async (p) => {
      try {
        const ctl = AbortSignal.timeout(4000)
        const headers: Record<string, string> = { 'user-agent': 'miroslaw-shpak.dev' }
        if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
        const r = await fetch(`https://api.github.com/repos/${p.repo}`, { signal: ctl, headers })
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
      const today = lastModified
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url><loc>${SITE.url}/</loc><lastmod>${today}</lastmod><priority>1.0</priority><image:image><image:loc>${SITE.url}/og.png</image:loc></image:image></url>
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