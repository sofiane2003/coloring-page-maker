# Coloring Page Maker

Describe a scene or character and get a printable black-and-white coloring page drawn by AI. Each member keeps their own pages and can share favorites in a gallery for the whole team.

Inspired by https://coloring-pages.shop

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Generate a coloring page from a short description, an age level and a page shape, then download, print or regenerate it.
- Browse your own pages to open, download, print, rename, delete or start a new page with the same settings.
- Share pages to a team gallery by theme, and search, filter, open and reuse what others shared.

Left out: credit packs and payments, generating from an uploaded picture, blog and marketing pages, other interface languages, and accounts and sign-in, which your Gateway handles.

## Setup

```sh
pnpm install
pnpm dev                  # run locally behind a local Gateway
pnpm test                 # unit tests
pnpm run deploy           # deploy to your Cloudflare account behind your Gateway
```

The release checks in `checks/` run against a built release with the oss.new runtime (`node checks/behavior.mjs`, `authorization.mjs`, `persistence.mjs`); they use a local stand-in for the image model.

Storage is created on deploy: a D1 database for the pages, an R2 bucket for the images and the account's Workers AI binding for drawing. R2 must be enabled on the Cloudflare account once.

One setting, filled in with its default on deploy:

- `DAILY_GENERATION_LIMIT` (default `25`): how many pages each member can generate per day (UTC).

## Limitations

- Pages are drawn with Workers AI (`@cf/bytedance/stable-diffusion-xl-lightning`), which is billed to your Cloudflare account and calls Cloudflare even under `pnpm dev`.
- The model sometimes adds gray fill or stray detail; regenerate to get another take.
- Deployment and real image generation were not exercised by the local checks.
