# ai-image-automation

A beginner-friendly Node.js repository for deterministic AI image generation workflows using **Freegen** as the default provider. It includes:

- Express API for prompt building and image generation
- Deterministic prompt assembly with style presets
- Local metadata, artifacts, and image outputs for reproducibility
- CLI scripts for one-off and batch runs
- GitHub Actions automation for manual and scheduled runs
- GitHub Codespaces-ready development setup

## Quick start

1. Copy `.env.example` to `.env` and set `FREEGEN_API_URL`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the API:
   ```bash
   npm run dev
   ```
4. Verify the server:
   ```bash
   curl http://localhost:3000/health
   ```

## Common commands

- `npm run dev` - start the development server with nodemon
- `npm start` - start the production-style server
- `npm test` - run focused Node.js tests
- `npm run generate -- --subject "robot barista" --scene "busy cafe" --preset cinematic --dryRun`
- `npm run generate:batch`
- `npm run smoke`

## Project structure

See `/docs/API.md`, `/docs/PROMPTS.md`, and `/docs/OPERATIONS.md` for usage details.
