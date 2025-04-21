<template>
  <div class="terminal-container">
    <div class="terminal-header">
      <div class="terminal-title">
        <span class="terminal-icon">></span>
        <span class="terminal-title-label">Terminal</span>
      </div>
      <div class="terminal-actions">
        <button class="terminal-action" @click="async () => { await spawn('clear') }">
          <span class="action-icon">🧹</span>
        </button>
        <button class="terminal-action" @click="async () => { await spawn('bash') }">
          <span class="action-icon">+</span>
        </button>
        <button v-if="currentProcess" class="terminal-action" @click="currentProcess?.kill()">
          <span class="action-icon">⏹️</span>
        </button>
        <button class="terminal-action" @click="showTerminal = !showTerminal">
          <span class="action-icon">{{ showTerminal ? '▼' : '▲' }}</span>
        </button>
      </div>
    </div>
    <div v-show="showTerminal" ref="root" class="terminal-content"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const props = defineProps({
  webcontainer: {
    type: Object,
    required: true
  }
});

const isDark = ref(true);
const theme = computed(() => {
  return isDark.value
    ? {
        background: '#00000000',
      }
    : {
        background: '#00000000',
      }
});

const root = ref(null);
const terminal = new Terminal({
  customGlyphs: true,
  allowTransparency: true,
  theme: theme.value,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
});

const showTerminal = ref(true);
const currentProcess = ref(null);

async function spawn(command, args = []) {
  try {
    if (currentProcess.value) {
      currentProcess.value.kill();
    }
    
    const process = await props.webcontainer.spawn(command, args, {});
    currentProcess.value = process;
    
    return process.exit.then((r) => {
      if (currentProcess.value === process)
        currentProcess.value = null;
      return r;
    });
  } catch (error) {
    console.error(`Failed to spawn ${command}:`, error);
    terminal.writeln(`\r\nFailed to start ${command}: ${error.message}`);
    terminal.writeln('\r\nUsing a simulated terminal. Try the following commands:');
    terminal.writeln('ls, cd, echo, clear, npm run dev, help\r\n');
    terminal.write('$ ');
    setupSimulatedTerminal();
    return Promise.resolve({ code: 1 });
  }
}

function setupSimulatedTerminal() {
  let inputBuffer = '';
  let commandHistory = [];
  let historyIndex = -1;

  terminal.onData((data) => {
    for (const char of data) {
      if (char === '\r') {
        // Enter key pressed
        terminal.write('\r\n');
        const command = inputBuffer.trim();
        
        if (command) {
          commandHistory.push(command);
          historyIndex = commandHistory.length;
          processSimulatedCommand(command);
        } else {
          terminal.write('$ ');
        }
        
        inputBuffer = '';
      } else if (char === '\x7F') {
        // Backspace key
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.substring(0, inputBuffer.length - 1);
          terminal.write('\b \b');
        }
      } else if (char === '\t') {
        // Tab key - could add completion later
        // For now, just add spaces
        inputBuffer += '  ';
        terminal.write('  ');
      } else if (!char.match(/[\x00-\x1F]/)) {
        // Regular printable character
        inputBuffer += char;
        terminal.write(char);
      }
    }
  });

  // Handle up/down arrows for history
  terminal.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true;
    
    if (e.key === 'ArrowUp') {
      if (commandHistory.length > 0 && historyIndex > 0) {
        historyIndex--;
        clearInput();
        inputBuffer = commandHistory[historyIndex];
        terminal.write('$ ' + inputBuffer);
      }
      return false;
    } else if (e.key === 'ArrowDown') {
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        clearInput();
        inputBuffer = commandHistory[historyIndex];
        terminal.write('$ ' + inputBuffer);
      } else if (historyIndex === commandHistory.length - 1) {
        historyIndex = commandHistory.length;
        clearInput();
        inputBuffer = '';
        terminal.write('$ ');
      }
      return false;
    }
    
    return true;
  });

  function clearInput() {
    terminal.write('\r');
    for (let i = 0; i < 100; i++) {
      terminal.write(' ');
    }
    terminal.write('\r');
  }
  
  function processSimulatedCommand(cmd) {
    const parts = cmd.split(' ');
    const command = parts[0];
    const args = parts.slice(1);
    
    switch (command) {
      case 'clear':
        terminal.clear();
        break;
      
      case 'ls':
        if (args.includes('-la') || args.includes('-al')) {
          terminal.writeln('total 64');
          terminal.writeln('drwxr-xr-x  15 user  staff   480 Feb 15 10:23 .');
          terminal.writeln('drwxr-xr-x   3 user  staff    96 Feb 15 10:23 ..');
          terminal.writeln('drwxr-xr-x  12 user  staff   384 Feb 15 10:23 .git');
          terminal.writeln('-rw-r--r--   1 user  staff  2263 Feb 15 10:23 package.json');
          terminal.writeln('drwxr-xr-x   7 user  staff   224 Feb 15 10:23 src');
          terminal.writeln('drwxr-xr-x   6 user  staff   192 Feb 15 10:23 public');
          terminal.writeln('-rw-r--r--   1 user  staff   782 Feb 15 10:23 vite.config.js');
        } else {
          terminal.writeln('src    public    package.json    vite.config.js');
        }
        break;
      
      case 'cd':
        // Just simulate cd
        break;
      
      case 'echo':
        terminal.writeln(args.join(' '));
        break;
      
      case 'npm':
        if (args[0] === 'run' && args[1] === 'dev') {
          terminal.writeln('\x1b[32m> project@1.0.0 dev\x1b[0m');
          terminal.writeln('\x1b[32m> vite\x1b[0m');
          terminal.writeln('');
          terminal.writeln('\x1b[36mVITE\x1b[0m v4.1.1 ready in 270 ms');
          terminal.writeln('');
          terminal.writeln('  \x1b[32m➜\x1b[0m  \x1b[37mLocal\x1b[0m:   \x1b[36mhttp://localhost:5173/\x1b[0m');
          terminal.writeln('  \x1b[32m➜\x1b[0m  \x1b[37mNetwork\x1b[0m: use \x1b[36m--host\x1b[0m to expose');
          terminal.writeln('  \x1b[32m➜\x1b[0m  press \x1b[37mh\x1b[0m to show help');
        } else {
          terminal.writeln(`Unknown npm command: ${args.join(' ')}`);
        }
        break;
      
      case 'help':
        terminal.writeln('Available commands in this simulation:');
        terminal.writeln('  - clear: Clear the terminal');
        terminal.writeln('  - ls [-la]: List files');
        terminal.writeln('  - cd [dir]: Change directory');
        terminal.writeln('  - echo [text]: Echo text');
        terminal.writeln('  - npm run dev: Simulate starting dev server');
        terminal.writeln('  - help: Show this help');
        break;
      
      default:
        terminal.writeln(`Command not found: ${command}`);
    }
    
    terminal.write('$ ');
  }
}

watch(() => showTerminal.value, (v) => {
  if (!root.value)
    return;
  if (!v) {
    const { height } = root.value.getBoundingClientRect();
    root.value.style.height = `${height}px`;
  }
  else {
    root.value.style.height = 'initial';
  }
}, { flush: 'sync' });

watch(
  () => theme.value,
  (t) => {
    terminal.options.theme = t;
  },
);

const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

let init = false;

watch(
  () => currentProcess.value,
  (p) => {
    if (!p)
      return;
    // Output
    try {
      const reader = p.output.getReader();
      function read() {
        reader.read().then(({ done, value }) => {
          if (value) {
            terminal.write(value);
            terminal.scrollToBottom();
          }
          if (!done)
            read();
        });
      }
      if (!init) {
        init = true;
      }
      else {
        terminal.writeln('');
        terminal.writeln(`-------------`);
        terminal.writeln('');
        terminal.scrollToBottom();
      }

      read();
    }
    catch (e) {
      console.error(e);
    }

    try {
      const writer = p.input.getWriter();
      terminal.onData((data) => {
        try {
          writer.write(data);
        }
        catch (e) {
          console.error(e);
        }
      });
    }
    catch (e) {
      console.error(e);
    }
  },
  { flush: 'sync', immediate: true },
);

function handleResize() {
  if (fitAddon && root.value) {
    setTimeout(() => {
      fitAddon.fit();
    }, 0);
  }
}

const stop = watch(
  () => root.value,
  (el) => {
    if (!el)
      return;
    terminal.open(el);
    terminal.write('\n');
    setTimeout(() => {
      fitAddon.fit();
    }, 0);
    stop();
  },
);

// Initialize terminal with bash when mounted
onMounted(async () => {
  try {
    terminal.writeln('Terminal initializing...');
    await spawn('bash');
    window.addEventListener('resize', handleResize);
  } catch (e) {
    console.error('Failed to start bash:', e);
  }
});
</script>

<style scoped>
.terminal-container {
  height: auto;
  display: flex;
  flex-direction: column;
  background-color: var(--vscode-terminal-bg, rgba(30, 30, 30, 0.8));
  border-top: 1px solid var(--vscode-border, #474747);
  border-radius: 4px;
  overflow: hidden;
}

.terminal-header {
  display: flex;
  align-items: center;
  padding: 0 10px;
  height: 35px;
  background-color: var(--vscode-sidebar-bg, rgba(37, 37, 38, 0.9));
  border-bottom: 1px solid var(--vscode-border, #474747);
}

.terminal-title {
  display: flex;
  align-items: center;
  font-size: 13px;
}

.terminal-icon {
  margin-right: 4px;
  font-size: 14px;
  opacity: 0.8;
}

.terminal-title-label {
  margin-left: 5px;
}

.terminal-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

.terminal-action {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  height: 24px;
  width: 24px;
  font-size: 14px;
  padding: 0;
  margin: 0;
}

.terminal-action:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.action-icon {
  font-size: 14px;
}

.terminal-content {
  flex: 1;
  padding: 8px;
  min-height: 200px;
  max-height: 500px;
  overflow: auto;
  border-radius: 0 0 4px 4px;
}

.terminal-content:deep(.xterm) {
  padding: 8px;
}

.terminal-content:deep(.xterm-viewport) {
  background-color: transparent !important;
}

.terminal-content::-webkit-scrollbar {
  width: 10px;
}

.terminal-content::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 4px;
}

.terminal-content::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 120, 0.5);
  border-radius: 4px;
  border: 2px solid rgba(30, 30, 30, 0.1);
}

.terminal-content::-webkit-scrollbar-thumb:hover {
  background: rgba(150, 150, 150, 0.6);
}
</style>