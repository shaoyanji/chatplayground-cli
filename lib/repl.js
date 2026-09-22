const readline = require('readline');
const { ChatPlaygroundApi } = require('./api');
const { getModels, resolveModel } = require('./models');

async function startRepl(options = {}) {
  let currentModel = options.model || 'claude-sonnet-5-l';
  const api = new ChatPlaygroundApi({ model: currentModel });
  let pendingImage = null;

  const resolved = await resolveModel(currentModel);
  console.log(`\x1b[1m\x1b[36m=== ChatPlayground AI CLI ===\x1b[0m`);
  console.log(`🤖 Model: \x1b[32m${resolved.displayName}\x1b[0m (\x1b[33m${resolved.botId}\x1b[0m) [${resolved.provider}]`);
  if (resolved.supportImage) {
    console.log(`🖼️  Image support: \x1b[32mEnabled\x1b[0m (Use \x1b[35m/image <file>\x1b[0m to attach images)`);
  }
  console.log(`💡 Special commands: \x1b[35m/image\x1b[0m, \x1b[35m/model\x1b[0m, \x1b[35m/models\x1b[0m, \x1b[35m/clear\x1b[0m, \x1b[35m/help\x1b[0m, \x1b[35m/exit\x1b[0m\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[32mYou>\x1b[0m '
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Command handling
    if (input.startsWith('/')) {
      const parts = input.split(' ');
      const command = parts[0].toLowerCase();
      const rest = parts.slice(1).join(' ').trim();

      if (command === '/exit' || command === '/quit') {
        console.log('Goodbye!');
        process.exit(0);
      } else if (command === '/clear') {
        console.clear();
        api.messages = [];
        api.chatId = '';
        pendingImage = null;
        console.log(`\x1b[33mConversation history cleared.\x1b[0m\n`);
        rl.prompt();
        return;
      } else if (command === '/image') {
        if (!rest) {
          console.log(`Usage: /image <file-path-or-url> [optional prompt]`);
          rl.prompt();
          return;
        }
        const [imgPath, ...promptWords] = rest.split(' ');
        const promptText = promptWords.join(' ').trim();
        if (promptText) {
          // Direct image + prompt query
          await sendChatMessage(promptText, imgPath);
          return;
        } else {
          pendingImage = imgPath;
          console.log(`\x1b[32m🖼️ Image attached: ${imgPath}\x1b[0m. Next message will include this image.`);
          rl.prompt();
          return;
        }
      } else if (command === '/model') {
        const newModel = rest;
        if (!newModel) {
          console.log(`Current model: \x1b[32m${currentModel}\x1b[0m`);
        } else {
          try {
            const m = await resolveModel(newModel);
            currentModel = m.botId;
            api.model = m.botId;
            console.log(`\x1b[32mSwitched model to: ${m.displayName} (${m.botId})\x1b[0m`);
            if (m.supportImage) {
              console.log(`🖼️  Image support: \x1b[32mEnabled\x1b[0m`);
            }
          } catch (e) {
            console.log(`\x1b[31mError resolving model: ${e.message}\x1b[0m`);
          }
        }
        rl.prompt();
        return;
      } else if (command === '/models') {
        try {
          const list = await getModels();
          console.log('\nAvailable models:');
          for (const m of list) {
            const vision = m.supportImage ? ' \x1b[36m[Vision]\x1b[0m' : '';
            console.log(` - \x1b[33m${m.botId.padEnd(25)}\x1b[0m: ${m.displayName.padEnd(28)} [${m.provider}]${vision}`);
          }
          console.log('');
        } catch (e) {
          console.log(`Error listing models: ${e.message}`);
        }
        rl.prompt();
        return;
      } else if (command === '/status') {
        console.log(`Model: ${currentModel}`);
        console.log(`Chat ID: ${api.chatId || '(None yet)'}`);
        console.log(`Turns: ${api.messages.length / 2}`);
        if (pendingImage) console.log(`Pending image: ${pendingImage}`);
        rl.prompt();
        return;
      } else if (command === '/help') {
        console.log(`Commands:`);
        console.log(`  /image <path> [prompt] - Attach an image to analyze`);
        console.log(`  /model <name>          - Switch model (e.g. /model gemini, /model gpt, /model r1)`);
        console.log(`  /models                - List all available models`);
        console.log(`  /clear                 - Clear conversation history and reset`);
        console.log(`  /status                - Show active session and model information`);
        console.log(`  /exit, /quit           - Exit the CLI`);
        rl.prompt();
        return;
      } else {
        console.log(`Unknown command: ${command}. Type /help for assistance.`);
        rl.prompt();
        return;
      }
    }

    // Send query
    const imgToSend = pendingImage;
    pendingImage = null;
    await sendChatMessage(input, imgToSend);
  });

  async function sendChatMessage(promptText, imageFile = null) {
    const activeModel = await resolveModel(currentModel);
    process.stdout.write(`\n\x1b[36m${activeModel.displayName}>\x1b[0m `);
    try {
      await api.sendQuery(promptText, {
        image: imageFile,
        onChunk: (chunk) => {
          process.stdout.write(chunk);
        },
        onDone: () => {
          process.stdout.write('\n\n');
          rl.prompt();
        }
      });
    } catch (err) {
      if (err.message === 'NOT_LOGGED_IN' || err.message === 'AUTH_EXPIRED') {
        console.log(`\n\x1b[31m[!] You are not authenticated. Please run 'chatplayground login' first.\x1b[0m\n`);
      } else {
        console.log(`\n\x1b[31m[!] Error: ${err.message}\x1b[0m\n`);
      }
      rl.prompt();
    }
  }

  rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);
  });
}

module.exports = {
  startRepl
};
