<!-- VsCodeTerminal.vue -->
<template>
  <div class="terminal-container">
    <div class="terminal-header">
      <div class="terminal-title">
        <span class="terminal-icon">></span>
        <span class="terminal-title-label">Terminal</span>
      </div>
      <div class="terminal-actions">
        <div class="terminal-action" @click="clearTerminal">
          <span class="action-icon">🧹</span>
        </div>
        <div class="terminal-action" @click="createNewTerminal">
          <span class="action-icon">+</span>
        </div>
        <div class="terminal-action" @click="openSettings">
          <span class="action-icon">⚙️</span>
        </div>
        <div class="terminal-action" @click="closeTerminal">
          <span class="action-icon">×</span>
        </div>
      </div>
    </div>
    <div 
      ref="terminalElement" 
      class="terminal-content"
    ></div>
    <div v-show="false" class="terminal-input-container">
      <!-- Hidden in native xterm mode but kept for non-xterm fallback -->
      <span class="prompt">$</span>
      <input
        ref="terminalInput"
        v-model="command"
        @keyup.enter="executeCommand"
        class="terminal-input"
        placeholder="Enter command..."
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineProps, defineEmits } from 'vue';

// Props
const props = defineProps({
  webcontainer: {
    type: Object,
    required: true
  }
});

// Emits
const emit = defineEmits(['terminal-closed', 'terminal-created']);

// Refs
const terminalElement = ref(null);
const terminalInput = ref(null);
const command = ref('');
const terminal = ref(null);
const fitAddon = ref(null);
const shellProcess = ref(null);
let commandHistory = [];
let historyIndex = -1;

// Mock xterm for demo
class MockTerminal {
  constructor(options) {
    this.options = options || {};
    this.element = null;
    this.lines = [];
    this.cursorX = 0;
    this.cursorY = 0;
    this.keyHandlers = [];
    this.inputBuffer = '';
    this.prompt = '$ ';
    this.promptLength = this.prompt.length;
  }

  open(element) {
    this.element = element;
    this.render();
  }

  write(text) {
    // Handle special characters like \r\n
    const parts = text.split(/(\r\n|\n)/g);
    
    for (const part of parts) {
      if (part === '\r\n' || part === '\n') {
        this.lines.push('');
        this.cursorX = 0;
        this.cursorY++;
      } else if (part.includes('\r')) {
        // Handle carriage return
        this.cursorX = 0;
        this.lines[this.cursorY] = '';
      } else {
        // Append text to current line
        if (!this.lines[this.cursorY]) {
          this.lines[this.cursorY] = '';
        }
        
        // Parse ANSI colors
        const coloredText = this.parseAnsiColors(part);
        this.lines[this.cursorY] += coloredText;
        this.cursorX += part.length;
      }
    }
    
    // Keep only the last 500 lines
    if (this.lines.length > 500) {
      this.lines = this.lines.slice(-500);
    }
    
    this.render();
  }

  writeln(text) {
    this.write(text + '\r\n');
  }

  clear() {
    this.lines = [];
    this.cursorX = 0;
    this.cursorY = 0;
    this.render();
  }

  focus() {
    if (this.element) {
      this.element.focus();
    }
  }

  onKey(callback) {
    if (!this.keyHandlers.includes(callback)) {
      this.keyHandlers.push(callback);
    }
    
    // Ensure we only add the event listener once
    if (this.keyHandlers.length === 1) {
      window.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
  }

  handleKeyDown(e) {
    // Only process keys when terminal is in focus
    if (document.activeElement !== document.body && 
        !this.element.contains(document.activeElement)) {
      return;
    }
    
    // Prevent default for terminal keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      e.preventDefault();
    }
    
    for (const handler of this.keyHandlers) {
      handler({ key: e.key, domEvent: e });
    }
  }

  // Parse basic ANSI color codes for better terminal visualization
  parseAnsiColors(text) {
    // Replace ANSI color codes with spans
    // This is a simplified version, a real implementation would handle more codes
    const colorMap = {
      '\x1b[0m': '</span>',  // Reset
      '\x1b[30m': '<span style="color: #000000">', // Black
      '\x1b[31m': '<span style="color: #ff0000">', // Red
      '\x1b[32m': '<span style="color: #00ff00">', // Green
      '\x1b[33m': '<span style="color: #ffff00">', // Yellow
      '\x1b[34m': '<span style="color: #0000ff">', // Blue
      '\x1b[35m': '<span style="color: #ff00ff">', // Magenta
      '\x1b[36m': '<span style="color: #00ffff">', // Cyan
      '\x1b[37m': '<span style="color: #ffffff">', // White
    };
    
    let result = text;
    for (const [code, span] of Object.entries(colorMap)) {
      result = result.split(code).join(span);
    }
    
    return result;
  }

  render() {
    if (!this.element) return;
    
    // Clear the element
    this.element.innerHTML = '';
    
    // Create the terminal content with iTerm2-like styling
    const terminalContent = document.createElement('div');
    terminalContent.className = 'mock-terminal-content';
    
    // Add all lines
    for (const line of this.lines) {
      const lineElement = document.createElement('div');
      lineElement.className = 'mock-terminal-line';
      lineElement.innerHTML = line || ' ';
      terminalContent.appendChild(lineElement);
    }
    
    // Add cursor line if there's no content or to continue input
    const cursorLine = document.createElement('div');
    cursorLine.className = 'mock-terminal-line input-line';
    
    if (this.lines.length === 0) {
      cursorLine.innerHTML = `<span class="mock-terminal-prompt">${this.prompt}</span><span class="mock-terminal-input">${this.inputBuffer}</span><span class="mock-terminal-cursor"></span>`;
    } else {
      const lastLine = this.lines[this.lines.length - 1];
      if (!lastLine.endsWith(this.prompt)) {
        cursorLine.innerHTML = `<span class="mock-terminal-prompt">${this.prompt}</span><span class="mock-terminal-input">${this.inputBuffer}</span><span class="mock-terminal-cursor"></span>`;
      } else {
        // The prompt is already shown, just add input buffer and cursor
        this.lines.pop(); // Remove the line with just the prompt
        cursorLine.innerHTML = `<span class="mock-terminal-prompt">${this.prompt}</span><span class="mock-terminal-input">${this.inputBuffer}</span><span class="mock-terminal-cursor"></span>`;
      }
    }
    
    terminalContent.appendChild(cursorLine);
    
    // Add the content to the element
    this.element.appendChild(terminalContent);
    
    // Scroll to bottom
    this.element.scrollTop = this.element.scrollHeight;
  }

  dispose() {
    // Clean up event listeners
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    this.keyHandlers = [];
  }
}

class MockFitAddon {
  constructor() {}
  
  fit() {
    // Mock implementation for resize handling
  }
}

// Terminal utility functions
const handleResize = () => {
  if (fitAddon.value) {
    fitAddon.value.fit();
  }
};

const clearTerminal = () => {
  if (terminal.value) {
    terminal.value.clear();
    terminal.value.write('$ ');
  }
};

const createNewTerminal = () => {
  // In a real implementation, this would create a new terminal instance
  // For the mock, just clear the current terminal
  clearTerminal();
  emit('terminal-created');
};

const openSettings = () => {
  if (terminal.value) {
    terminal.value.writeln('Opening terminal settings...');
    terminal.value.write('$ ');
  }
};

const closeTerminal = () => {
  emit('terminal-closed');
};

// Process input from the terminal
const processTerminalInput = (input) => {
  if (!input.trim()) return;
  
  // Add to command history
  commandHistory.push(input);
  if (commandHistory.length > 50) {
    commandHistory.shift(); // Keep only last 50 commands
  }
  historyIndex = commandHistory.length;
  
  terminal.value.writeln(`$ ${input}`);
  
  // Handle command execution
  executeInputCommand(input);
};

// Command execution for the mock terminal
const executeInputCommand = (cmd) => {
  const command = cmd.trim();
  const args = command.split(' ');
  const mainCommand = args[0];
  
  switch (mainCommand) {
    case 'clear':
      clearTerminal();
      break;
    
    case 'ls':
      if (args.includes('-la') || args.includes('-al')) {
        terminal.value.writeln('total 64');
        terminal.value.writeln('drwxr-xr-x  15 user  staff   480 Feb 15 10:23 .');
        terminal.value.writeln('drwxr-xr-x   3 user  staff    96 Feb 15 10:23 ..');
        terminal.value.writeln('drwxr-xr-x  12 user  staff   384 Feb 15 10:23 .git');
        terminal.value.writeln('-rw-r--r--   1 user  staff  2263 Feb 15 10:23 package.json');
        terminal.value.writeln('drwxr-xr-x   7 user  staff   224 Feb 15 10:23 src');
        terminal.value.writeln('drwxr-xr-x   6 user  staff   192 Feb 15 10:23 public');
        terminal.value.writeln('-rw-r--r--   1 user  staff   782 Feb 15 10:23 vite.config.js');
      } else {
        terminal.value.writeln('src    public    package.json    vite.config.js');
      }
      break;
    
    case 'cd':
      if (args.length === 1) {
        terminal.value.writeln(''); // Just newline for cd without args
      } else {
        terminal.value.writeln(''); // In mock, we pretend to change directory
      }
      break;
    
    case 'npm':
      if (args[1] === 'run' && args[2] === 'dev') {
        terminal.value.writeln('\x1b[32m> project@1.0.0 dev\x1b[0m');
        terminal.value.writeln('\x1b[32m> vite\x1b[0m');
        terminal.value.writeln('');
        terminal.value.writeln('\x1b[36mVITE\x1b[0m v4.1.1 ready in 270 ms');
        terminal.value.writeln('');
        terminal.value.writeln('  \x1b[32m➜\x1b[0m  \x1b[37mLocal\x1b[0m:   \x1b[36mhttp://localhost:5173/\x1b[0m');
        terminal.value.writeln('  \x1b[32m➜\x1b[0m  \x1b[37mNetwork\x1b[0m: use \x1b[36m--host\x1b[0m to expose');
        terminal.value.writeln('  \x1b[32m➜\x1b[0m  press \x1b[37mh\x1b[0m to show help');
        terminal.value.writeln('');
        // Don't show the prompt here as npm run dev is "running"
        return; // Skip adding prompt at the end
      } else {
        terminal.value.writeln(`Unknown npm command: ${args.slice(1).join(' ')}`);
      }
      break;
    
    case 'echo':
      terminal.value.writeln(args.slice(1).join(' '));
      break;
    
    case 'help':
      terminal.value.writeln('Available commands in this demo:');
      terminal.value.writeln('  - clear: Clear the terminal');
      terminal.value.writeln('  - ls [-la]: List files');
      terminal.value.writeln('  - cd [dir]: Change directory');
      terminal.value.writeln('  - npm run dev: Start development server');
      terminal.value.writeln('  - echo [text]: Echo text');
      terminal.value.writeln('  - help: Show this help');
      break;
    
    default:
      terminal.value.writeln(`Command not found: ${mainCommand}`);
  }
  
  // Add prompt for next command
  terminal.value.write('$ ');
};

// Command execution for the alternative input field
const executeCommand = async () => {
  if (!command.value.trim()) return;
  
  processTerminalInput(command.value);
  
  // Clear the command input
  command.value = '';
};

// Terminal initialization
const initTerminal = () => {
  // Create the terminal
  terminal.value = new MockTerminal({
    cursorBlink: true,
    theme: {
      background: '#1e1e1e',
      foreground: '#f0f0f0'
    },
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 14
  });
  
  fitAddon.value = new MockFitAddon();
  
  // Open the terminal in the container element
  terminal.value.open(terminalElement.value);
  fitAddon.value.fit();
  
  // Initial content
  setTimeout(() => {
    terminal.value.writeln('VS Code Terminal [Version 1.75.0]');
    terminal.value.writeln('(c) Microsoft Corporation. All rights reserved.');
    terminal.value.writeln('');
    
    // Add the initial prompt
    terminal.value.write('$ ');
    
    // Focus the terminal
    terminal.value.focus();
  }, 100);
  
  // Terminal key handling
  terminal.value.onKey(({ key, domEvent }) => {
    const ev = domEvent;
    const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;
    
    if (ev.keyCode === 13) { // Enter key
      // Process the current input buffer
      processTerminalInput(terminal.value.inputBuffer);
      terminal.value.inputBuffer = '';
    } else if (ev.keyCode === 8) { // Backspace
      // Remove the last character from the input buffer
      if (terminal.value.inputBuffer.length > 0) {
        terminal.value.inputBuffer = terminal.value.inputBuffer.slice(0, -1);
        terminal.value.render();
      }
    } else if (ev.keyCode === 38) { // Arrow Up
      // Navigate command history - previous
      if (commandHistory.length > 0 && historyIndex > 0) {
        historyIndex--;
        terminal.value.inputBuffer = commandHistory[historyIndex];
        terminal.value.render();
      }
    } else if (ev.keyCode === 40) { // Arrow Down
      // Navigate command history - next
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        terminal.value.inputBuffer = commandHistory[historyIndex];
      } else {
        historyIndex = commandHistory.length;
        terminal.value.inputBuffer = '';
      }
      terminal.value.render();
    } else if (printable && !ev.key.startsWith('Arrow')) {
      // Add printable characters to the input buffer
      terminal.value.inputBuffer += key;
      terminal.value.render();
    }
  });
};

// Lifecycle hooks
onMounted(() => {
  initTerminal();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  if (terminal.value) {
    terminal.value.dispose();
  }
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
/* VS Code Terminal with iTerm2 styling */
.terminal-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--vscode-terminal-bg, #1e1e1e);
  border-top: 1px solid var(--vscode-border, #474747);
}

.terminal-header {
  display: flex;
  align-items: center;
  padding: 0 10px;
  height: 35px;
  background-color: var(--vscode-sidebar-bg, #252526);
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
}

.terminal-action {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 10px;
  opacity: 0.6;
  cursor: pointer;
  height: 24px;
  width: 24px;
  font-size: 14px;
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
  font-family: 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  overflow: auto;
  color: #f0f0f0;
  background-color: #1a1a1a; /* Slightly darker than VS Code for iTerm2 look */
  border-radius: 4px;
  margin: 0 4px 4px 4px;
  outline: none;
  cursor: text;
}

/* Custom scrollbar for iTerm2 look */
.terminal-content::-webkit-scrollbar {
  width: 10px;
}

.terminal-content::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 4px;
}

.terminal-content::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 120, 0.5);
  border-radius: 4px;
  border: 2px solid #1a1a1a;
}

.terminal-content::-webkit-scrollbar-thumb:hover {
  background: rgba(150, 150, 150, 0.6);
}

/* Input container (for fallback) */
.terminal-input-container {
  display: flex;
  align-items: center;
  padding: 8px;
  background-color: #1a1a1a;
  border-top: 1px solid #333;
  margin: 0 4px 4px 4px;
  border-radius: 0 0 4px 4px;
}

.prompt {
  color: #98c379; /* iTerm2 green prompt color */
  margin-right: 8px;
  font-weight: bold;
}

.terminal-input {
  flex: 1;
  background-color: transparent;
  border: none;
  color: #f0f0f0;
  outline: none;
  font-family: 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 14px;
}

/* Mock terminal styling */
:deep(.mock-terminal-content) {
  display: flex;
  flex-direction: column;
}

:deep(.mock-terminal-line) {
  white-space: pre-wrap;
  min-height: 1.2em;
}

:deep(.mock-terminal-prompt) {
  color: #98c379; /* iTerm2 green prompt color */
  font-weight: bold;
}

:deep(.mock-terminal-input) {
  color: #f0f0f0;
}

:deep(.mock-terminal-cursor) {
  display: inline-block;
  width: 8px;
  height: 16px;
  background-color: #f0f0f0;
  margin-left: 1px;
  animation: blink 1s step-end infinite;
}

:deep(.input-line) {
  display: flex;
  align-items: center;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>