const { getValidToken, getAuth, saveAuth } = require('./auth');
const { resolveModel } = require('./models');
const { uploadImage } = require('./upload');

class ChatPlaygroundApi {
  constructor(options = {}) {
    this.token = options.token || null;
    this.model = options.model || 'gemini-3.8-flash-l';
    this.chatId = options.chatId || '';
    this.messages = options.messages || [];
  }

  async sendQuery(prompt, callbacks = {}) {
    const {
      image = null,
      onChunk = () => {},
      onDone = () => {},
      onError = () => {},
      modelOverride = null
    } = callbacks;

    const modelToUse = modelOverride || this.model;
    const resolved = await resolveModel(modelToUse);

    // Ensure we have a token
    let token = this.token;
    if (!token) {
      const auth = await getValidToken({ interactive: false });
      if (!auth || !auth.token) {
        throw new Error('NOT_LOGGED_IN');
      }
      token = auth.token;
    }

    // Add user message to history (with image if provided)
    let userContent = prompt;
    if (image) {
      const imageUrl = await uploadImage(image);
      userContent = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageUrl, detail: 'auto' } }
      ];
    }
    this.messages.push({ role: 'user', content: userContent });

    // Determine target endpoint and payload
    let endpointUrl = 'https://app.chatplayground.ai/api/chat/azure';
    let body = {
      messages: this.messages.slice(-20),
      model: resolved.formattedModel,
      chatId: this.chatId || '',
      isRegenerate: false,
      promptTemplate: null,
      fileUrl: null,
      botId: resolved.botId,
      submissionId: null,
      noSave: false
    };

    if (resolved.endpoint === 'perplexity') {
      endpointUrl = 'https://app.chatplayground.ai/api/chat/perplexity';
      body = {
        messages: this.messages.slice(-20),
        modelName: resolved.modelName,
        chatId: this.chatId || '',
        botId: resolved.botId,
        noSave: false
      };
    } else if (resolved.endpoint === 'lmsys') {
      endpointUrl = 'https://app.chatplayground.ai/api/chat/lmsys';
      body = {
        messages: this.messages,
        model: resolved.modelName,
        chatId: this.chatId || '',
        botId: resolved.botId,
        noSave: false
      };
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
      'Referer': 'https://web.chatplayground.ai/'
    };

    let response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    // Handle 401: try refreshing token once
    if (response.status === 401) {
      const refreshed = await getValidToken({ forceRefresh: true });
      if (refreshed && refreshed.token) {
        token = refreshed.token;
        headers['Authorization'] = `Bearer ${token}`;
        headers['Cookie'] = `__session=${token}`;
        response = await fetch(endpointUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
      }
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error('AUTH_EXPIRED');
      }
      throw new Error(`API Error HTTP ${response.status}: ${errText || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body returned from server.');
    }

    let fullAnswer = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const rawChunk = decoder.decode(value, { stream: true });
        
        // Extract CHAT_ID if present
        const chatIdMatch = rawChunk.match(/CHAT_ID:([a-zA-Z0-9_-]{15,50})/);
        if (chatIdMatch) {
          this.chatId = chatIdMatch[1];
        }

        // Clean out CHAT_ID line from chunk
        const cleanChunk = rawChunk
          .replace(/CHAT_ID:[a-zA-Z0-9_-]{15,50}\n?/g, '')
          .replace(/CHAT_ID:[a-zA-Z0-9_-]*$/g, '');

        if (cleanChunk) {
          fullAnswer += cleanChunk;
          onChunk(cleanChunk);
        }
      }
    } finally {
      reader.releaseLock();
    }

    this.messages.push({ role: 'assistant', content: fullAnswer });
    onDone(fullAnswer);
    return fullAnswer;
  }
}

module.exports = {
  ChatPlaygroundApi
};
