# Operations Guide

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

## One-off generation

```bash
npm run generate -- --subject "artisan coffee cup" --scene "window-lit cafe table" --preset product-shot --dryRun
```

## Batch generation

1. Edit `inputs/batch.json`
2. Run:
   ```bash
   npm run generate:batch
   ```

## GitHub Actions

- `CI` runs lint, focused tests, and a smoke test on push and pull requests.
- `Generate Image` supports manual dispatch and a daily schedule.
- Provide `FREEGEN_API_URL` and optionally `FREEGEN_API_KEY` as repository secrets.
