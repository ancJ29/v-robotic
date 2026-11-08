# v-robotic

pnpm monorepo: `cms/` (Strapi 5) and `web/` (Astro). Plan and architecture in `docs/`; scaffold conventions in `docs/conventions/scaffold.md`.

```
nvm use && pnpm install
cp cms/.env.example cms/.env   # then put real secrets in it
pnpm dev                       # Strapi on :1337, Astro on :5173
```
