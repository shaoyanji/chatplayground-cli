const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE_FILE = path.join(os.homedir(), '.chatplayground', 'models_cache.json');
const CONFIG_FILE = path.join(os.homedir(), '.chatplayground', 'config.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const DEFAULT_MODEL = {
  botId: 'gemini-3.8-flash-l',
  modelName: 'gemini-3.8-flash',
  displayName: 'Gemini (Latest Model)',
  provider: 'google',
  endpoint: 'azure',
  formattedModel: 'google/gemini-3.8-flash',
  supportImage: true
};

const ALIASES = {
  'claude': 'claude-sonnet-5-l',
  'sonnet': 'claude-sonnet-5-l',
  'claude-sonnet': 'claude-sonnet-5-l',
  'opus': 'claude-opus-5',
  'claude-opus': 'claude-opus-5',
  'fable': 'claude-fable-5',
  'gpt': 'gpt-5.6-sol',
  'chatgpt': 'gpt-5.6-sol',
  'gpt5': 'gpt-5.6-sol',
  'sol': 'gpt-5.6-sol',
  'terra': 'gpt-5.6-terra',
  'luna': 'gpt-5.6-luna',
  'gemini': 'gemini-3.8-flash-l',
  'flash': 'gemini-3.8-flash-l',
  'gemini-flash': 'gemini-3.8-flash-l',
  'gemini-pro': 'gemini-3.1-pro',
  'pro': 'gemini-3.1-pro',
  'deepseek': 'deepseek-v4-pro',
  'deepseek-pro': 'deepseek-v4-pro',
  'deepseek-v4': 'deepseek-v4-pro',
  'deepseek-v4-pro': 'deepseek-v4-pro',
  'deepseek-flash': 'deepseek-v4-flash',
  'deepseek-v4-flash': 'deepseek-v4-flash',
  'r1': 'deepseek-r1',
  'deepseek-r1': 'deepseek-r1',
  'glm': 'glm-5.3-flash',
  'glm-flash': 'glm-5.3-flash',
  'glm-5.3': 'glm-5.3-flash',
  'glm-5.3-flash': 'glm-5.3-flash',
  'grok': 'grok-4.6',
  'llama': 'llama-4-maverick',
  'maverick': 'llama-4-maverick',
  'scout': 'llama-4-scout',
  'qwen': 'qwen3.8-max',
  'kimi': 'kimi-k3',
  'mistral': 'mistral-large-3',
  'sonar': 'perplexity-sonar-pro',
  'perplexity': 'perplexity-sonar-pro'
};

function getDefaultModelId() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (cfg.defaultModel) return cfg.defaultModel;
    } catch {}
  }
  return 'gemini-3.8-flash-l';
}

function setDefaultModelId(botId) {
  let cfg = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {}
  }
  cfg.defaultModel = botId;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

async function fetchModelsFromApi() {
  try {
    const res = await fetch('https://app.chatplayground.ai/api/models', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch models: HTTP ${res.status}`);
    }
    const data = await res.json();
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), models: data }, null, 2));
    } catch {}
    return data;
  } catch (err) {
    if (fs.existsSync(CACHE_FILE)) {
      try {
        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        return cached.models;
      } catch {}
    }
    return [DEFAULT_MODEL];
  }
}

async function getModels(forceRefresh = false) {
  if (!forceRefresh && fs.existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (Date.now() - cached.timestamp < CACHE_TTL_MS && Array.isArray(cached.models)) {
        return cached.models;
      }
    } catch {}
  }
  return await fetchModelsFromApi();
}

async function resolveModel(botIdOrName) {
  const target = (botIdOrName || getDefaultModelId()).trim().toLowerCase();
  const canonicalId = ALIASES[target] || target;
  const models = await getModels();
  
  let match = models.find(m => m.botId.toLowerCase() === canonicalId);
  if (!match) {
    match = models.find(m => m.modelName.toLowerCase() === canonicalId);
  }
  if (!match) {
    match = models.find(m => m.displayName && m.displayName.toLowerCase() === canonicalId);
  }
  if (!match) {
    match = models.find(m => m.botId.toLowerCase().includes(target) || (m.displayName && m.displayName.toLowerCase().includes(target)));
  }

  const model = match || DEFAULT_MODEL;
  
  let formattedModel = model.modelName;
  if (model.endpoint === 'azure') {
    formattedModel = `${model.provider.toLowerCase()}/${model.modelName}`;
  }

  return {
    botId: model.botId,
    modelName: model.modelName,
    displayName: model.displayName || model.modelName,
    provider: model.provider,
    endpoint: model.endpoint || 'azure',
    formattedModel,
    supportImage: !!model.supportImage,
    raw: model
  };
}

module.exports = {
  getModels,
  resolveModel,
  getDefaultModelId,
  setDefaultModelId,
  ALIASES,
  DEFAULT_MODEL
};
