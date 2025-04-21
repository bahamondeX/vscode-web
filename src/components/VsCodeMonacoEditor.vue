<!-- VsCodeMonacoEditor.vue -->
<template>
  <div class="editor-container h-full flex flex-col">
    <!-- Editor header with tabs and actions -->
    <div class="editor-header">
      <div v-if="currentFile" class="breadcrumbs">
        <div class="breadcrumb-item">
          {{ getDirectoryName(currentFile.path) }}
          <span class="breadcrumb-separator">/</span>
          <span :class="{ 'modified': isEdited }">{{ getFileName(currentFile.path) }}</span>
        </div>
      </div>
      
      <div class="editor-actions" v-if="currentFile">
        <button 
          v-if="isEdited" 
          @click="saveFile" 
          class="vscode-button save-button"
        >
          Save
        </button>
        <button 
          v-if="fileType === 'code'" 
          @click="formatCode" 
          class="vscode-button secondary"
        >
          Format
        </button>
      </div>
    </div>
    
    <div class="editor-content">
      <!-- Monaco Editor -->
      <div 
        v-show="fileType === 'code'" 
        ref="monacoContainer" 
        class="monaco-container"
      ></div>
      
      <!-- Image Preview -->
      <div 
        v-if="fileType === 'image'" 
        class="preview-container"
      >
        <img :src="previewUrl || ''" alt="Image preview" class="preview-content" />
      </div>
      
      <!-- Video Preview -->
      <div 
        v-if="fileType === 'video'" 
        class="preview-container"
      >
        <video controls class="preview-content">
          <source :src="previewUrl || ''" :type="mimeType || 'video/mp4'">
          Your browser does not support the video tag.
        </video>
      </div>
      
      <!-- Audio Preview -->
      <div 
        v-if="fileType === 'audio'" 
        class="preview-container"
      >
        <audio controls class="preview-content-audio">
          <source :src="previewUrl || ''" :type="mimeType || 'audio/mpeg'">
          Your browser does not support the audio tag.
        </audio>
      </div>
      
      <!-- Document Preview (PDF, etc) -->
      <div 
        v-if="fileType === 'document'" 
        class="document-container"
      >
        <iframe :src="previewUrl || ''" class="document-frame" frameborder="0"></iframe>
      </div>
      
      <!-- Plain text fallback -->
      <div 
        v-if="fileType === 'plaintext'" 
        class="plaintext-container"
      >
        {{ fileContent }}
      </div>
      
      <!-- No file selected -->
      <div 
        v-if="!currentFile" 
        class="empty-editor-message"
      >
        Select a file from the explorer to start editing
      </div>
    </div>
    
    <!-- Status bar for editor -->
    <div class="editor-statusbar" v-if="currentFile">
      <div class="editor-status-left">
        <span v-if="currentFile">{{ getLanguageDisplay() }}</span>
      </div>
      <div class="editor-status-right">
        <span v-if="cursorPosition">Ln {{ cursorPosition.lineNumber }}, Col {{ cursorPosition.column }}</span>
        <span class="editor-status-separator">|</span>
        <span>Spaces: 2</span>
        <span class="editor-status-separator">|</span>
        <span>UTF-8</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as monaco from 'monaco-editor';

// Configure Monaco Environment
self.MonacoEnvironment = {
  getWorkerUrl: function (workerId, label) {
    return new URL('/src/workers/monaco.worker.js', import.meta.url).toString();
  }
};

// Types
interface FileProps {
  path: string;
  name: string;
  type: string;
}

interface CursorPosition {
  lineNumber: number;
  column: number;
}

interface FileChangeEvent {
  path: string;
  content: string;
  isModified: boolean;
}

interface FileSaveEvent {
  path: string;
  content: string;
}

// Props
const props = defineProps<{
  webcontainer: any;
  currentFile: FileProps | null;
}>();

// Emits
const emit = defineEmits<{
  'file-saved': [event: FileSaveEvent];
  'content-changed': [event: FileChangeEvent];
}>();

// Refs
const monacoContainer = ref<HTMLElement | null>(null);
const editor = ref<monaco.editor.IStandaloneCodeEditor | null>(null);
const fileContent = ref('');
const originalContent = ref('');
const fileType = ref<string | null>(null);
const mimeType = ref<string | null>(null);
const previewUrl = ref<string | null>(null);
const isEdited = ref(false);
const cursorPosition = ref<CursorPosition>({ lineNumber: 1, column: 1 });
const decorations = ref<string[]>([]);
const worker = ref<Worker | null>(null);

// File loading
const loadFile = async (file: FileProps) => {
  try {
    // Clean up previous file
    resetEditor();
    
    // Determine file type and mime type
    const extension = file.path.split('.').pop()?.toLowerCase() || '';
    fileType.value = getFileType(extension);
    mimeType.value = getMimeType(extension);
    
    // Read file content from webcontainer
    let content = '';
    let fileData: ArrayBuffer | Uint8Array;
    
    try {
      fileData = await props.webcontainer.fs.readFile(file.path);
      content = new TextDecoder().decode(fileData);
    } catch (err: any) {
      console.error('Error reading file:', err);
      content = `// Failed to load ${file.path}\n// ${err.message}`;
      fileData = new TextEncoder().encode(content);
    }
    
    fileContent.value = content;
    originalContent.value = content;
    
    if (fileType.value === 'code') {
      await nextTick();
      initMonacoEditor(extension, content);
    } else if (['image', 'video', 'audio', 'document'].includes(fileType.value || '')) {
      createBlobUrl(fileData, mimeType.value || 'application/octet-stream');
    }
    
    isEdited.value = false;
  } catch (error: any) {
    console.error('Error loading file:', error);
    fileContent.value = `Error loading file: ${error.message}`;
    fileType.value = 'plaintext';
  }
};

// Initialize the worker
const initWorker = () => {
  if (worker.value) return;
  
  try {
    worker.value = new Worker(new URL('/src/workers/monaco.worker.js', import.meta.url), { type: 'module' });
    
    worker.value.addEventListener('message', (e) => {
      const { type, payload } = e.data;
      
      switch (type) {
        case 'ready':
          console.log('Monaco worker is ready');
          worker.value?.postMessage({ type: 'init' });
          break;
          
        case 'initialized':
          console.log('Monaco worker initialized');
          break;
          
        case 'validation-result':
          // Handle validation results
          if (editor.value && payload.uri) {
            // Update markers or show validation results
            console.log('Validation results:', payload.markers);
          }
          break;
          
        case 'format-result':
          if (payload.success && editor.value) {
            // Apply formatted text to editor
            editor.value.setValue(payload.text);
            
            // Check if content has changed
            const newContent = editor.value.getValue();
            isEdited.value = newContent !== originalContent.value;
            
            // Update decorations
            updateModifiedLines();
          } else if (!payload.success) {
            console.error('Format error:', payload.error);
          }
          break;
      }
    });
    
    worker.value.addEventListener('error', (e) => {
      console.error('Monaco worker error:', e);
    });
  } catch (error) {
    console.error('Failed to initialize Monaco worker:', error);
  }
};

// Monaco Editor initialization
const initMonacoEditor = (extension: string, content: string) => {
  if (editor.value) {
    editor.value.dispose();
  }
  
  const language = getMonacoLanguage(extension);
  
  if (monacoContainer.value) {
    // Initialize Monaco editor
    editor.value = monaco.editor.create(monacoContainer.value, {
      value: content,
      language,
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: {
        enabled: true
      },
      scrollBeyondLastLine: false,
      fontSize: 14,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      tabSize: 2,
      fixedOverflowWidgets: true,
      suggest: {
        showWords: true,
        showSnippets: true,
        showClasses: true,
        showFunctions: true
      }
    });
    
    // Set up content change event listener
    const contentChangeDisposable = editor.value.onDidChangeModelContent(() => {
      if (!editor.value) return;
      
      const newContent = editor.value.getValue();
      fileContent.value = newContent;
      isEdited.value = newContent !== originalContent.value;
      
      emit('content-changed', {
        path: props.currentFile?.path || '',
        content: newContent,
        isModified: isEdited.value
      });
      
      // Add modified line decorations
      updateModifiedLines();
      
      // Request validation from worker
      if (worker.value && props.currentFile) {
        worker.value.postMessage({
          type: 'validate',
          payload: {
            uri: monaco.Uri.file(props.currentFile.path).toString(),
            languageId: language,
            code: newContent
          }
        });
      }
    });
    
    // Set up cursor position event listener
    const cursorPositionDisposable = editor.value.onDidChangeCursorPosition((e) => {
      cursorPosition.value = e.position;
    });
    
    // Focus editor
    editor.value.focus();
    
    // Store disposables for cleanup
    if (editor.value) {
      (editor.value as any)._contentChangeDisposable = contentChangeDisposable;
      (editor.value as any)._cursorPositionDisposable = cursorPositionDisposable;
    }
  }
};

// Update modified line decorations
const updateModifiedLines = () => {
  if (!editor.value) return;
  
  // Clear previous decorations
  decorations.value = editor.value.deltaDecorations(decorations.value, []);
  
  // If not modified, no need to highlight anything
  if (!isEdited.value) return;
  
  // Get diff between original and current content
  const originalLines = originalContent.value.split('\n');
  const currentLines = editor.value.getValue().split('\n');
  
  // Find modified lines
  const modifiedDecorations = [];
  const maxLines = Math.max(originalLines.length, currentLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const originalLine = originalLines[i] || '';
    const currentLine = currentLines[i] || '';
    
    if (originalLine !== currentLine) {
      modifiedDecorations.push({
        range: new monaco.Range(i + 1, 1, i + 1, 1),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: 'modified-line-decoration',
          overviewRuler: {
            color: '#007acc',
            position: monaco.editor.OverviewRulerLane.Right
          }
        }
      });
    }
  }
  
  // Apply decorations
  decorations.value = editor.value.deltaDecorations(decorations.value, modifiedDecorations);
};

// Create blob URL for previews
const createBlobUrl = (data: ArrayBuffer | Uint8Array, type: string) => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  
  const blob = new Blob([data], { type });
  previewUrl.value = URL.createObjectURL(blob);
};

// Utility functions
const getFileType = (extension: string): string => {
  const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'json', 'md', 'py', 'php', 'java', 'c', 'cpp', 'cs', 'go', 'rs'];
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
  const videoExtensions = ['mp4', 'webm', 'ogg'];
  const audioExtensions = ['mp3', 'wav', 'ogg'];
  const documentExtensions = ['pdf'];
  
  if (codeExtensions.includes(extension)) {
    return 'code';
  } else if (imageExtensions.includes(extension)) {
    return 'image';
  } else if (videoExtensions.includes(extension)) {
    return 'video';
  } else if (audioExtensions.includes(extension)) {
    return 'audio';
  } else if (documentExtensions.includes(extension)) {
    return 'document';
  } else {
    return 'plaintext';
  }
};

const getMonacoLanguage = (extension: string): string => {
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'php': 'php',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust'
  };
  
  return languageMap[extension] || 'plaintext';
};

const getLanguageDisplay = (): string => {
  if (!props.currentFile) return '';
  
  const extension = props.currentFile.path.split('.').pop()?.toLowerCase() || '';
  const languageDisplayMap: Record<string, string> = {
    'js': 'JavaScript',
    'jsx': 'JavaScript (JSX)',
    'ts': 'TypeScript',
    'tsx': 'TypeScript (JSX)',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'json': 'JSON',
    'md': 'Markdown',
    'py': 'Python',
    'php': 'PHP',
    'java': 'Java',
    'c': 'C',
    'cpp': 'C++',
    'cs': 'C#',
    'go': 'Go',
    'rs': 'Rust'
  };
  
  return languageDisplayMap[extension] || 'Plain Text';
};

const getMimeType = (extension: string): string => {
  const mimeMap: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogg': 'video/ogg',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'pdf': 'application/pdf'
  };
  
  return mimeMap[extension] || 'text/plain';
};

const getDirectoryName = (path: string): string => {
  const parts = path.split('/');
  return parts[parts.length - 2] || '';
};

const getFileName = (path: string): string => {
  const parts = path.split('/');
  return parts[parts.length - 1] || '';
};

// File operations
const saveFile = async () => {
  if (!props.currentFile) return;
  
  try {
    const content = fileType.value === 'code' && editor.value 
      ? editor.value.getValue() 
      : fileContent.value;
    
    // Write to webcontainer
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    await props.webcontainer.fs.writeFile(props.currentFile.path, data);
    
    originalContent.value = content;
    isEdited.value = false;
    
    // Clear modified decorations
    if (editor.value) {
      decorations.value = editor.value.deltaDecorations(decorations.value, []);
    }
    
    // Emit event
    emit('file-saved', {
      path: props.currentFile.path,
      content: content
    });
  } catch (error: any) {
    console.error('Error saving file:', error);
    alert(`Failed to save file: ${error.message}`);
  }
};

const formatCode = () => {
  if (!editor.value) return;
  
  if (worker.value) {
    // Use worker for formatting
    worker.value.postMessage({
      type: 'format',
      payload: {
        text: editor.value.getValue(),
        options: {
          tabSize: 2,
          insertSpaces: true
        }
      }
    });
  } else {
    // Fallback to editor action
    editor.value.getAction('editor.action.formatDocument')?.run().then(() => {
      if (!editor.value) return;
      
      // Update content after formatting
      fileContent.value = editor.value.getValue();
      isEdited.value = fileContent.value !== originalContent.value;
      updateModifiedLines();
    });
  }
};

const resetEditor = () => {
  fileContent.value = '';
  originalContent.value = '';
  isEdited.value = false;
  fileType.value = null;
  cursorPosition.value = { lineNumber: 1, column: 1 };
  
  if (editor.value) {
    // Dispose event listeners
    if ((editor.value as any)._contentChangeDisposable) {
      (editor.value as any)._contentChangeDisposable.dispose();
    }
    if ((editor.value as any)._cursorPositionDisposable) {
      (editor.value as any)._cursorPositionDisposable.dispose();
    }
    
    // Dispose editor
    editor.value.dispose();
    editor.value = null;
  }
  
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
  }
  
  decorations.value = [];
};

// Support keyboard shortcuts
const setupKeyboardShortcuts = () => {
  if (!editor.value) return;
  
  // Add Ctrl+S / Cmd+S save shortcut
  editor.value.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    if (isEdited.value) {
      saveFile();
    }
  });
};

// Event handler for window keydown
const handleKeyDown = (e: KeyboardEvent) => {
  // Prevent browser's save shortcut
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (isEdited.value && props.currentFile) {
      saveFile();
    }
  }
};

// Watch for file changes
watch(() => props.currentFile, async (newFile) => {
  if (newFile) {
    await loadFile(newFile);
    setupKeyboardShortcuts();
  } else {
    resetEditor();
  }
}, { immediate: true });

// Lifecycle hooks
onMounted(() => {
  // Initialize monaco worker
  initWorker();
  
  // Setup Monaco environment
  monaco.editor.defineTheme('vs-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955' },
      { token: 'keyword', foreground: '569CD6' },
      { token: 'string', foreground: 'CE9178' }
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.lineHighlightBackground': '#2a2d2e',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#c6c6c6'
    }
  });
  
  // Register window event handlers
  window.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  // Cleanup
  if (editor.value) {
    if ((editor.value as any)._contentChangeDisposable) {
      (editor.value as any)._contentChangeDisposable.dispose();
    }
    if ((editor.value as any)._cursorPositionDisposable) {
      (editor.value as any)._cursorPositionDisposable.dispose();
    }
    editor.value.dispose();
  }
  
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  
  // Terminate worker
  if (worker.value) {
    worker.value.terminate();
    worker.value = null;
  }
  
  // Remove event listeners
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
/* Using the VS Code theme variables */
.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--vscode-editor-bg, #1e1e1e);
  color: var(--vscode-text, #cccccc);
}

/* Editor header */
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--vscode-editor-bg, #1e1e1e);
  border-bottom: 1px solid var(--vscode-border, #474747);
  padding: 0 10px;
  height: 24px;
}

.breadcrumbs {
  display: flex;
  align-items: center;
  font-size: 12px;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.breadcrumb-item:hover {
  text-decoration: underline;
}

.breadcrumb-separator {
  margin: 0 8px;
  opacity: 0.6;
}

.modified {
  color: #e2c08d;
  font-style: italic;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

/* Editor content */
.editor-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.monaco-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.preview-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--vscode-editor-bg, #1e1e1e);
  padding: 16px;
}

.preview-content {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
}

.preview-content-audio {
  width: 80%;
}

.document-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.document-frame {
  width: 100%;
  height: 100%;
  border: none;
}

.plaintext-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow: auto;
}

.empty-editor-message {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vscode-inactive-text, #969696);
  font-size: 14px;
}

/* Editor status bar */
.editor-statusbar {
  height: 22px;
  display: flex;
  align-items: center;
  background-color: var(--vscode-editor-bg, #1e1e1e);
  border-top: 1px solid var(--vscode-border, #474747);
  padding: 0 10px;
  font-size: 12px;
  color: var(--vscode-inactive-text, #969696);
}

.editor-status-left {
  flex: 1;
}

.editor-status-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.editor-status-separator {
  opacity: 0.5;
}

/* Button Styles */
.vscode-button {
  background-color: var(--vscode-button, #0e639c);
  color: white;
  border: none;
  padding: 2px 8px;
  border-radius: 2px;
  cursor: pointer;
  font-size: 12px;
  height: 20px;
}

.vscode-button:hover {
  background-color: var(--vscode-button-hover, #1177bb);
}

.vscode-button.secondary {
  background-color: transparent;
  color: var(--vscode-text, #cccccc);
  border: 1px solid var(--vscode-border, #474747);
}

.vscode-button.secondary:hover {
  background-color: rgba(128, 128, 128, 0.1);
}

.save-button {
  position: relative;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

/* Line decorations for modified lines */
:deep(.modified-line-decoration) {
  background-color: rgba(30, 84, 128, 0.4);
  width: 5px !important;
  margin-left: 3px;
}
</style>