// Single source of truth for all page copy. Rendered to static HTML at build time.
// Public material: studio project names stay under NDA (see job-search/AGENTS.md).

export const SITE = {
  url: 'https://miroslaw-shpak.dev',
  name: 'Miroslaw Shpak',
  alternateNames: ['Mirosław Shpak', 'Myroslav Shpak', 'Мирослав Шпак', 'bytesbay'],
  title: 'Miroslaw Shpak | Hands-on CTO, Web3 & AI Agents Engineer',
  description:
    'Miroslaw Shpak, hands-on CTO and software engineer in Wrocław, Poland. 11 years shipping Web3, onchain betting and AI agent products with TypeScript, Solidity and Rust.',
  jobTitle: 'CTO & Co-founder, Software Engineer',
  location: { city: 'Wrocław', country: 'PL', countryName: 'Poland' },
  email: 'bytesbay@icloud.com',
  links: {
    linkedin: 'https://www.linkedin.com/in/miroslaw-shpak/',
    github: 'https://github.com/bytesbay',
    telegram: 'https://t.me/bytesbay',
    devto: 'https://dev.to/bytesbay',
    hashnode: 'https://hashnode.com/@bytesbay',
  },
  repo: 'https://github.com/bytesbay/miroslaw-shpak.dev',
}

export const HERO = {
  eyebrow: 'CTO · Product engineer · Wrocław, Poland',
  lead:
    'I take products from the first idea to production: smart contracts, backends, infrastructure and the teams behind them. These days that means onchain betting and AI agents running in production.',
}

export const STATS = [
  { value: '11', unit: 'years', label: 'in commercial software, coding since 15' },
  { value: '$13.75M', unit: '', label: 'raised by projects I helped build' },
  { value: '$30M', unit: '', label: 'peak TVL of a DeFi protocol I designed and built' },
  { value: '2', unit: 'acquired', label: 'companies I helped build, one successful exit' },
  { value: '20', unit: 'people', label: 'largest team I have led' },
]

export const ABOUT =
  'Hands-on CTO with 11 years of commercial development. I lead teams and still write a lot of the code myself. Most of my work joins onchain and offchain systems: contracts, indexers, relayers, backends and the apps around them. I also care how things look, so design and branding usually end up on my desk too.'

export const STACK: { group: string; items: string[] }[] = [
  { group: 'Languages', items: ['TypeScript', 'Solidity', 'Rust', 'C/C++ from the good old days'] },
  { group: 'Backend', items: ['Node.js', 'Bun', 'NestJS', 'Hono', 'MongoDB', 'PostgreSQL', 'Redis', 'RabbitMQ'] },
  { group: 'Web3', items: ['EVM', 'Foundry', 'viem / wagmi', 'ERC-4337', 'Chainlink', 'Solana', 'BRC-20 / Ordinals', 'TON'] },
  { group: 'Frontend & 3D', items: ['React / Next.js', 'Vue / Nuxt', 'Three.js', 'GLSL', 'Unity', 'Unreal Engine'] },
  { group: 'Infrastructure', items: ['Kubernetes', 'Helm', 'werf', 'ArgoCD', 'Docker', 'GitHub Actions', 'AWS', 'GCP'] },
  { group: 'AI', items: ['Claude', 'OpenAI', 'MCP', 'Tool calling', 'Multi-agent orchestration', 'RAG'] },
]

export const STACK_NOTE = 'I love making something beautiful with GLSL shaders. The page you are scrolling is one of them.'

export const APPROACH = [
  {
    title: 'Idea to production',
    text: 'I like imagining products and building them all the way: architecture, contracts, backend, infrastructure, hiring. I also contribute to design and branding, and I have opinions there too.',
  },
  {
    title: 'Small teams, real load',
    text: 'The onchain betting platform I run as CTO was built by three programmers. Its custom relayer can send 2,000+ transactions a minute and tops up its own gas.',
  },
  {
    title: 'Agents in production',
    text: 'AI agents handle risk monitoring and the settlement of complex betting cases, flag production issues that regular monitoring misses, and let marketing and management get data without asking developers.',
  },
]

export type Role = {
  id: string
  company: string
  role: string
  period: string
  place: string
  summary: string
  points?: string[]
  stack?: string
  link?: { href: string; label: string }
}

export const CAREER: Role[] = [
  {
    id: 'studio',
    company: 'Crypto Venture Studio (NDA)',
    role: 'CTO & Co-founder',
    period: 'Aug 2023 – Present',
    place: 'Remote',
    summary:
      'A venture group building betting, exchange and DeFi products, plus onchain infrastructure for enterprise clients. I own smart contracts, backend, infrastructure and hiring.',
    points: [
      'Onchain DFS betting: CTO with every technical decision on me. Wrote the whole backend, a custom relayer and AI agents for risk and settlement. Raised $2.5M.',
      'Non-custodial yield protocol on Base: my product idea and architecture. About $30M peak TVL with funds among users. Acquired by a leading DEX.',
      'Early BRC-20 / Ordinals exchange: co-authored the idea, designed the architecture, led the team. Raised $8M.',
      'AI chat for swaps in 2023 on GPT-3.5 Turbo, about 1,000 DAU at peak. Co-CTO for infrastructure, backend and fine-tuning.',
    ],
    stack: 'TypeScript, Solidity/Foundry, Rust, Next.js, Hono, MongoDB, Kubernetes',
  },
  {
    id: 'defish',
    company: 'World of Defish / Poolz Finance',
    role: 'CTO',
    period: 'Oct 2021 – Aug 2023',
    place: 'Odesa',
    summary:
      'A DeFi/NFT game with a hybrid onchain/offchain economy. I designed the architecture from scratch when onchain games had few good examples, then built and led a 15-person team.',
    points: [
      'Shipped web and Unity games, an NFT marketplace, staking, a custom relayer and audited contracts.',
      '$3M raised, 30K users, about 1K weekly active, $500K+ TVL. The WOD token passed $10M in daily trading volume.',
      'Delivered the roadmap through the crypto winter and the start of the war. World of Defish was acquired after almost two years.',
    ],
    stack: 'TypeScript/NestJS, Vue/Nuxt, React, Solidity/Hardhat, Three.js, GLSL, C#/Unity',
  },
  {
    id: 'shuttle',
    company: 'Shuttle Software',
    role: 'Founder & CTO',
    period: 'Nov 2020 – Oct 2021',
    place: 'Los Angeles',
    summary:
      'My own studio building dApps, NFT and DeFi products for US clients. I built its 3D website from scratch, and this site grew out of it.',
    points: ['Also co-founded B2D (part-time, 2021): an outstaff platform for hiring, hourly billing and contracts. Still running.'],
    link: { href: 'https://shuttlesoftware.com', label: 'shuttlesoftware.com' },
  },
  {
    id: 'smart-fertilizer',
    company: 'Smart Fertilizer / Yellow Brick Technologies',
    role: 'Technical Lead',
    period: 'Aug 2019 – Jan 2021',
    place: 'London, remote',
    summary:
      'Led a 20-person team modernizing a scientific agtech platform. The calculation core was 25-year-old Visual Basic that could not be rewritten, so I wrapped it in an API and split the product into microservices that matched the team: Vue/Laravel, .NET and Node.js.',
    points: ['Worked with scientists on soil analysis, sensor data and satellite imagery.'],
  },
  {
    id: 'coelix',
    company: 'Coelix',
    role: 'Head Software Architect',
    period: 'Sep 2018 – Aug 2019',
    place: 'Odesa',
    summary:
      'Systems for Israeli clients: Laravel apps that held peaks of 50K+ concurrent users after Instagram campaigns, Vue visual builders, React Native apps and the infrastructure. My first distributed systems, with a team of 5.',
  },
  {
    id: 'quarnuts',
    company: 'Quarnuts',
    role: 'Full-stack Developer',
    period: 'Jun 2016 – Aug 2018',
    place: 'Odesa',
    summary:
      'Systems for large Ukrainian companies on Vue, Laravel, WordPress and Drupal. Also C++ in Unreal Engine 4 for a VR apartment showroom for Foxtrot.',
  },
  {
    id: 'early',
    company: 'Agroinvestgroup & freelance',
    role: 'C/C++ and web developer',
    period: '2012 – 2016',
    place: 'Odesa',
    summary:
      'Started getting paid for code at 15. Six months of C/C++ for STM32 controllers in an agricultural sorting terminal, and freelance web work on WordPress, Drupal and Laravel.',
  },
]

export const OPEN_SOURCE = [
  {
    name: 'web3-token',
    repo: 'bytesbay/web3-token',
    href: 'https://github.com/bytesbay/web3-token',
    text: 'Wallet sign-in for dApps through signed messages, EIP-4361.',
    stars: 368,
  },
  {
    name: 'chain-syncer',
    repo: 'bytesbay/chain-syncer',
    href: 'https://github.com/bytesbay/chain-syncer',
    text: 'Keeps an app in sync with EVM contracts in real time. A lighter alternative to The Graph for dApp backends.',
    stars: 25,
  },
  {
    name: 'PI-GPUI',
    repo: 'bytesbay/pi-gpui',
    href: 'https://pi-gpui.dev',
    text: 'An editor I built for pi coding agent users. Yes, you can call it niche.',
    stars: 6,
  },
]

export const AI_STACK =
  'My own setup: pi with PI-GPUI, mostly Claude for code and design, OpenAI for research and code review. Technical writing on dev.to and Hashnode as @bytesbay.'

export const CONTACT = {
  lead:
    'Open to Senior/Staff Engineer, Tech Lead and CTO roles. Betting, Web3/DeFi and AI infrastructure first, fintech and SaaS too. Remote, hybrid or on-site, and open to relocation.',
  details: 'Based in Wrocław, Poland. Polish JDG for long-term B2B, full-time employment works as well.',
}

export const INTERESTS = [
  'Agentic Ops',
  'Military tech (served as a sergeant in the Armed Forces of Ukraine in 2024)',
  'Betting and prediction markets',
  'Blockchain',
  'AR/VR, shaders and games',
]

export const EDUCATION = 'BSc in Computer Science, Odesa Polytechnic National University, 2017–2019'
export const LANGUAGES = 'English C2. Ukrainian and Russian native.'
export const MOTTO = 'Giterminism and transparency cultist.'

export const DOMAINS = [
  ['Blockchain / DeFi', '5 years', 'EVM and Solana contracts, exchanges, non-custodial protocols, relayers and indexers.'],
  ['Betting', '1 year', 'Onchain betting, settlement, risk management, vault security, operations automation.'],
  ['Gamedev', '2 years', 'Web and Unity games, NFT marketplaces, Three.js and GLSL.'],
  ['Agtech', '1.5 years', 'Scientific calculations, soil analysis, sensors and satellite imagery.'],
  ['Hardware / IoT', '6 months', 'C/C++ for STM32 controllers.'],
  ['AI / Agentic Ops', 'In production', 'Monitoring, risk, settlement and internal tools with MCP and RAG. Agents in CI/CD for tests, deploys and post-deploy checks.'],
]

// Story chapters in scroll order. `len` is sticky length in viewport heights.
export const CHAPTERS = [
  { id: 'hello', label: 'Hello' },
  { id: 'about', label: 'About' },
  { id: 'stack', label: 'Stack' },
  { id: 'approach', label: 'Transit' },
  { id: 'career', label: 'Career' },
  { id: 'open-source', label: 'Open source' },
  { id: 'contact', label: 'Contact' },
] as const
