#!/usr/bin/env node

const fs = require('fs');
const { ChatPlaygroundApi } = require('../lib/api');
const { getAuth, saveAuth, clearAuth, getValidToken } = require('../lib/auth');
const { getModels, resolveModel, getDefaultModelId, setDefaultModelId } = require('../lib/models');
const { generateImage } = require('../lib/image_gen');
const { interactiveLogin } = require('../lib/browser');
const { startRepl } = require('../lib/repl');

const VERSION = '1.2.0';

function printHelp() {
  const currentDefault = getDefaultModelId();
  console.log(`
\x1b[1m\x1b[36mChatPlayground CLI\x1b[0m (v${VERSION}) - Terminal interface for https://web.chatplayground.ai/

\x1b[1mUSAGE:\x1b[0m
  chatplayground [options] [prompt]
  chatplayground <command> [options]

\x1b[1mCOMMANDS:\x1b[0m
  chatplayground login [token]       Log in via browser or save session token
  chatplayground logout              Log out and clear stored session
  chatplayground whoami, status      Check authentication and active user
  chatplayground models              List all 36 available models and vision support
  chatplayground set-model <botId>   Set your preferred default model (currently: \x1b[32m${currentDefault}\x1b[0m)
  chatplayground generate-image <p>  Generate image using GPT Image 2 (or other models)
  chatplayground repl                Start interactive multi-turn chat session

\x1b[1mOPTIONS:\x1b[0m
  -m, --model <id>        Specify model by ID or alias (default: \x1b[32m${currentDefault}\x1b[0m)
  -i, --image <file/url>  Attach a local image file or URL for vision analysis / image-to-image
  --size <size>           Image generation size: 1024x1024 (default), 1536x1024, 1024x1536
  -o, --output <file>     Download and save generated image to file path
  -t, --token <token>     Pass Clerk session token directly
  --raw                   Print raw text without formatting
  -h, --help              Show this help message
  -v, --version           Show version

\x1b[1mEXAMPLES:\x1b[0m
  # 1. Query Claude Sonnet 5 (default)
  chatplayground "Explain the difference between TCP and UDP"

  # 2. Vision analysis with Claude Sonnet 5
  chatplayground -i photo.jpg "What does this diagram illustrate?"

  # 3. Generate image using GPT Image 2 (https://web.chatplayground.ai/generate-image/gpt-image-2)
  chatplayground generate-image "A futuristic cyberpunk city at twilight with glowing neon signs"
  chatplayground generate-image --size 1536x1024 --output city.png "A serene Japanese zen garden"

  # 4. Query other models
  chatplayground -m gemini "Compare Go and Rust"
  chatplayground -m gpt "Write a quicksort in Python"
  chatplayground -m deepseek "Prove the Pythagorean theorem"

  # 5. Interactive multi-turn chat session
  chatplayground
`);
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => {
      resolve(data.trim());
    }, 100);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(data.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  let model = getDefaultModelId();
  let image = null;
  let size = '1024x1024';
  let output = null;
  let token = null;
  let raw = false;
  let promptParts = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    } else if (arg === '-v' || arg === '--version') {
      console.log(`chatplayground v${VERSION}`);
      process.exit(0);
    } else if (arg === '-m' || arg === '--model') {
      model = args[++i];
    } else if (arg === '-i' || arg === '--image') {
      image = args[++i];
    } else if (arg === '--size') {
      size = args[++i];
    } else if (arg === '-o' || arg === '--output') {
      output = args[++i];
    } else if (arg === '-t' || arg === '--token') {
      token = args[++i];
    } else if (arg === '--raw') {
      raw = true;
    } else {
      promptParts.push(arg);
    }
  }

  const firstArg = promptParts[0];

  // Command: login / set-token
  if (firstArg === 'login' || firstArg === 'set-token') {
    let providedToken = token;
    const tokenFlagIdx = promptParts.indexOf('--token');
    if (tokenFlagIdx !== -1 && promptParts[tokenFlagIdx + 1]) {
      providedToken = promptParts[tokenFlagIdx + 1];
    } else if (promptParts[1] && !promptParts[1].startsWith('-')) {
      providedToken = promptParts[1];
    }

    if (providedToken) {
      saveAuth({ token: providedToken, sessionCookie: providedToken });
      console.log('\x1b[32m✅ Authentication token saved successfully.\x1b[0m');
      console.log('You can now query models via: \x1b[36mchatplayground "your prompt"\x1b[0m');
      process.exit(0);
    }

    console.log('\x1b[1m\x1b[33m[!] Note for Google / Gmail Accounts:\x1b[0m');
    console.log('Google blocks automated browsers ("This browser or app may not be secure").');
    console.log('If using Google sign-in, simply log in via your normal browser, run this in F12 Console:');
    console.log('  \x1b[36mcopy(await window.Clerk.session.getToken())\x1b[0m');
    console.log('And run: \x1b[32mchatplayground login <pasted_token>\x1b[0m\n');

    try {
      console.log('\x1b[36mOpening browser window for login...\x1b[0m');
      const auth = await interactiveLogin(msg => console.log(msg));
      saveAuth(auth);
      console.log(`\x1b[32mSuccessfully logged in!\x1b[0m`);
      if (auth.user && auth.user.email) {
        console.log(`User: \x1b[1m${auth.user.email}\x1b[0m`);
      }
      process.exit(0);
    } catch (err) {
      console.error(`\x1b[31mLogin cancelled or failed: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  }

  // Command: set-model
  if (firstArg === 'set-model') {
    const targetModel = promptParts[1] || model;
    if (!targetModel) {
      console.log(`Usage: chatplayground set-model <model-id-or-alias>`);
      process.exit(1);
    }
    const resolved = await resolveModel(targetModel);
    setDefaultModelId(resolved.botId);
    console.log(`\x1b[32m✅ Default model set to: ${resolved.displayName} (${resolved.botId})\x1b[0m`);
    process.exit(0);
  }

  // Command: logout
  if (firstArg === 'logout') {
    clearAuth();
    console.log('✅ Successfully logged out. Credentials removed.');
    process.exit(0);
  }

  // Command: status / whoami
  if (firstArg === 'status' || firstArg === 'whoami') {
    const auth = getAuth();
    if (!auth || !auth.token) {
      console.log('\x1b[33mNot logged in.\x1b[0m Run \x1b[36mchatplayground login\x1b[0m to sign in.');
      process.exit(0);
    }
    console.log(`\x1b[32m● Authenticated with ChatPlayground\x1b[0m`);
    if (auth.user) {
      if (auth.user.fullName) console.log(`Name:  ${auth.user.fullName}`);
      if (auth.user.email)    console.log(`Email: ${auth.user.email}`);
      if (auth.user.id)       console.log(`User ID: ${auth.user.id}`);
    }
    console.log(`Default model: ${getDefaultModelId()}`);
    if (auth.updatedAt) {
      console.log(`Last login: ${new Date(auth.updatedAt).toLocaleString()}`);
    }
    process.exit(0);
  }

  // Command: models
  if (firstArg === 'models') {
    try {
      const list = await getModels();
      const currentDefault = getDefaultModelId();
      console.log(`\x1b[1mAvailable models on ChatPlayground (${list.length} total):\x1b[0m\n`);
      for (const m of list) {
        const isDefault = m.botId === currentDefault;
        const mark = isDefault ? ' \x1b[32m(default)\x1b[0m' : '';
        const vision = m.supportImage ? ' \x1b[36m[Vision]\x1b[0m' : '';
        const imgGen = m.group === 'image' ? ' \x1b[35m[Image Generator]\x1b[0m' : '';
        console.log(`  \x1b[33m${m.botId.padEnd(28)}\x1b[0m ${m.displayName.padEnd(30)} [${m.provider}]${vision}${imgGen}${mark}`);
      }
      console.log(`\nChat: chatplayground -m <botId> "prompt"`);
      console.log(`Image: chatplayground generate-image -m gpt-image-2 "prompt"`);
      console.log(`Set default: chatplayground set-model <botId>`);
      process.exit(0);
    } catch (err) {
      console.error(`Failed to retrieve models: ${err.message}`);
      process.exit(1);
    }
  }

  // Command: generate-image / gen-image / image-gen
  if (firstArg === 'generate-image' || firstArg === 'gen-image' || firstArg === 'image-gen') {
    let imgPrompt = promptParts.slice(1).join(' ').trim();
    if (!imgPrompt && !process.stdin.isTTY) {
      imgPrompt = await readStdin();
    }
    if (!imgPrompt) {
      console.log(`Usage: chatplayground generate-image [--size 1024x1024|1536x1024|1024x1536] [--output file.png] "prompt"`);
      process.exit(1);
    }

    const imageModel = (model && model.includes('image')) ? model : 'gpt-image-2';
    try {
      const res = await generateImage(imgPrompt, {
        model: imageModel,
        size,
        inputImage: image,
        outputPath: output,
        token
      });

      console.log(`\n\x1b[32m✅ Image generated successfully!\x1b[0m`);
      console.log(`🖼️ URL: \x1b[36m${res.url}\x1b[0m`);
      if (res.savedFile) {
        console.log(`💾 Saved to: \x1b[32m${res.savedFile}\x1b[0m`);
      }
      process.exit(0);
    } catch (err) {
      if (err.message === 'NOT_LOGGED_IN' || err.message === 'AUTH_EXPIRED') {
        console.error(`\n\x1b[31m[!] You are not authenticated with ChatPlayground (or token expired).\x1b[0m`);
        console.error(`Run: \x1b[36mchatplayground login\x1b[0m or provide a fresh token: \x1b[32mchatplayground login <token>\x1b[0m\n`);
        process.exit(1);
      } else {
        console.error(`\n\x1b[31m[!] Error: ${err.message}\x1b[0m\n`);
        process.exit(1);
      }
    }
  }

  // Command: repl
  if (firstArg === 'repl') {
    await startRepl({ model });
    return;
  }

  // Handle chat prompt
  let prompt = promptParts.join(' ').trim();
  if (!prompt && !process.stdin.isTTY) {
    prompt = await readStdin();
  }

  // If no prompt provided
  if (!prompt && !image) {
    if (process.stdin.isTTY || firstArg === 'repl') {
      await startRepl({ model });
      return;
    } else {
      printHelp();
      process.exit(0);
    }
  }

  if (!prompt && image) {
    prompt = "Please describe this image in detail.";
  }

  // Execute single-shot query
  const api = new ChatPlaygroundApi({ model, token });
  try {
    const resolved = await resolveModel(model);
    if (image) {
      process.stdout.write(`\x1b[35m[Uploading image...]\x1b[0m\r`);
    }

    await api.sendQuery(prompt, {
      image,
      onChunk: (chunk) => {
        process.stdout.write(chunk);
      },
      onDone: () => {
        process.stdout.write('\n');
      }
    });
  } catch (err) {
    if (err.message === 'NOT_LOGGED_IN' || err.message === 'AUTH_EXPIRED') {
      console.error(`\n\x1b[31m[!] You are not authenticated with ChatPlayground (or token expired).\x1b[0m`);
      console.error(`Run: \x1b[36mchatplayground login\x1b[0m or provide a fresh token: \x1b[32mchatplayground login <token>\x1b[0m\n`);
      process.exit(1);
    } else {
      console.error(`\n\x1b[31m[!] Error: ${err.message}\x1b[0m\n`);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
