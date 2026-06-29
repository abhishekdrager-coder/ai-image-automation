import { config } from '../config.js';
import { ValidationError } from '../errors.js';
import { generateNarrationScript, scriptToSegments } from './scriptGenerationService.js';

function toSentence(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildScriptPrompt({ topic, audience, durationSec }) {
  return [
    `Write a video script for all social media platforms of ${durationSec} seconds on the topic - ${topic} and my target audience is ${audience}.`,
    'Write exactly what I should say on camera.',
    'Do not write like a director.',
    'Do not include scene directions, shot lists, section labels, titles, or commentary about visuals.',
    'Do not say Hook, Scene, Beat, Step, Director, or Camera.',
    'Use natural spoken language, short sentences, and a strong opening that sounds human.',
    'Make the script useful, direct, and easy to say out loud.',
    'Output only the spoken script text and nothing else.',
  ].join(' ');
}

function sanitizeScriptText(text) {
  return String(text || '')
    .replace(/```(?:text)?/gi, '')
    .replace(/```/g, '')
    .replace(/^\s*(title|audience|tone|scene|hook|step|beat|director|camera|shot)\s*:\s*.*$/gim, '')
    .replace(/^\s*[-*•]+\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function callAnthropic(prompt, modelName) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.script.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: config.script.maxTokens,
      temperature: config.script.temperature,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }],
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Anthropic request failed with status ${response.status}.`;
    throw new ValidationError(message, { code: 'SCRIPT_MODEL_ERROR', details: payload });
  }

  const content = Array.isArray(payload.content) ? payload.content : [];
  const text = content
    .map((item) => item?.text || '')
    .join('\n')
    .trim();

  if (!text) {
    throw new ValidationError('Anthropic response did not include script text.', { code: 'SCRIPT_MODEL_ERROR' });
  }

  return sanitizeScriptText(text);
}

async function callOpenAI(prompt, modelName) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.script.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      temperature: config.script.temperature,
      max_tokens: config.script.maxTokens,
      messages: [
        { role: 'user', content: prompt },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI request failed with status ${response.status}.`;
    throw new ValidationError(message, { code: 'SCRIPT_MODEL_ERROR', details: payload });
  }

  const text = payload?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new ValidationError('OpenAI response did not include script text.', { code: 'SCRIPT_MODEL_ERROR' });
  }

  return sanitizeScriptText(text);
}

function selectProvider(requestedProvider) {
  const normalized = toSentence(requestedProvider || config.script.provider || 'auto').toLowerCase();
  if (normalized === 'claude' || normalized === 'anthropic') {
    return 'anthropic';
  }
  if (normalized === 'gpt' || normalized === 'openai') {
    return 'openai';
  }
  return 'auto';
}

function inferProviderFromModel(modelName) {
  const normalized = toSentence(modelName).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.includes('claude')) {
    return 'anthropic';
  }

  if (normalized.includes('gpt') || normalized.startsWith('o1') || normalized.startsWith('o3') || normalized.startsWith('o4')) {
    return 'openai';
  }

  return null;
}

function selectModelName(provider, requestedModel) {
  const explicit = toSentence(requestedModel || '');
  if (explicit) {
    return explicit;
  }
  return provider === 'anthropic' ? config.script.anthropicModel : config.script.openaiModel;
}

async function generateFromModel(input) {
  const providerChoice = selectProvider(input.provider);
  const inferredProvider = inferProviderFromModel(input.model);
  const finalProviderChoice = providerChoice === 'auto' && inferredProvider
    ? inferredProvider
    : providerChoice;
  const prompt = buildScriptPrompt(input);

  const tryAnthropic = async () => {
    if (!config.script.anthropicApiKey) {
      throw new ValidationError('ANTHROPIC_API_KEY is not configured.', { code: 'SCRIPT_MODEL_MISSING_KEY' });
    }
    const modelName = selectModelName('anthropic', input.model);
    const scriptText = await callAnthropic(prompt, modelName);
    return {
      scriptText,
      provider: 'anthropic',
      model: modelName,
      fallbackUsed: false,
      prompt,
      sections: scriptToSegments(scriptText),
    };
  };

  const tryOpenAI = async () => {
    if (!config.script.openaiApiKey) {
      throw new ValidationError('OPENAI_API_KEY is not configured.', { code: 'SCRIPT_MODEL_MISSING_KEY' });
    }
    const modelName = selectModelName('openai', input.model);
    const scriptText = await callOpenAI(prompt, modelName);
    return {
      scriptText,
      provider: 'openai',
      model: modelName,
      fallbackUsed: false,
      prompt,
      sections: scriptToSegments(scriptText),
    };
  };

  if (finalProviderChoice === 'anthropic') {
    return tryAnthropic();
  }

  if (finalProviderChoice === 'openai') {
    return tryOpenAI();
  }

  try {
    if (config.script.anthropicApiKey) {
      return await tryAnthropic();
    }
    if (config.script.openaiApiKey) {
      return await tryOpenAI();
    }
  } catch (error) {
    // Fall through to local fallback below.
  }

  const fallback = generateNarrationScript({
    topic: input.topic,
    audience: input.audience,
    durationSec: input.durationSec,
    callToAction: input.callToAction,
  });

  return {
    scriptText: fallback.scriptText,
    provider: 'local',
    model: 'fallback-template',
    fallbackUsed: true,
    prompt,
    sections: fallback.sections,
  };
}

export async function generateVideoScript(input = {}) {
  const topic = toSentence(input.topic);
  const audience = toSentence(input.audience);
  if (!topic) {
    throw new ValidationError('topic is required to generate a script.');
  }
  if (!audience) {
    throw new ValidationError('audience is required to generate a script.');
  }

  const durationSec = Number.isFinite(input.durationSec)
    ? Math.max(30, Math.round(input.durationSec))
    : 60;

  return generateFromModel({
    topic,
    audience,
    durationSec,
    provider: input.provider,
    model: input.model,
    callToAction: input.callToAction,
  });
}

export { generateNarrationScript };
