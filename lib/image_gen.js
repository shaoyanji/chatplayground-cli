const fs = require('fs');
const path = require('path');
const { getValidToken, getAuth } = require('./auth');
const { uploadImage } = require('./upload');

const DEFAULT_IMAGE_MODEL = 'gpt-image-2';

async function generateImage(prompt, options = {}) {
  const {
    model = DEFAULT_IMAGE_MODEL,
    size = '1024x1024',
    inputImage = null,
    outputPath = null,
    onStatus = console.log
  } = options;

  if (!prompt || prompt.trim().length < 5) {
    throw new Error('Please enter an image prompt with at least 5-10 characters.');
  }

  // Ensure authenticated
  let token = options.token;
  if (!token) {
    const auth = await getValidToken({ interactive: false });
    if (!auth || !auth.token) {
      throw new Error('NOT_LOGGED_IN');
    }
    token = auth.token;
  }

  // Upload reference image if provided
  let uploadedImageUrl = null;
  if (inputImage) {
    onStatus('🖼️ Uploading reference image...');
    uploadedImageUrl = await uploadImage(inputImage);
  }

  onStatus(`🎨 Generating image with \x1b[33m${model}\x1b[0m (size: ${size})...`);

  const payload = {
    prompt: prompt.trim(),
    apiKey: '',
    model: model,
    size: size
  };
  if (uploadedImageUrl) {
    payload.image = uploadedImageUrl;
  }

  const authData = getAuth();
  const cookieHeader = authData.sessionCookie
    ? `__session=${authData.sessionCookie}`
    : `__session=${token}`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Cookie': cookieHeader,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Origin': 'https://web.chatplayground.ai',
    'Referer': `https://web.chatplayground.ai/generate-image/${model}`
  };

  const endpointUrl = `https://app.chatplayground.ai/api/generate-image/${model}`;

  let response = await fetch(endpointUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  // Handle 401 retry once
  if (response.status === 401) {
    const refreshed = await getValidToken({ forceRefresh: true });
    if (refreshed && refreshed.token) {
      token = refreshed.token;
      headers['Authorization'] = `Bearer ${token}`;
      headers['Cookie'] = `__session=${token}`;
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
    }
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(`Image Generation Error HTTP ${response.status}: ${errText || response.statusText}`);
  }

  const data = await response.json();
  const imageUrl = data.url;

  if (!imageUrl) {
    throw new Error('Server did not return an image URL.');
  }

  let savedFile = null;
  if (outputPath) {
    onStatus('💾 Downloading generated image...');
    const imgRes = await fetch(imageUrl);
    if (imgRes.ok) {
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const resolvedOutput = path.resolve(process.cwd(), outputPath);
      fs.writeFileSync(resolvedOutput, buffer);
      savedFile = resolvedOutput;
    }
  }

  return {
    id: data.id,
    url: imageUrl,
    prompt: data.prompt || prompt,
    savedFile
  };
}

module.exports = {
  generateImage,
  DEFAULT_IMAGE_MODEL
};
