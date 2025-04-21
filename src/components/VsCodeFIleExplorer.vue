<!-- VsCodeFileExplorer.vue -->
<template>
  <div class="file-explorer">
    <div v-for="item in fileTree" :key="item.path" class="file-item">
      <div class="file-item-content" 
           :class="{ 'selected': selectedPath === item.path }"
           :style="{ paddingLeft: '20px' }"
           @click="handleFileClick(item)"
           @contextmenu="handleFileContextMenu(item, $event)">
        <span 
          :class="['file-icon', item.type === 'directory' ? 
                  (expandedDirs.includes(item.path) ? 'icon-folder-open' : 'icon-folder') : 
                  getFileIconClass(item.name)]"
        ></span>
        <span class="file-label">{{ item.name }}</span>
      </div>
      
      <!-- Render children for directories -->
      <div v-if="item.type === 'directory' && expandedDirs.includes(item.path)" class="file-children">
        <div v-for="child in item.children" :key="child.path" class="file-item">
          <div class="file-item-content" 
               :class="{ 'selected': selectedPath === child.path }"
               :style="{ paddingLeft: '36px' }"
               @click="handleFileClick(child)"
               @contextmenu="handleFileContextMenu(child, $event)">
            <span 
              :class="['file-icon', child.type === 'directory' ? 
                      (expandedDirs.includes(child.path) ? 'icon-folder-open' : 'icon-folder') : 
                      getFileIconClass(child.name)]"
            ></span>
            <span class="file-label">{{ child.name }}</span>
          </div>
          
          <!-- Second level children -->
          <div v-if="child.type === 'directory' && expandedDirs.includes(child.path)" class="file-children">
            <div v-for="grandchild in child.children" :key="grandchild.path" class="file-item">
              <div class="file-item-content" 
                   :class="{ 'selected': selectedPath === grandchild.path }"
                   :style="{ paddingLeft: '52px' }"
                   @click="handleFileClick(grandchild)"
                   @contextmenu="handleFileContextMenu(grandchild, $event)">
                <span 
                  :class="['file-icon', grandchild.type === 'directory' ? 
                          (expandedDirs.includes(grandchild.path) ? 'icon-folder-open' : 'icon-folder') : 
                          getFileIconClass(grandchild.name)]"
                ></span>
                <span class="file-label">{{ grandchild.name }}</span>
              </div>
              
              <!-- Third level children -->
              <div v-if="grandchild.type === 'directory' && expandedDirs.includes(grandchild.path)" class="file-children">
                <div v-for="greatgrandchild in grandchild.children" :key="greatgrandchild.path" class="file-item">
                  <div class="file-item-content" 
                       :class="{ 'selected': selectedPath === greatgrandchild.path }"
                       :style="{ paddingLeft: '68px' }"
                       @click="handleFileClick(greatgrandchild)"
                       @contextmenu="handleFileContextMenu(greatgrandchild, $event)">
                    <span 
                      :class="['file-icon', greatgrandchild.type === 'directory' ? 
                              (expandedDirs.includes(greatgrandchild.path) ? 'icon-folder-open' : 'icon-folder') : 
                              getFileIconClass(greatgrandchild.name)]"
                    ></span>
                    <span class="file-label">{{ greatgrandchild.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  webcontainer: {
    type: Object,
    required: true
  },
  fileTree: {
    type: Array,
    default: () => []
  },
  expandedDirs: {
    type: Array,
    default: () => []
  },
  selectedPath: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['select-item', 'toggle-directory', 'context-menu']);

const handleFileClick = (item) => {
  if (item.type === 'directory') {
    emit('toggle-directory', item.path);
  } else {
    emit('select-item', item);
  }
};

const handleFileContextMenu = (item, event) => {
  event.preventDefault();
  emit('context-menu', item, event);
};

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
    default:
      return 'icon-file';
  }
};
</script>

<style scoped>
.file-explorer {
  flex: 1;
  overflow: auto;
  user-select: none;
}

.file-explorer::-webkit-scrollbar {
  width: 10px;
}

.file-explorer::-webkit-scrollbar-track {
  background: transparent;
}

.file-explorer::-webkit-scrollbar-thumb {
  background: var(--vscode-scrollbar, rgba(121, 121, 121, 0.4));
  border-radius: 5px;
}

.file-item {
  position: relative;
}

.file-item-content {
  display: flex;
  align-items: center;
  padding: 4px 16px 4px 20px;
  cursor: pointer;
  font-size: 13px;
  height: 22px;
}

.file-item-content:hover {
  background-color: rgba(128, 128, 128, 0.1);
}

.file-item-content.selected {
  background-color: var(--vscode-highlight, #264f78);
}

.file-icon {
  margin-right: 6px;
  opacity: 0.8;
  font-size: 16px;
}

.file-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-children {
  margin-left: 0;
}
</style>