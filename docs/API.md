# API Reference

## `GET /health`
Returns service health, provider, timestamp, and app version.

## `POST /build-prompt`
Builds a deterministic prompt from structured input.

## `POST /create-image`
Creates a single image from structured fields or a prebuilt prompt. Supports `dryRun`.

## `POST /create-image/batch`
Processes generation tasks sequentially and returns a summary.

## `GET /history?limit=20`
Returns recent run summaries from the metadata index.

## `GET /history/:runId`
Returns the full metadata record for a specific run.

All responses use the shape:

```json
{
  "ok": true,
  "data": {}
}
```

Errors use:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": []
  }
}
```
