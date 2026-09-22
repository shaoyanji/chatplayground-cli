const fs = require('fs');
const path = require('path');

const UPLOAD_ENDPOINT = 'https://temp-file-host.chatplayground.ai/upload';

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    case '.bmp': return 'image/bmp';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

async function uploadImage(imagePathOrUrl) {
  if (!imagePathOrUrl) return null;

  // If already a remote URL, verify it or return
  if (imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://')) {
    // We can also re-upload it to ChatPlayground's temp host for reliability
    try {
      const res = await fetch(imagePathOrUrl);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const contentType = res.headers.get('content-type') || 'image/png';
        const blob = new Blob([buffer], { type: contentType });
        const form = new FormData();
        form.append('file', blob, 'image.png');
        const uploadRes = await fetch(UPLOAD_ENDPOINT, { method: 'POST', body: form });
        if (uploadRes.ok) {
          const json = await uploadRes.json();
          const url = (json.data && json.data.url) || json.url;
          if (url) return url;
        }
      }
    } catch {}
    return imagePathOrUrl;
  }

  // Local file
  const resolvedPath = path.resolve(process.cwd(), imagePathOrUrl);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Image file not found at: ${resolvedPath}`);
  }

  const fileBuffer = fs.readFileSync(resolvedPath);
  const mimeType = getMimeType(resolvedPath);
  const fileName = path.basename(resolvedPath);

  const blob = new Blob([fileBuffer], { type: mimeType });
  const form = new FormData();
  form.append('file', blob, fileName);

  const res = await fetch(UPLOAD_ENDPOINT, {
    method: 'POST',
    body: form
  });

  if (!res.ok) {
    throw new Error(`Failed to upload image (${res.status} ${res.statusText})`);
  }

  const json = await res.json();
  let url = (json.data && json.data.url) || json.url;
  if (!url) {
    throw new Error('Upload service did not return an image URL');
  }

  url = url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/')
           .replace('http://tmpfiles.org/', 'http://tmpfiles.org/dl/');

  return url;
}

module.exports = {
  uploadImage
};
