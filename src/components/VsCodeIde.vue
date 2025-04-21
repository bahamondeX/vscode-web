<!-- VsCodeIde.vue -->
<template>
  <div class="web-ide">
    <!-- Title Bar -->
    <div class="titlebar">
      <div class="titlebar-title">VS Code - Web IDE</div>
      <div class="titlebar-buttons">
        <div class="titlebar-button">_</div>
        <div class="titlebar-button">□</div>
        <div class="titlebar-button">✕</div>
      </div>
    </div>
    
    <!-- Main Container -->
    <div class="main-container">
      <!-- Activity Bar -->
      <div class="activity-bar">
        <div class="activity-bar-icon active">
          <span class="icon-folder"></span>
        </div>
        <div class="activity-bar-icon">
          <span>🔍</span>
        </div>
        <div class="activity-bar-icon">
          <span>🔀</span>
        </div>
        <div class="activity-bar-icon">
          <span>🐞</span>
        </div>
        <div class="activity-bar-icon">
          <span>📦</span>
        </div>
      </div>
      
      <!-- Sidebar -->
      <div class="sidebar">
        <div class="sidebar-header">
          Explorer
          <div class="sidebar-actions">
            <div class="sidebar-action">⋯</div>
          </div>
        </div>
        
        <!-- File Explorer -->
        <VsCodeFileExplorer
          :webcontainer="webcontainerRef"
          :file-tree="fileTree"
          :expanded-dirs="expandedDirs"
          :selected-path="selectedPath"
          @select-item="handleSelectItem"
          @context-menu="handleContextMenu"
          @toggle-directory="toggleDirectory"
        />
      </div>
      
      <!-- Editor Area -->
      <div class="editor-area">
        <!-- Tabs -->
        <div class="tabs-container">
          <div v-for="(tab, index) in openTabs" :key="index"
               :class="['tab', activeTabIndex === index ? 'active' : '']"
               @click="setActiveTab(index)">
            <span class="tab-icon" :class="getFileIconClass(tab.name)"></span>
            <span class="tab-label">{{ tab.name }}</span>
            <span class="tab-close" @click.stop="closeTab(index)">×</span>
          </div>
        </div>
        
        <!-- Monaco Editor -->
        <VsCodeMonacoEditor
          v-if="openTabs.length > 0 && webcontainerReady"
          :webcontainer="webcontainerRef"
          :current-file="activeTabIndex >= 0 ? openTabs[activeTabIndex] : null"
          @file-saved="handleFileSaved"
        />
        
        <div v-else class="empty-editor">
          <div class="empty-editor-message">
            {{ webcontainerReady ? 'Select a file from explorer to start editing' : 'Loading WebContainer...' }}
          </div>
        </div>
        
        <!-- Terminal -->
        <div 
          :class="['terminal-wrapper', terminalVisible ? 'terminal-visible' : '']"
          :style="{ height: terminalHeight + 'px' }"
        >
          <div class="terminal-resize-handle" @mousedown="startTerminalResize"></div>
          <VsCodeTerminal 
            v-if="webcontainerReady" 
            :webcontainer="webcontainerRef" 
            @terminal-closed="handleTerminalClosed" 
          />
        </div>
      </div>
    </div>
    
    <!-- Status Bar -->
    <div class="statusbar">
      <div class="statusbar-section">
        <span class="statusbar-icon">🔀</span>
        <span>main</span>
      </div>
      <div class="right-status">
        <div class="statusbar-section">Ln 1, Col 1</div>
        <div class="statusbar-section">Spaces: 2</div>
        <div class="statusbar-section">UTF-8</div>
        <div class="statusbar-section">JavaScript</div>
        <div class="statusbar-section" @click="toggleTerminal">
          <span class="statusbar-icon">></span>
          Terminal
        </div>
      </div>
    </div>
    
    <!-- Context Menu (conditionally rendered) -->
    <div v-if="showContextMenu" class="context-menu" :style="contextMenuStyle">
      <div class="context-menu-item" @click="handleContextMenuAction('new-file')">
        <span class="context-menu-icon">📄</span>
        New File
      </div>
      <div class="context-menu-item" @click="handleContextMenuAction('new-folder')">
        <span class="context-menu-icon">📁</span>
        New Folder
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="handleContextMenuAction('rename')">
        <span class="context-menu-icon">✏️</span>
        Rename
      </div>
      <div class="context-menu-item" @click="handleContextMenuAction('delete')">
        <span class="context-menu-icon">🗑️</span>
        Delete
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { WebContainer } from '@webcontainer/api';
import VsCodeFileExplorer from './VsCodeFileExplorer.vue';
import VsCodeMonacoEditor from './VsCodeMonacoEditor.vue';
import VsCodeTerminal from './VsCodeTerminal.vue';

// WebContainer state
const webcontainerRef = ref(null);
const webcontainerReady = ref(false);

// File system state
const fileTree = ref([]);
const expandedDirs = ref(['/src', '/src/components', '/src/styles', '/public']);
const selectedPath = ref('');
const openTabs = ref([]);
const activeTabIndex = ref(-1);

// Terminal state
const terminalVisible = ref(true);
const terminalHeight = ref(300); // Default height
const isResizingTerminal = ref(false);

// Context menu state
const showContextMenu = ref(false);
const contextMenuStyle = ref({});
const contextMenuTarget = ref(null);

// Initialize WebContainer
const initWebContainer = async () => {
  try {
    console.log('Booting WebContainer...');
    // Boot the WebContainer
    webcontainerRef.value = await WebContainer.boot();
    console.log('WebContainer booted successfully');
    
    // Initialize the file system with initial files
    await loadFileSystem();
    
    // Update file tree after initial file system is loaded
    await refreshFileTree();
    
    webcontainerReady.value = true;
  } catch (error) {
    console.error('Failed to initialize WebContainer:', error);
  }
};

// Load initial file system into WebContainer
const loadFileSystem = async () => {
  try {
    console.log('Loading file system...');
    // Create a simple project structure
    const files = {
      'package.json': {
        file: {
          contents: JSON.stringify({
            name: "vscode-web-ide",
            version: "1.0.0",
            description: "A VS Code-like Web IDE using WebContainer",
            main: "index.js",
            scripts: {
              "start": "node index.js"
            }
          }, null, 2)
        }
      },
      'index.js': {
        file: {
          contents: `console.log("Hello from WebContainer!");`
        }
      },
      'README.md': {
        file: {
          contents: `# WebContainer VS Code IDE\n\nA VS Code-like Web IDE using WebContainer API.`
        }
      },
      'src': {
        directory: {
          'App.js': {
            file: {
              contents: `function App() {\n  return <div>Hello World</div>;\n}\n\nexport default App;`
            }
          },
          'main.js': {
            file: {
              contents: `import App from './App';\n\ndocument.getElementById('root').appendChild(App());`
            }
          },
          'components': {
            directory: {
              'Button.js': {
                file: {
                  contents: `function Button({ onClick, children }) {\n  return <button onClick={onClick}>{children}</button>;\n}\n\nexport default Button;`
                }
              },
              'Header.js': {
                file: {
                  contents: `function Header({ title }) {\n  return <header>{title}</header>;\n}\n\nexport default Header;`
                }
              }
            }
          },
          'styles': {
            directory: {
              'main.css': {
                file: {
                  contents: `body {\n  font-family: sans-serif;\n  margin: 0;\n  padding: 0;\n}`
                }
              }
            }
          }
        }
      },
      'public': {
        directory: {
          'index.html': {
            file: {
              contents: `<div id='root'></div>`
            }
          },
          'favicon.ico': {
            file: {
              contents: ``  // Empty content for binary file
            }
          }
        }
      }
    };
    
    await webcontainerRef.value.mount(files);
    console.log('File system loaded successfully');
    
  } catch (error) {
    console.error('Error loading file system:', error);
  }
};

// Refresh file tree from WebContainer
const refreshFileTree = async () => {
  if (!webcontainerRef.value) return;
  
  try {
    console.log('Refreshing file tree...');
    // Get the root directory listing
    const rootDirEntries = await webcontainerRef.value.fs.readdir('/', { withFileTypes: true });
    
    // Map entries to file tree structure
    const tree = await Promise.all(rootDirEntries.map(async (entry) => {
      const path = `/${entry.name}`;
      const item = {
        name: entry.name,
        path,
        type: entry.isDirectory() ? 'directory' : 'file'
      };
      
      // If it's a directory, get its children recursively
      if (entry.isDirectory()) {
        item.children = await getDirectoryChildren(path);
      }
      
      return item;
    }));
    
    fileTree.value = tree;
    console.log('File tree refreshed');
  } catch (error) {
    console.error('Error refreshing file tree:', error);
  }
};

// Get directory children recursively
const getDirectoryChildren = async (dirPath) => {
  try {
    const entries = await webcontainerRef.value.fs.readdir(dirPath, { withFileTypes: true });
    
    return await Promise.all(entries.map(async (entry) => {
      const path = `${dirPath}/${entry.name}`;
      const item = {
        name: entry.name,
        path,
        type: entry.isDirectory() ? 'directory' : 'file'
      };
      
      if (entry.isDirectory()) {
        item.children = await getDirectoryChildren(path);
      }
      
      return item;
    }));
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
};

// Helper function to get file icon class based on file extension
const getFileIconClass = (fileName) => {
  const extension = fileName.split('.').pop().toLowerCase();
  
  switch (extension) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return 'icon-js';
    case 'html':
    case 'htm':
      return 'icon-html';
    case 'css':
    case 'scss':
    case 'sass':
      return 'icon-css';
    case 'json':
      return 'icon-json';
    case 'md':
      return 'icon-md';
    case 'vue':
      return 'icon-vue';
    default:
      return 'icon-file';
  }
};

// Terminal functions
const toggleTerminal = () => {
  terminalVisible.value = !terminalVisible.value;
};

const handleTerminalClosed = () => {
  terminalVisible.value = false;
};

const startTerminalResize = (event) => {
  isResizingTerminal.value = true;
  
  const handleMouseMove = (e) => {
    const editorRect = document.querySelector('.editor-area').getBoundingClientRect();
    const newHeight = editorRect.bottom - e.clientY;
    terminalHeight.value = Math.max(100, Math.min(newHeight, editorRect.height - 200));
  };
  
  const handleMouseUp = () => {
    isResizingTerminal.value = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

// Event handlers
const handleSelectItem = (item) => {
  selectedPath.value = item.path;
  
  if (item.type === 'file') {
    openFile(item);
  }
};

const openFile = (file) => {
  // Check if file is already open in tabs
  const existingTabIndex = openTabs.value.findIndex(tab => tab.path === file.path);
  
  if (existingTabIndex !== -1) {
    // File is already open, just activate the tab
    setActiveTab(existingTabIndex);
  } else {
    // Add new tab
    openTabs.value.push(file);
    setActiveTab(openTabs.value.length - 1);
  }
};

const setActiveTab = (index) => {
  activeTabIndex.value = index;
};

const closeTab = (index) => {
  openTabs.value.splice(index, 1);
  
  // Adjust active tab index
  if (openTabs.value.length === 0) {
    activeTabIndex.value = -1;
  } else if (activeTabIndex.value >= index) {
    // If we closed the active tab or a tab before it, adjust the index
    activeTabIndex.value = Math.max(0, activeTabIndex.value - 1);
  }
};

const toggleDirectory = (path) => {
  const index = expandedDirs.value.indexOf(path);
  if (index === -1) {
    expandedDirs.value.push(path);
  } else {
    expandedDirs.value.splice(index, 1);
  }
};

const handleContextMenu = (item, event) => {
  // Position context menu at cursor position
  contextMenuStyle.value = {
    top: `${event.clientY}px`,
    left: `${event.clientX}px`
  };
  
  contextMenuTarget.value = item;
  showContextMenu.value = true;
  
  // Add event listener to close context menu when clicking elsewhere
  setTimeout(() => {
    document.addEventListener('click', closeContextMenu, { once: true });
  }, 0);
  
  // Prevent default browser context menu
  event.preventDefault();
};

const closeContextMenu = () => {
  showContextMenu.value = false;
};

// File operations
const createFile = async (parentPath, fileName) => {
  try {
    const path = `${parentPath}/${fileName}`;
    await webcontainerRef.value.fs.writeFile(path, '');
    await refreshFileTree();
    return path;
  } catch (error) {
    console.error(`Error creating file ${fileName}:`, error);
    return null;
  }
};

const createDirectory = async (parentPath, dirName) => {
  try {
    const path = `${parentPath}/${dirName}`;
    await webcontainerRef.value.fs.mkdir(path);
    await refreshFileTree();
    return path;
  } catch (error) {
    console.error(`Error creating directory ${dirName}:`, error);
    return null;
  }
};

const renameFile = async (oldPath, newName) => {
  try {
    const dirPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = `${dirPath}/${newName}`;
    
    // Read the current file
    const contents = await webcontainerRef.value.fs.readFile(oldPath);
    
    // Create the new file with the same contents
    await webcontainerRef.value.fs.writeFile(newPath, contents);
    
    // Delete the old file
    await webcontainerRef.value.fs.rm(oldPath);
    
    // Update open tabs if necessary
    const tabIndex = openTabs.value.findIndex(tab => tab.path === oldPath);
    if (tabIndex !== -1) {
      openTabs.value[tabIndex] = {
        ...openTabs.value[tabIndex],
        name: newName,
        path: newPath
      };
    }
    
    await refreshFileTree();
    return newPath;
  } catch (error) {
    console.error(`Error renaming ${oldPath}:`, error);
    return null;
  }
};

const deleteFileOrDir = async (path) => {
  try {
    await webcontainerRef.value.fs.rm(path, { recursive: true });
    
    // Close tab if file is open
    const tabIndex = openTabs.value.findIndex(tab => tab.path === path);
    if (tabIndex !== -1) {
      closeTab(tabIndex);
    }
    
    await refreshFileTree();
    return true;
  } catch (error) {
    console.error(`Error deleting ${path}:`, error);
    return false;
  }
};

const handleContextMenuAction = async (action) => {
  const item = contextMenuTarget.value;
  
  if (!item) {
    closeContextMenu();
    return;
  }
  
  const parentPath = item.type === 'directory' ? item.path : item.path.substring(0, item.path.lastIndexOf('/'));
  
  switch (action) {
    case 'new-file':
      const fileName = prompt('Enter file name:', 'new-file.js');
      if (fileName) {
        const newFilePath = await createFile(parentPath, fileName);
        if (newFilePath) {
          selectedPath.value = newFilePath;
          const newFile = {
            name: fileName,
            path: newFilePath,
            type: 'file'
          };
          openFile(newFile);
        }
      }
      break;
      
    case 'new-folder':
      const folderName = prompt('Enter folder name:', 'new-folder');
      if (folderName) {
        const newDirPath = await createDirectory(parentPath, folderName);
        if (newDirPath) {
          selectedPath.value = newDirPath;
          expandedDirs.value.push(newDirPath);
        }
      }
      break;
      
    case 'rename':
      const currentName = item.name;
      const newName = prompt('Enter new name:', currentName);
      if (newName && newName !== currentName) {
        const newPath = await renameFile(item.path, newName);
        if (newPath) {
          selectedPath.value = newPath;
        }
      }
      break;
      
    case 'delete':
      if (confirm(`Are you sure you want to delete ${item.name}?`)) {
        await deleteFileOrDir(item.path);
      }
      break;
  }
  
  closeContextMenu();
};

const handleFileSaved = async (file) => {
  console.log('File saved:', file.path);
};

// Lifecycle hooks
onMounted(async () => {
  console.log('Component mounted, initializing WebContainer...');
  // Initialize the WebContainer
  await initWebContainer();
  
  // Close context menu on escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && showContextMenu.value) {
      closeContextMenu();
    }
  });
  
  // Add click event listener to document for context menu
  document.addEventListener('click', (e) => {
    if (showContextMenu.value && !e.target.closest('.context-menu')) {
      closeContextMenu();
    }
  });
});

onBeforeUnmount(() => {
  // Clean up resources
  if (webcontainerRef.value) {
    // WebContainer API doesn't have a direct method to shut down,
    // but we can clean up any event listeners or workers here
  }
});
</script>

<style>
/* Root variables for VS Code theme */
:root {
  --vscode-bg: #1e1e1e;
  --vscode-sidebar-bg: #252526;
  --vscode-titlebar-bg: #3c3c3c;
  --vscode-active-tab-bg: #1e1e1e;
  --vscode-inactive-tab-bg: #2d2d2d;
  --vscode-editor-bg: #1e1e1e;
  --vscode-terminal-bg: #1e1e1e;
  --vscode-highlight: #264f78;
  --vscode-border: #474747;
  --vscode-text: #cccccc;
  --vscode-inactive-text: #969696;
  --vscode-accent: #0e639c;
  --vscode-button: #0e639c;
  --vscode-button-hover: #1177bb;
  --vscode-scrollbar: rgba(121, 121, 121, 0.4);
  --vscode-titlebar-height: 30px;
  --vscode-statusbar-height: 22px;
  --vscode-activitybar-width: 48px;
  --vscode-statusbar-bg: #007acc;
}

.web-ide {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--vscode-bg);
  color: var(--vscode-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  font-size: 13px;
}

/* Title Bar */
.titlebar {
  height: var(--vscode-titlebar-height, 30px);
  background-color: var(--vscode-titlebar-bg, #3c3c3c);
  display: flex;
  align-items: center;
  padding: 0 10px;
  user-select: none;
}

.titlebar-title {
  font-size: 12px;
  color: var(--vscode-inactive-text, #969696);
  margin-left: 4px;
}

.titlebar-buttons {
  margin-left: auto;
  display: flex;
}

.titlebar-button {
  height: 20px;
  width: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0.6;
  cursor: pointer;
}

.titlebar-button:hover {
  opacity: 1;
}

/* Main Area */
.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Activity Bar */
.activity-bar {
  width: var(--vscode-activitybar-width, 48px);
  height: 100%;
  background-color: var(--vscode-sidebar-bg, #252526);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 10px;
  border-right: 1px solid var(--vscode-border, #474747);
}

.activity-bar-icon {
  height: 48px;
  width: 48px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  color: var(--vscode-inactive-text, #969696);
}

.activity-bar-icon.active {
  color: var(--vscode-text, #cccccc);
  border-left: 2px solid var(--vscode-statusbar-bg, #007acc);
}

.activity-bar-icon:hover {
  color: var(--vscode-text, #cccccc);
}

/* Side Bar */
.sidebar {
  width: 240px;
  background-color: var(--vscode-sidebar-bg, #252526);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  height: 35px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  font-size: 11px;
  text-transform: uppercase;
  font-weight: bold;
  letter-spacing: 1px;
}

.sidebar-actions {
  display: flex;
  margin-left: auto;
}

.sidebar-action {
  height: 20px;
  width: 20px;
  margin-left: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  opacity: 0.6;
}

.sidebar-action:hover {
  opacity: 1;
}

/* Editor Area */
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--vscode-editor-bg, #1e1e1e);
  overflow: hidden;
  position: relative;
}

/* Tabs */
.tabs-container {
  display: flex;
  background-color: var(--vscode-bg, #1e1e1e);
  border-bottom: 1px solid var(--vscode-border, #474747);
  height: 35px;
  overflow-x: auto;
  overflow-y: hidden;
}

.tabs-container::-webkit-scrollbar {
  height: 0;
}

.tab {
  display: flex;
  align-items: center;
  padding: 0 10px;
  height: 100%;
  font-size: 13px;
  min-width: 120px;
  max-width: 200px;
  cursor: pointer;
  border-right: 1px solid var(--vscode-border, #474747);
  background-color: var(--vscode-inactive-tab-bg, #2d2d2d);
  position: relative;
}

.tab.active {
  background-color: var(--vscode-active-tab-bg, #1e1e1e);
}

.tab:hover {
  background-color: rgba(128, 128, 128, 0.1);
}

.tab-icon {
  margin-right: 5px;
  opacity: 0.8;
  font-size: 14px;
}

.tab-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-close {
  margin-left: 5px;
  opacity: 0.6;
  cursor: pointer;
  font-size: 16px;
}

.tab-close:hover {
  opacity: 1;
}

/* Empty Editor */
.empty-editor {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--vscode-inactive-text, #969696);
}

.empty-editor-message {
  font-size: 14px;
}

/* Terminal */
.terminal-wrapper {
  position: relative;
  height: 300px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: height 0.2s ease-out;
}

.terminal-wrapper:not(.terminal-visible) {
  height: 0 !important;
}

.terminal-resize-handle {
  height: 4px;
  background-color: var(--vscode-border, #474747);
  cursor: ns-resize;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  opacity: 0.6;
}

.terminal-resize-handle:hover,
.terminal-resize-handle:active {
  background-color: var(--vscode-accent, #0e639c);
  opacity: 1;
}

/* Status Bar */
.statusbar {
  height: var(--vscode-statusbar-height, 22px);
  background-color: var(--vscode-statusbar-bg, #007acc);
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 12px;
}

.statusbar-section {
  display: flex;
  align-items: center;
  padding: 0 8px;
  cursor: pointer;
}

.statusbar-section:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.statusbar-icon {
  margin-right: 5px;
  font-size: 14px;
}

.right-status {
  margin-left: auto;
  display: flex;
}

/* Context Menu */
.context-menu {
  position: absolute;
  background-color: var(--vscode-sidebar-bg, #252526);
  border: 1px solid var(--vscode-border, #474747);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 6px 0;
  z-index: 1000;
  min-width: 160px;
}

.context-menu-item {
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.context-menu-item:hover {
  background-color: var(--vscode-highlight, #264f78);
}

.context-menu-icon {
  margin-right: 8px;
  opacity: 0.8;
  width: 16px;
}

.context-menu-separator {
  height: 1px;
  background-color: var(--vscode-border, #474747);
  margin: 5px 0;
}

/* Icon Styling */
.icon-js::before {
  content: "JS";
  color: #f1e05a;
}

.icon-html::before {
  content: "HTML";
  color: #e34c26;
}

.icon-css::before {
  content: "CSS";
  color: #563d7c;
}

.icon-json::before {
  content: "{}";
  color: #5a5a5a;
}

.icon-md::before {
  content: "MD";
  color: #2980b9;
}

.icon-vue::before {
  content: "Vue";
  color: #41b883;
}

.icon-folder::before {
  content: "📁";
}

.icon-folder-open::before {
  content: "📂";
}

.icon-file::before {
  content: "📄";
}

</style>