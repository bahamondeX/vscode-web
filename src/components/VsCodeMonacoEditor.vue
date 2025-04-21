<!-- VsCodeMonacoEditor.vue -->
<template>
  <div class="editor-container h-full flex flex-col">
    <!-- Editor header with tabs and actions -->
    <div class="editor-header">
      <div v-if="currentFile" class="breadcrumbs">
        <div class="breadcrumb-item">
          {{ getDirectoryName(currentFile.path) }}
          <span class="breadcrumb-separator">/</span>
          {{ getFileName(currentFile.path) }}
        </div>
      </div>
      
      <div class="editor-actions" v-if="currentFile">
        <button 
          v-if="isEdited" 
          @click="saveFile" 
          class="vscode-button"
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
        <img :src="previewUrl" alt="Image preview" class="preview-content" />
      </div>
      
      <!-- Video Preview -->
      <div 
        v-if="fileType === 'video'" 
        class="preview-container"
      >
        <video controls class="preview-content">
          <source :src="previewUrl" :type="mimeType">
          Your browser does not support the video tag.
        </video>
      </div>
      
      <!-- Audio Preview -->
      <div 
        v-if="fileType === 'audio'" 
        class="preview-container"
      >
        <audio controls class="preview-content-audio">
          <source :src="previewUrl" :type="mimeType">
          Your browser does not support the audio tag.
        </audio>
      </div>
      
      <!-- Document Preview (PDF, etc) -->
      <div 
        v-if="fileType === 'document'" 
        class="document-container"
      >
        <iframe :src="previewUrl" class="document-frame" frameborder="0"></iframe>
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
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import * as monaco from 'monaco-editor';

// Props
const props = defineProps({
  webcontainer: {
    type: Object,
    required: true
  },
  currentFile: {
    type: Object,
    default: null
  }
});

// Emits
const emit = defineEmits(['file-saved']);

// Refs
const monacoContainer = ref(null);
const editor = ref(null);
const fileContent = ref('');
const originalContent = ref('');
const fileType = ref(null);
const mimeType = ref(null);
const previewUrl = ref(null);
const isEdited = ref(false);

// File loading
const loadFile = async (file) => {
  try {
    // Clean up previous file
    resetEditor();
    
    // Determine file type and mime type
    const extension = file.path.split('.').pop().toLowerCase();
    fileType.value = getFileType(extension);
    mimeType.value = getMimeType(extension);
    
    // Read file content from webcontainer
    let content = '';
    
    try {
      const fileData = await props.webcontainer.fs.readFile(file.path);
      content = new TextDecoder().decode(fileData);
    } catch (err) {
      console.error('Error reading file:', err);
      content = `// Failed to load ${file.path}\n// ${err.message}`;
    }
    
    fileContent.value = content;
    originalContent.value = content;
    
    if (fileType.value === 'code') {
      initMonacoEditor(extension, content);
    } else if (['image', 'video', 'audio', 'document'].includes(fileType.value)) {
      createBlobUrl(fileData, mimeType.value);
    }
    
    isEdited.value = false;
  } catch (error) {
    console.error('Error loading file:', error);
    fileContent.value = `Error loading file: ${error.message}`;
    fileType.value = 'plaintext';
  }
};

// Monaco Editor initialization
const initMonacoEditor = (extension, content) => {
  if (editor.value) {
    editor.value.dispose();
  }
  
  const language = getMonacoLanguage(extension);
  
  if (monacoContainer.value) {
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
      tabSize: 2
    });
    
    // Listen for content changes
    editor.value.onDidChangeModelContent(() => {
      fileContent.value = editor.value.getValue();
      isEdited.value = fileContent.value !== originalContent.value;
    });
    
    // Focus editor
    editor.value.focus();
  }
};

// Create blob URL for previews
const createBlobUrl = (data, type) => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  
  const blob = new Blob([data], { type });
  previewUrl.value = URL.createObjectURL(blob);
};

// Utility functions
const getFileType = (extension) => {
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

const getMonacoLanguage = (extension) => {
  const languageMap = {
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

const getMimeType = (extension) => {
  const mimeMap = {
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

const getDirectoryName = (path) => {
  const parts = path.split('/');
  return parts[parts.length - 2] || '';
};

const getFileName = (path) => {
  const parts = path.split('/');
  return parts[parts.length - 1] || '';
};

// File operations
const saveFile = async () => {
  if (!props.currentFile) return;
  
  try {
    const content = fileType.value === 'code' ? editor.value.getValue() : fileContent.value;
    
    // Write to webcontainer
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    await props.webcontainer.fs.writeFile(props.currentFile.path, data);
    
    originalContent.value = content;
    isEdited.value = false;
    
    // Emit event
    emit('file-saved', props.currentFile);
  } catch (error) {
    console.error('Error saving file:', error);
    alert(`Failed to save file: ${error.message}`);
  }
};

const formatCode = () => {
  if (!editor.value) return;
  
  editor.value.getAction('editor.action.formatDocument').run();
};

const resetEditor = () => {
  fileContent.value = '';
  originalContent.value = '';
  isEdited.value = false;
  fileType.value = null;
  
  if (editor.value) {
    editor.value.dispose();
    editor.value = null;
  }
  
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
  }
};

// Watch for file changes
watch(() => props.currentFile, (newFile) => {
  if (newFile) {
    loadFile(newFile);
  } else {
    resetEditor();
  }
}, { immediate: true });

// Lifecycle hooks
onMounted(() => {
  // Setup Monaco environment
  monaco.editor.defineTheme('vs-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#1e1e1e'
    }
  });
});

onBeforeUnmount(() => {
  // Cleanup
  if (editor.value) {
    editor.value.dispose();
  }
  
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
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
</style>