import { config, assertFreegenConfigured } from '../config.js';
import { ProviderError } from '../errors.js';
import { downloadFile } from '../utils/fileUtils.js';
import { withRetry } from '../services/retryService.js';

const extractRemoteUrl = (payload) => payload?.imageUrl
  || payload?.url
  || payload?.data?.imageUrl
  || payload?.data?.url
  || payload?.output?.[0]
  || null;

const sanitizeResponse = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  return JSON.parse(JSON.stringify(payload, (key, value) => {
    if (typeof value === 'string' && value.length > 500) {
      return `${value.slice(0, 500)}...[truncated]`;
    }

    return value;
  }));
};

const parseErrorMessage = (payload, fallback) => payload?.error?.message
  || payload?.message
  || payload?.detail
  || fallback;

const isRetryable = (error) => error instanceof ProviderError
  && (error.statusCode === 429 || error.statusCode >= 500 || error.code === 'PROVIDER_TIMEOUT');

export class FreegenProvider {
  async generateImage({ prompt, size, seed, steps, cfg, model }) {
    assertFreegenConfigured();

    const requestBody = {
      prompt,
      size: size || config.freegen.defaultSize,
      steps: steps ?? config.freegen.defaultSteps,
      cfg: cfg ?? config.freegen.defaultCfg,
      ...(seed !== undefined ? { seed } : {}),
      ...(model ? { model } : {}),
    };

    return withRetry(async () => {
      let response;
      try {
        response = await fetch(config.freegen.apiUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(config.freegen.apiKey ? { 'x-api-key': config.freegen.apiKey } : {}),
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(config.freegen.timeoutMs),
        });
      } catch (error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
          throw new ProviderError('Freegen request timed out.', {
            statusCode: 504,
            code: 'PROVIDER_TIMEOUT',
            details: { provider: 'freegen' },
            cause: error,
          });
        }

        throw new ProviderError('Unable to reach Freegen.', {
          statusCode: 502,
          details: { provider: 'freegen' },
          cause: error,
        });
      }

      const requestId = response.headers.get('x-request-id') || response.headers.get('request-id') || null;
      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        let errorPayload;
        try {
          errorPayload = contentType.includes('application/json') ? await response.json() : { message: await response.text() };
        } catch {
          errorPayload = null;
        }

        throw new ProviderError(parseErrorMessage(errorPayload, `Freegen request failed with status ${response.status}.`), {
          statusCode: response.status,
          details: {
            provider: 'freegen',
            requestId,
            response: sanitizeResponse(errorPayload),
          },
        });
      }

      if (contentType.startsWith('image/')) {
        const binaryBuffer = Buffer.from(await response.arrayBuffer());
        return {
          binaryBuffer,
          remoteImageUrl: null,
          requestSummary: {
            size: requestBody.size,
            steps: requestBody.steps,
            cfg: requestBody.cfg,
            model: requestBody.model || null,
            seed: requestBody.seed ?? null,
          },
          responseSummary: {
            status: response.status,
            requestId,
            contentType,
            received: 'binary',
          },
          rawResponse: {
            status: response.status,
            requestId,
            contentType,
            received: 'binary',
          },
        };
      }

      const payload = contentType.includes('application/json') ? await response.json() : { message: await response.text() };
      const remoteImageUrl = extractRemoteUrl(payload);
      const base64Image = payload?.imageBase64 || payload?.data?.imageBase64 || null;

      let binaryBuffer = null;
      if (remoteImageUrl) {
        binaryBuffer = await downloadFile(remoteImageUrl, config.freegen.timeoutMs);
      } else if (base64Image) {
        binaryBuffer = Buffer.from(base64Image, 'base64');
      }

      if (!binaryBuffer) {
        throw new ProviderError('Freegen response did not include an image URL or binary data.', {
          statusCode: 502,
          details: {
            provider: 'freegen',
            requestId,
            response: sanitizeResponse(payload),
          },
        });
      }

      return {
        binaryBuffer,
        remoteImageUrl,
        requestSummary: {
          size: requestBody.size,
          steps: requestBody.steps,
          cfg: requestBody.cfg,
          model: requestBody.model || null,
          seed: requestBody.seed ?? null,
        },
        responseSummary: {
          status: response.status,
          requestId,
          contentType,
          received: remoteImageUrl ? 'remote-url' : 'base64-json',
        },
        rawResponse: sanitizeResponse(payload),
      };
    }, {
      retries: config.retry.maxRetries,
      baseDelayMs: config.retry.baseDelayMs,
      shouldRetry: isRetryable,
    });
  }
}
