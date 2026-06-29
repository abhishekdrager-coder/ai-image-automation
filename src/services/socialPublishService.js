import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { config } from '../config.js';

async function uploadToYoutube(videoPath, metadata) {
  if (!config.publish.youtubeAccessToken) {
    return {
      platform: 'youtube',
      ok: false,
      skipped: true,
      reason: 'Missing YOUTUBE_ACCESS_TOKEN.',
    };
  }

  const videoBuffer = await readFile(path.resolve(videoPath));
  const boundary = `----ai-image-automation-${Date.now()}`;
  const metadataPart = JSON.stringify({
    snippet: {
      title: metadata.title,
      description: metadata.description,
      ...(Array.isArray(metadata.tags) && metadata.tags.length ? { tags: metadata.tags } : {}),
    },
    status: {
      privacyStatus: metadata.privacyStatus || 'private',
    },
  });

  const bodyParts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n`,
    `--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
  ];

  const preamble = Buffer.from(bodyParts.join(''), 'utf8');
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([preamble, videoBuffer, epilogue]);

  const response = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.publish.youtubeAccessToken}`,
      'content-type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const responseText = await response.text();
  if (!response.ok) {
    return {
      platform: 'youtube',
      ok: false,
      skipped: false,
      error: responseText.slice(0, 500),
    };
  }

  const payload = JSON.parse(responseText);
  return {
    platform: 'youtube',
    ok: true,
    skipped: false,
    videoId: payload.id,
    url: payload.id ? `https://www.youtube.com/watch?v=${payload.id}` : null,
  };
}

async function uploadToFacebook(videoPath, metadata) {
  if (!config.publish.facebookPageId || !config.publish.facebookAccessToken) {
    return {
      platform: 'facebook',
      ok: false,
      skipped: true,
      reason: 'Missing FACEBOOK_PAGE_ID or FACEBOOK_ACCESS_TOKEN.',
    };
  }

  const form = new FormData();
  const buffer = await readFile(path.resolve(videoPath));
  form.append('access_token', config.publish.facebookAccessToken);
  form.append('title', metadata.title);
  form.append('description', metadata.description);
  form.append('source', new Blob([buffer]), path.basename(videoPath));

  const endpoint = `https://graph-video.facebook.com/v21.0/${config.publish.facebookPageId}/videos`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      platform: 'facebook',
      ok: false,
      skipped: false,
      error: payload.error?.message || JSON.stringify(payload).slice(0, 500),
    };
  }

  return {
    platform: 'facebook',
    ok: true,
    skipped: false,
    id: payload.id || null,
    postId: payload.post_id || null,
  };
}

async function uploadToInstagram(metadata) {
  if (!config.publish.instagramUserId || !config.publish.instagramAccessToken || !config.publish.instagramVideoUrl) {
    return {
      platform: 'instagram',
      ok: false,
      skipped: true,
      reason: 'Instagram publish needs INSTAGRAM_USER_ID, INSTAGRAM_ACCESS_TOKEN, and INSTAGRAM_VIDEO_PUBLIC_URL.',
    };
  }

  const createUrl = `https://graph.facebook.com/v21.0/${config.publish.instagramUserId}/media`;
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      access_token: config.publish.instagramAccessToken,
      media_type: 'REELS',
      video_url: config.publish.instagramVideoUrl,
      caption: metadata.description,
    }),
  });

  const createPayload = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok || !createPayload.id) {
    return {
      platform: 'instagram',
      ok: false,
      skipped: false,
      error: createPayload.error?.message || JSON.stringify(createPayload).slice(0, 500),
    };
  }

  const publishUrl = `https://graph.facebook.com/v21.0/${config.publish.instagramUserId}/media_publish`;
  const publishResponse = await fetch(publishUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      access_token: config.publish.instagramAccessToken,
      creation_id: createPayload.id,
    }),
  });

  const publishPayload = await publishResponse.json().catch(() => ({}));
  if (!publishResponse.ok) {
    return {
      platform: 'instagram',
      ok: false,
      skipped: false,
      error: publishPayload.error?.message || JSON.stringify(publishPayload).slice(0, 500),
    };
  }

  return {
    platform: 'instagram',
    ok: true,
    skipped: false,
    creationId: createPayload.id,
    mediaId: publishPayload.id || null,
  };
}

async function triggerWebhooks(videoPath, metadata) {
  if (!Array.isArray(config.publish.webhookUrls) || config.publish.webhookUrls.length === 0) {
    return [];
  }

  const payload = {
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags || [],
    localVideoPath: path.resolve(videoPath),
    timestamp: new Date().toISOString(),
  };

  const results = [];
  for (const url of config.publish.webhookUrls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      results.push({
        platform: 'webhook',
        endpoint: url,
        ok: response.ok,
        status: response.status,
      });
    } catch (error) {
      results.push({
        platform: 'webhook',
        endpoint: url,
        ok: false,
        error: error.message,
      });
    }
  }

  return results;
}

export async function publishVideo(videoPath, metadata = {}, targets = []) {
  const normalizedTargets = targets.length > 0
    ? targets
    : ['youtube', 'facebook', 'instagram', 'webhook'];

  const outcomes = [];

  if (normalizedTargets.includes('youtube')) {
    outcomes.push(await uploadToYoutube(videoPath, metadata));
  }

  if (normalizedTargets.includes('facebook')) {
    outcomes.push(await uploadToFacebook(videoPath, metadata));
  }

  if (normalizedTargets.includes('instagram')) {
    outcomes.push(await uploadToInstagram(metadata));
  }

  if (normalizedTargets.includes('webhook')) {
    outcomes.push(...await triggerWebhooks(videoPath, metadata));
  }

  return outcomes;
}
