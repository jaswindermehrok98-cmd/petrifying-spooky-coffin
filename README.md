# Samrath Web — SEO phase / Vercel deployment

This repository hosts the complete Samrath Web Vite/React project in `.bundle/` as a compressed source package. The Vercel install hook safely extracts that package into the ignored `site/` directory and installs its dependencies. The build command then runs the project's own TypeScript, Vite and pre-render pipeline.

## Deploy on Vercel

1. Import this GitHub repository into Vercel.
2. Keep the repository root as the project root (`./`).
3. The checked-in `vercel.json` already sets the install command, build command and output directory.
4. Add `VITE_SITE_URL` in Vercel Production only if you want to override Vercel's production project domain with your actual connected custom domain.
5. Deploy. Preview builds from the bundled source use `noindex, nofollow`.

## Project source

The complete, human-readable Vite project is stored in `.bundle/part-*.b64` and can be reconstructed by running:

```bash
node scripts/extract-project.mjs --extract-only
```

That command extracts the project into `site/`. The Vercel install hook runs the same extractor and then installs the nested project's dependencies.

After extraction:

```bash
cd site
npm run typecheck
npm run build
npm run preview
```

See `site/SEO-AND-LAUNCH.md` for Search Console, sitemap, canonical-domain and content launch steps.

## Important

The repository was empty before this initialization. The bootstrap keeps the full website payload in one reproducible source bundle. The generated `site/` directory is ignored; edit the project after extraction, then update the source bundle if you intend to rebuild from a fresh Vercel checkout.
