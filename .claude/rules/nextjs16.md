# Next.js 16 — do not trust training data

This repo runs Next.js 16 (Turbopack). APIs, conventions, and file structure differ from
what most training data assumes (this was true as of Next.js 13-15 era knowledge).

Before writing or editing any Next.js-specific code — routing (`src/app/**`), data fetching,
`next.config.ts`, middleware, metadata, caching — read the matching guide in
`node_modules/next/dist/docs/` first. Heed deprecation notices there over assumptions.

If a Next.js API you're about to use isn't confirmed against those docs, say so before writing
the code, rather than guessing from a pre-16 mental model.
