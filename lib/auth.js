const fs = require('fs');
const path = require('path');
const os = require('os');
const { interactiveLogin, refreshSessionToken } = require('./browser');

const CONFIG_DIR = path.join(os.homedir(), '.chatplayground');
const AUTH_FILE = path.join(CONFIG_DIR, 'auth.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function getAuth() {
  ensureConfigDir();
  if (fs.existsSync(AUTH_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    } catch {}
  }
  return {};
}

function saveAuth(data) {
  ensureConfigDir();
  const current = getAuth();
  const merged = { ...current, ...data, updatedAt: Date.now() };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

function clearAuth() {
  if (fs.existsSync(AUTH_FILE)) {
    fs.unlinkSync(AUTH_FILE);
  }
}

async function getValidToken(options = {}) {
  const { forceRefresh = false, interactive = false, onStatus = console.log } = options;

  // 1. Environment variable override
  if (process.env.CHATPLAYGROUND_TOKEN) {
    return { token: process.env.CHATPLAYGROUND_TOKEN, source: 'env' };
  }

  const auth = getAuth();

  // If we have a token and don't need a force refresh, check age
  // Clerk JWTs expire after ~60s if not refreshed, though session cookies last longer.
  // If token is younger than 50 seconds and not forceRefresh, we can use it.
  const tokenAge = auth.updatedAt ? Date.now() - auth.updatedAt : Infinity;
  if (!forceRefresh && auth.token && tokenAge < 50 * 1000) {
    return { token: auth.token, source: 'cache', user: auth.user };
  }

  // 2. Try background silent refresh using persistent browser profile only if logged in before
  if (auth.token || auth.sessionId) {
    try {
      const refreshed = await refreshSessionToken(onStatus);
      if (refreshed && refreshed.token) {
        saveAuth(refreshed);
        return { token: refreshed.token, source: 'refreshed', user: refreshed.user };
      }
    } catch (e) {
      // Refresh failed
    }
  }

  // If still have cached token even if older, we can try it as fallback before failing
  if (!forceRefresh && auth.token) {
    return { token: auth.token, source: 'fallback_cache', user: auth.user };
  }

  // 3. Interactive login if requested
  if (interactive) {
    const loginResult = await interactiveLogin(onStatus);
    saveAuth(loginResult);
    return { token: loginResult.token, source: 'interactive', user: loginResult.user };
  }

  return null;
}

module.exports = {
  CONFIG_DIR,
  AUTH_FILE,
  getAuth,
  saveAuth,
  clearAuth,
  getValidToken
};
