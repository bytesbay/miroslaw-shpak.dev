// Build-time HTML rendering. Everything a recruiter or crawler needs is plain HTML.
import {
  SITE, HERO, STATS, ABOUT, STACK, STACK_NOTE, APPROACH, CAREER, OPEN_SOURCE, AI_STACK,
  CONTACT, INTERESTS, EDUCATION, LANGUAGES, MOTTO, DOMAINS, CHAPTERS,
} from './content'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ext = (href: string, label: string, cls = '') =>
  `<a href="${href}"${cls ? ` class="${cls}"` : ''} target="_blank" rel="noopener">${esc(label)}</a>`

export type Stars = Record<string, number>

const icon = {
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m3 7 9 6 9-6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5.1c0-1.22-.02-2.79-1.7-2.79-1.7 0-1.96 1.33-1.96 2.7V21h-4z"/></svg>',
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.94 4.3 18.9 19.1c-.22 1-.82 1.24-1.66.77l-4.6-3.4-2.22 2.14c-.25.25-.45.45-.93.45l.33-4.7 8.56-7.73c.37-.33-.08-.52-.58-.19L7.2 13.1 2.66 11.7c-.99-.31-1-.99.2-1.46L20.6 3.4c.82-.3 1.54.2 1.34.9Z"/></svg>',
}

export const LOGO = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="lg" cx="30%" cy="10%" r="110%"><stop offset="0" stop-color="#ff2a75"/><stop offset="1" stop-color="#3a0a5e"/></radialGradient></defs><path fill="url(#lg)" d="M32 4C20 4 12 14 7 26l-5 12h9l5-12c3-8 9-13 16-13s13 5 16 13l5 12h9l-5-12C52 14 44 4 32 4Z"/><path fill="url(#lg)" d="M3 42h10v4H3zm48 0h10v4H51zM3 50h12v4H3zm46 0h12v4H49zM8 58h48v3H8z"/><text x="32" y="44" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="700" font-size="17" fill="#fff">MS</text></svg>`

/* ---------------------------------------------------------------- story */

function stage(id: string, inner: string, cls = '') {
  return `<div class="stage"><div class="panel panel-${id}${cls ? ' ' + cls : ''}">${inner}</div></div>`
}

function hero() {
  return stage('hello', `
      <p class="eyebrow">${esc(HERO.eyebrow)}</p>
      <h1>Miroslaw Shpak</h1>
      <p class="lead">${esc(HERO.lead)}</p>
      <div class="cta">
        <a class="btn btn-primary" href="#contact" data-go="contact">Get in touch</a>
        <a class="btn" href="/cv/">Read the CV</a>
      </div>`)
}

function about() {
  const stats = STATS.map(
    (s) => `<li><b>${esc(s.value)}${s.unit ? `<small> ${esc(s.unit)}</small>` : ''}</b><span>${esc(s.label)}</span></li>`,
  ).join('')
  return stage('about', `
      <p class="kicker">01 · About</p>
      <h2>I own the hard parts and still write the code</h2>
      <p>${esc(ABOUT)}</p>
      <ul class="stats">${stats}</ul>`)
}

function stack() {
  const groups = STACK.map(
    (g) => `<div class="group"><h3>${esc(g.group)}</h3><ul class="chips">${g.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`,
  ).join('')
  return stage('stack', `
      <p class="kicker">02 · Stack</p>
      <h2>What I work with</h2>
      <div class="groups">${groups}</div>
      <p class="note">${esc(STACK_NOTE)}</p>`)
}

function approach() {
  const items = APPROACH.map(
    (a, i) => `<li><span class="idx">0${i + 1}</span><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p></li>`,
  ).join('')
  return stage('approach', `
      <p class="kicker">03 · How I work <span class="telemetry" aria-hidden="true">warp <i data-warp>0.00</i> c</span></p>
      <h2>How I work</h2>
      <ol class="approach">${items}</ol>
      <p class="note motto">${esc(MOTTO)}</p>`)
}

function roleArticle(r: (typeof CAREER)[number], level = 3) {
  const h = `h${level}`
  return `<article class="role-card" itemscope itemtype="https://schema.org/OrganizationRole">
        <p class="period"><time>${esc(r.period)}</time> · ${esc(r.place)}</p>
        <${h} itemprop="roleName">${esc(r.role)}</${h}>
        <p class="company" itemprop="name">${esc(r.company)}</p>
        <p>${esc(r.summary)}</p>
        ${r.points ? `<ul>${r.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        ${r.stack ? `<p class="stack-line">${esc(r.stack)}</p>` : ''}
        ${r.link ? `<p class="role-link">${ext(r.link.href, r.link.label + ' ↗')}</p>` : ''}
      </article>`
}

function career() {
  const roles = CAREER.map(
    (r, i) => `<li class="role" data-i="${i}" id="career-${r.id}">${roleArticle(r)}</li>`,
  ).join('')
  const dots = CAREER.map((r, i) => `<li data-i="${i}"><span>${esc(r.period.split(' – ')[0].replace(/^\w+ /, ''))}</span></li>`).join('')
  return `<div class="stage"><div class="panel panel-career">
      <p class="kicker">04 · Career</p>
      <h2>Career orbit</h2>
      <ol class="roles">${roles}</ol>
      <ol class="orbit-dots" aria-hidden="true">${dots}</ol>
    </div></div>`
}

function openSource(stars: Stars) {
  const items = OPEN_SOURCE.map((p) => {
    const n = stars[p.repo] ?? p.stars
    return `<li><a href="${p.href}" target="_blank" rel="noopener"><span class="os-name">${esc(p.name)}</span><span class="os-stars" aria-label="${n} GitHub stars">★ ${n}</span><span class="os-text">${esc(p.text)}</span></a></li>`
  }).join('')
  return stage('open-source', `
      <p class="kicker">05 · Open source</p>
      <h2>Things I give away</h2>
      <ul class="os">${items}</ul>
      <p class="note">${esc(AI_STACK)}</p>`)
}

function contactLinks() {
  return `<ul class="contacts">
        <li><a href="mailto:${SITE.email}">${icon.mail}<span>${SITE.email}</span></a></li>
        <li>${`<a href="${SITE.links.linkedin}" target="_blank" rel="noopener me">${icon.linkedin}<span>LinkedIn</span></a>`}</li>
        <li>${`<a href="${SITE.links.github}" target="_blank" rel="noopener me">${icon.github}<span>GitHub</span></a>`}</li>
        <li>${`<a href="${SITE.links.telegram}" target="_blank" rel="noopener me">${icon.telegram}<span>Telegram</span></a>`}</li>
      </ul>`
}

function contact() {
  return stage('contact', `
      <p class="kicker">06 · Contact</p>
      <h2>Let's build something</h2>
      <p class="lead">${esc(CONTACT.lead)}</p>
      <p>${esc(CONTACT.details)}</p>
      ${contactLinks()}
      <p class="cta"><a class="btn" href="/cv/">Full CV, printable</a></p>`)
}

const LENS: Record<string, number> = {
  hello: 0, about: 1, stack: 1, approach: 1.2, career: CAREER.length * 0.9, 'open-source': 1, contact: 1,
}

export function renderStory(stars: Stars) {
  const parts: Record<string, string> = {
    hello: hero(), about: about(), stack: stack(), approach: approach(),
    career: career(), 'open-source': openSource(stars), contact: contact(),
  }
  return CHAPTERS.map(
    (c) => `<section id="${c.id}" class="ch ch-${c.id}" data-len="${LENS[c.id]}" style="--len:${LENS[c.id]}" data-label="${esc(c.label)}" aria-label="${esc(c.label)}">${parts[c.id]}</section>`,
  ).join('\n')
}

export function renderNav() {
  return CHAPTERS.filter((c) => c.id !== 'hello')
    .map((c) => `<a href="#${c.id}" data-go="${c.id}">${esc(c.label === 'Transit' ? 'How I work' : c.label)}</a>`)
    .join('')
}

export function renderFooter() {
  return `<footer class="foot">
    <p>${esc(MOTTO)} Built from scratch with three.js, hosted on Cloudflare. ${ext(SITE.repo, 'Source on GitHub')}.</p>
    <p>© ${new Date().getFullYear()} Miroslaw Shpak · <a href="/cv/">CV</a></p>
  </footer>`
}

/* ---------------------------------------------------------------- head / SEO */

export function jsonLd(page: 'home' | 'cv') {
  const person = {
    '@type': 'Person',
    '@id': `${SITE.url}/#person`,
    name: SITE.name,
    alternateName: SITE.alternateNames,
    givenName: 'Miroslaw',
    familyName: 'Shpak',
    jobTitle: SITE.jobTitle,
    description: SITE.description,
    url: SITE.url + '/',
    image: `${SITE.url}/og.png`,
    email: `mailto:${SITE.email}`,
    address: { '@type': 'PostalAddress', addressLocality: SITE.location.city, addressCountry: SITE.location.country },
    homeLocation: { '@type': 'Place', name: `${SITE.location.city}, ${SITE.location.countryName}` },
    nationality: { '@type': 'Country', name: 'Ukraine' },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Odesa Polytechnic National University' },
    knowsLanguage: ['en', 'uk', 'ru'],
    knowsAbout: [
      'TypeScript', 'Node.js', 'Solidity', 'Rust', 'Smart contracts', 'EVM', 'Solana', 'DeFi', 'Onchain betting',
      'Prediction markets', 'AI agents', 'Agentic Ops', 'Model Context Protocol', 'Kubernetes', 'Three.js', 'WebGL', 'GLSL',
      'React', 'Next.js', 'Vue', 'Nuxt', 'NestJS', 'MongoDB', 'PostgreSQL', 'Software architecture', 'Engineering leadership',
    ],
    hasOccupation: {
      '@type': 'Occupation',
      name: 'Chief Technology Officer',
      occupationLocation: { '@type': 'City', name: 'Wrocław' },
      skills: 'TypeScript, Solidity, Rust, Node.js, Kubernetes, AI agents, Web3',
    },
    sameAs: [SITE.links.linkedin, SITE.links.github, SITE.links.telegram, SITE.links.devto, SITE.links.hashnode],
  }
  const graph: unknown[] = [
    {
      '@type': 'ProfilePage',
      '@id': `${SITE.url}${page === 'cv' ? '/cv/' : '/'}#page`,
      url: `${SITE.url}${page === 'cv' ? '/cv/' : '/'}`,
      name: page === 'cv' ? `${SITE.name} CV` : SITE.title,
      dateModified: new Date().toISOString().slice(0, 10),
      mainEntity: { '@id': `${SITE.url}/#person` },
      inLanguage: 'en',
    },
    person,
    { '@type': 'WebSite', '@id': `${SITE.url}/#site`, url: SITE.url + '/', name: SITE.name, inLanguage: 'en' },
  ]
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`
}

export function head(page: 'home' | 'cv') {
  const url = page === 'cv' ? `${SITE.url}/cv/` : `${SITE.url}/`
  const title = page === 'cv' ? 'Miroslaw Shpak · CV · CTO & Senior Software Engineer' : SITE.title
  const desc =
    page === 'cv'
      ? 'CV of Miroslaw Shpak: hands-on CTO and senior software engineer. TypeScript, Solidity, Rust, Kubernetes and AI agents. Wrocław, Poland. Open to Staff, Tech Lead and CTO roles.'
      : SITE.description
  return `
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta name="author" content="Miroslaw Shpak">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="theme-color" content="#07060c">
  <meta name="color-scheme" content="dark">
  <meta property="og:type" content="profile">
  <meta property="profile:first_name" content="Miroslaw">
  <meta property="profile:last_name" content="Shpak">
  <meta property="profile:username" content="bytesbay">
  <meta property="og:site_name" content="Miroslaw Shpak">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${SITE.url}/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Miroslaw Shpak, hands-on CTO. A shuttle over a low-poly planet.">
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${SITE.url}/og.png">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="me" href="${SITE.links.github}">
  <link rel="me" href="${SITE.links.linkedin}">
  ${jsonLd(page)}`
}

/* ---------------------------------------------------------------- CV page */

export function renderCv(stars: Stars) {
  const roles = CAREER.map((r) => `<li>${roleArticle(r, 3)}</li>`).join('')
  const domains = DOMAINS.map(([d, y, w]) => `<tr><th scope="row">${esc(d)}</th><td>${esc(y)}</td><td>${esc(w)}</td></tr>`).join('')
  const stack = STACK.map((g) => `<p><b>${esc(g.group)}:</b> ${esc(g.items.join(', '))}</p>`).join('')
  const os = OPEN_SOURCE.map((p) => {
    const n = stars[p.repo] ?? p.stars
    return `<li><a href="${p.href}" target="_blank" rel="noopener">${esc(p.name)}</a> (★ ${n}). ${esc(p.text)}</li>`
  }).join('')
  const stats = STATS.map((s) => `<li><b>${esc(s.value)}${s.unit ? ' ' + esc(s.unit) : ''}</b> ${esc(s.label)}</li>`).join('')
  return `
  <header class="cv-head">
    <div>
      <h1>Miroslaw Shpak</h1>
      <p class="cv-title">Hands-on CTO & Co-founder · Senior Software Engineer</p>
      <p class="cv-meta">Wrocław, Poland · <a href="mailto:${SITE.email}">${SITE.email}</a> · <a href="${SITE.links.linkedin}" rel="me">linkedin.com/in/miroslaw-shpak</a> · <a href="${SITE.links.github}" rel="me">github.com/bytesbay</a> · <a href="${SITE.url}/">miroslaw-shpak.dev</a></p>
    </div>
    <p class="cv-actions no-print"><a class="btn" href="/">← 3D version</a> <button class="btn btn-primary" type="button" onclick="print()">Save as PDF</button></p>
  </header>
  <section aria-labelledby="sum"><h2 id="sum">Summary</h2>
    <p>${esc(ABOUT)}</p>
    <ul class="cv-stats">${stats}</ul>
    <p>${esc(CONTACT.lead)} ${esc(CONTACT.details)}</p>
  </section>
  <section aria-labelledby="exp"><h2 id="exp">Experience</h2><ol class="cv-roles">${roles}</ol></section>
  <section aria-labelledby="how"><h2 id="how">How I work</h2>${APPROACH.map((a) => `<p><b>${esc(a.title)}.</b> ${esc(a.text)}</p>`).join('')}</section>
  <section aria-labelledby="dom"><h2 id="dom">Domain experience</h2>
    <table class="cv-table"><thead><tr><th scope="col">Domain</th><th scope="col">Experience</th><th scope="col">Work</th></tr></thead><tbody>${domains}</tbody></table>
    <p class="small">Approximate, periods overlap.</p>
  </section>
  <section aria-labelledby="stk"><h2 id="stk">Engineering toolkit</h2>${stack}</section>
  <section aria-labelledby="oss"><h2 id="oss">Open source & AI stack</h2><ul>${os}</ul><p>${esc(AI_STACK)}</p></section>
  <section aria-labelledby="edu"><h2 id="edu">Education & languages</h2><p>${esc(EDUCATION)}</p><p>${esc(LANGUAGES)}</p></section>
  <section aria-labelledby="int"><h2 id="int">Interests</h2><p>${esc(INTERESTS.join(' · '))}</p><p>${esc(MOTTO)}</p></section>`
}

export function llmsTxt(stars: Stars) {
  const roles = CAREER.map((r) => `- ${r.role}, ${r.company} (${r.period}, ${r.place}). ${r.summary}${r.points ? ' ' + r.points.join(' ') : ''}`).join('\n')
  return `# Miroslaw Shpak

> ${SITE.description}

Website: ${SITE.url}/ · CV: ${SITE.url}/cv/ · Email: ${SITE.email}
LinkedIn: ${SITE.links.linkedin} · GitHub: ${SITE.links.github}
Also known as: ${SITE.alternateNames.join(', ')}

## Summary
${ABOUT}

${STATS.map((s) => `- ${s.value}${s.unit ? ' ' + s.unit : ''}: ${s.label}`).join('\n')}

## Looking for
${CONTACT.lead} ${CONTACT.details}

## Experience
${roles}

## Stack
${STACK.map((g) => `- ${g.group}: ${g.items.join(', ')}`).join('\n')}

## Open source
${OPEN_SOURCE.map((p) => `- ${p.name} (${stars[p.repo] ?? p.stars} stars): ${p.text} ${p.href}`).join('\n')}

## Education and languages
${EDUCATION}. ${LANGUAGES}
`
}
