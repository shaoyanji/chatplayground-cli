const path = require('path');
const os = require('os');
const fs = require('fs');

const PROFILE_DIR = path.join(os.homedir(), '.chatplayground', 'browser_profile');

function getPlaywright() {
  const candidates = [
    'playwright',
    'C:/Users/root/scoop/persist/nodejs-lts/cache/_npx/9833c18b2d85bc59/node_modules/playwright',
    'C:/Users/root/scoop/persist/nodejs-lts/bin/node_modules/playwright'
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {}
  }
  throw new Error('Playwright is not found. Please install playwright or run via scoop.');
}

function getBrowserExecutable() {
  const candidates = [
    'C:\\Users\\root\\scoop\\apps\\helium\\current\\chrome.exe',
    'C:\\Users\\root\\scoop\\apps\\helium\\0.14.9.1\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return undefined; // use playwright's default bundled browser
}

async function interactiveLogin(onStatus = console.log) {
  const { chromium } = getPlaywright();
  const executablePath = getBrowserExecutable();

  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  onStatus('🌐 Launching browser for ChatPlayground login...');
  onStatus('👉 Please log in using Google or your Email in the browser window.');

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    executablePath,
    viewport: { width: 1200, height: 800 },
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://web.chatplayground.ai/chat/claude-sonnet-5-l', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    onStatus('⏳ Waiting for authentication to complete...');

    // Wait for window.Clerk to load and session to become active (up to 5 minutes)
    await page.waitForFunction(() => {
      return !!(window.Clerk && window.Clerk.session);
    }, { timeout: 300000, polling: 1000 });

    const authData = await page.evaluate(async () => {
      const token = await window.Clerk.session.getToken();
      const user = window.Clerk.user;
      return {
        token,
        sessionId: window.Clerk.session.id,
        user: user ? {
          id: user.id,
          email: user.primaryEmailAddress ? user.primaryEmailAddress.emailAddress : (user.emailAddresses && user.emailAddresses[0] ? user.emailAddresses[0].emailAddress : ''),
          fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim()
        } : null
      };
    });

    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === '__session');

    onStatus('✅ Authentication successful!');
    return {
      token: authData.token,
      sessionId: authData.sessionId,
      sessionCookie: sessionCookie ? sessionCookie.value : null,
      user: authData.user,
      updatedAt: Date.now()
    };
  } finally {
    await context.close().catch(() => {});
  }
}

async function refreshSessionToken(onStatus = () => {}) {
  const { chromium } = getPlaywright();
  const executablePath = getBrowserExecutable();

  if (!fs.existsSync(PROFILE_DIR)) {
    return null;
  }

  onStatus('🔄 Refreshing authentication session in background...');

  let context;
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: true,
      executablePath,
      ignoreDefaultArgs: ['--enable-automation'],
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });

    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://web.chatplayground.ai/chat/claude-sonnet-5-l', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for Clerk to load
    await page.waitForFunction(() => {
      return !!(window.Clerk && window.Clerk.loaded);
    }, { timeout: 20000, polling: 500 });

    const authData = await page.evaluate(async () => {
      if (!window.Clerk || !window.Clerk.session) return null;
      const token = await window.Clerk.session.getToken();
      const user = window.Clerk.user;
      return {
        token,
        sessionId: window.Clerk.session.id,
        user: user ? {
          id: user.id,
          email: user.primaryEmailAddress ? user.primaryEmailAddress.emailAddress : '',
          fullName: user.fullName || ''
        } : null
      };
    });

    if (!authData || !authData.token) {
      return null;
    }

    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === '__session');

    return {
      token: authData.token,
      sessionId: authData.sessionId,
      sessionCookie: sessionCookie ? sessionCookie.value : null,
      user: authData.user,
      updatedAt: Date.now()
    };
  } catch (err) {
    return null;
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

module.exports = {
  PROFILE_DIR,
  interactiveLogin,
  refreshSessionToken,
  getBrowserExecutable
};
