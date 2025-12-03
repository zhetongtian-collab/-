<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import CanvasRenderer from './components/CanvasRenderer.vue';
import TextEditor from './components/TextEditor.vue';

// 组件引用
const canvasRendererRef = ref(null);
const textEditorRef = ref(null);

// 画布容器引用
const canvasContainer = ref(null);
// 是否处于添加文本模式
const isAddingText = ref(false);
// 是否处于选中模式
const isSelecting = ref(false);
// 画布缩放比例和偏移量
const canvasScale = ref(1);
const canvasOffset = ref({ x: 0, y: 0 });
// 选中的文本框数据（用于传递给CanvasRenderer）
const selectedTextBoxes = ref([]);

// 接收CanvasRenderer组件传递的画布引用
function handleCanvasMounted(canvasElement) {
  canvasContainer.value = canvasElement;
}

// 接收CanvasRenderer组件传递的缩放和偏移信息
function handleCanvasTransform(transformInfo) {
  if (transformInfo) {
    canvasScale.value = transformInfo.scale || 1;
    canvasOffset.value = transformInfo.offset || { x: 0, y: 0 };
  }
}

// 切换添加文本模式
function toggleTextMode() {
  isAddingText.value = !isAddingText.value;
  // 切换添加文本模式时，关闭选中模式
  if (isAddingText.value) {
    isSelecting.value = false;
  }
}

// 切换选中模式
function toggleSelectMode() {
  isSelecting.value = !isSelecting.value;
  // 切换选中模式时，关闭添加文本模式
  if (isSelecting.value) {
    isAddingText.value = false;
  } else {
    // 退出选中模式时，清除所有选中
    if (textEditorRef.value) {
      textEditorRef.value.clearSelection();
    }
    // 更新选中的文本框数据
    updateSelectedTextBoxes();
  }
}

// 处理文本框添加事件
function handleTextBoxAdded(textBoxInfo) {
  console.log('文本框已添加:', textBoxInfo);
  // 可以在这里添加额外的逻辑，比如记录添加的文本框
}

// 处理文本内容变化事件
function handleTextChanged(textBoxes) {
  console.log('文本内容已更新:', textBoxes);
  // 可以在这里添加保存文本框数据的逻辑
}

// 处理框选结束事件
function handleBoxSelectionEnd(rect) {
  if (textEditorRef.value) {
    textEditorRef.value.selectTextBoxesInArea(rect);
    // 框选后更新选中的文本框数据，确保缩放控制点能正确显示
    nextTick(() => {
      updateSelectedTextBoxes();
    });
  }
}

// 处理选中元素拖拽事件（来自CanvasRenderer）
function handleSelectionDrag({ dx, dy }) {
  if (textEditorRef.value) {
    textEditorRef.value.moveSelectedTextBoxes(dx, dy);
    
    // 实时更新本地 selectedTextBoxes 数据，以便 CanvasRenderer 能正确计算包围盒
    // 避免频繁调用 getSelectedTextBoxes 带来的性能开销
    if (selectedTextBoxes.value.length > 0) {
      selectedTextBoxes.value.forEach(item => {
        item.data.x += dx;
        item.data.y += dy;
      });
    }
  }
}

// 处理文本拖拽事件（来自TextEditor）
function handleTextDrag({ dx, dy }) {
  if (canvasRendererRef.value) {
    canvasRendererRef.value.moveSelectedElements(dx, dy);
  }
}

// 处理图形或图片选中事件（来自CanvasRenderer）
function handleShapeOrImageSelected(info) {
  // 当选中图形或图片时，清除文本框选中状态
  if (info && info.clearTextSelection && textEditorRef.value) {
    textEditorRef.value.clearSelection();
    updateSelectedTextBoxes();
  }
}

// 处理文本框选中事件（来自TextEditor）
function handleTextBoxSelected(info) {
  // 当选中文本框时，清除图形和图片的选中状态
  if (info && info.clearShapeSelection && canvasRendererRef.value) {
    canvasRendererRef.value.clearShapeSelection();
    canvasRendererRef.value.clearImageSelection();
  }
}

// 处理删除选中文本框事件（来自 CanvasRenderer）
function handleDeleteSelectedTextBoxes() {
  if (textEditorRef.value) {
    textEditorRef.value.deleteSelectedTextBoxes();
  }
}

// 处理删除所有选中元素事件（来自 TextEditor）
// 当框选了图形、图片、文本框，然后右键点击文本框删除时触发
function handleDeleteAllSelected() {
  // 同时删除 CanvasRenderer 中选中的图形和图片
  if (canvasRendererRef.value) {
    canvasRendererRef.value.deleteSelectedElements();
  }
  // 删除 TextEditor 中选中的文本框
  if (textEditorRef.value) {
    textEditorRef.value.deleteSelectedTextBoxes();
  }
}

// 更新选中的文本框数据（用于缩放功能）
function updateSelectedTextBoxes() {
  if (textEditorRef.value && textEditorRef.value.getSelectedTextBoxes) {
    selectedTextBoxes.value = textEditorRef.value.getSelectedTextBoxes();
  } else {
    selectedTextBoxes.value = [];
  }
}

// 处理文本框更新事件（来自 CanvasRenderer 的缩放操作）
function handleUpdateTextBoxes(updates) {
  if (textEditorRef.value && textEditorRef.value.updateTextBoxes) {
    textEditorRef.value.updateTextBoxes(updates);
    // 更新后重新获取选中的文本框数据
    updateSelectedTextBoxes();
  }
}

// 监听键盘事件
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

// 处理键盘事件
function handleKeyDown(e) {
  console.log('handleKeyDown triggered', e.key, 'Ctrl:', e.ctrlKey, 'Meta:', e.metaKey);
  
  // 忽略在输入框中的按键事件（除了文本框本身的编辑，但这里是全局监听，
  // 如果当前焦点在输入框中，通常不应该触发画布的复制粘贴，除非是文本框内容的复制粘贴。
  // 浏览器的默认行为会处理输入框内的复制粘贴。
  // 我们需要区分是画布元素的复制粘贴还是文本内容的复制粘贴。
  // 如果焦点在 contenteditable 元素上，且是文本编辑状态，我们应该让浏览器处理文本复制粘贴。
  // 但我们的文本框是 contenteditable，所以需要小心。
  
  const activeElement = document.activeElement;
  const isInput = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable;
  console.log('isInput:', isInput, 'activeElement.tagName:', activeElement.tagName);
  
  // 如果是在编辑文本框内容，不拦截 Ctrl+C/V，让浏览器处理文本复制
  if (isInput) return;

  // Ctrl+C 复制
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    handleCopy()
    // 阻止默认行为（虽然对于非输入框可能没影响，但好习惯）
    e.preventDefault() 
  }
  // Ctrl+V 粘贴
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    handlePaste()
    e.preventDefault()
  }
}

// 处理复制
async function handleCopy() {
  console.log('handleCopy triggered');
  if (!canvasRendererRef.value) return
  
  const selectedElements = canvasRendererRef.value.getSelectedElements()
  if (selectedElements.length === 0) return
  
  // 序列化数据
  const clipboardDataPromises = selectedElements.map(async (el) => {
    // 对于图片，需要将 ObjectURL 转换为 base64
    if (el.type === 'image') {
      let src = el.data.src || (el.data.img ? el.data.img.src : '')
      
      // 如果是 blob URL，需要转换为 base64
      if (src && src.startsWith('blob:')) {
        try {
          // 将 blob URL 转换为 base64
          const response = await fetch(src)
          const blob = await response.blob()
          src = await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.readAsDataURL(blob)
          })
        } catch (error) {
          console.error('转换图片失败:', error)
          // 如果转换失败，保留原始 src
        }
      }
      
      const data = {
        ...el.data,
        src: src
      }
      // 删除 blob 属性，避免 JSON 序列化问题
      delete data.blob
      
      return {
        type: 'image',
        data: data
      }
    }
    return el
  })
  
  const clipboardData = await Promise.all(clipboardDataPromises)
  
  localStorage.setItem('app_clipboard', JSON.stringify(clipboardData))
  console.log('已复制', clipboardData.length, '个元素')
}

// 处理粘贴
function handlePaste() {
  console.log('handlePaste triggered');
  const clipboardDataStr = localStorage.getItem('app_clipboard')
  console.log('clipboard data:', clipboardDataStr)
  if (!clipboardDataStr) return
  
  try {
    const clipboardData = JSON.parse(clipboardDataStr)
    if (!Array.isArray(clipboardData)) return
    
    // 偏移量
    const offset = 20
    
    clipboardData.forEach(item => {
      // 更新位置
      item.data.x += offset
      item.data.y += offset
      
      if (item.type === 'shape') {
        if (canvasRendererRef.value) {
          canvasRendererRef.value.addPastedShape(item.data)
        }
      } else if (item.type === 'image') {
        if (canvasRendererRef.value) {
          canvasRendererRef.value.addPastedImage(item.data)
        }
      } else if (item.type === 'textbox') {
        if (textEditorRef.value) {
          textEditorRef.value.addPastedTextBox(item.data)
        }
      }
    })
    
    // 更新粘贴后的数据到剪贴板，以便连续粘贴
    localStorage.setItem('app_clipboard', JSON.stringify(clipboardData))
    
  } catch (e) {
    console.error('粘贴失败:', e)
  }
}
</script>

<template>
  <div class="app-container">
    <div class="canvas-container" ref="canvasContainer">
      <CanvasRenderer 
        ref="canvasRendererRef"
        @canvas-mounted="handleCanvasMounted" 
        :is-adding-text="isAddingText"
        :selected-text-boxes="selectedTextBoxes"
        @toggle-text-mode="toggleTextMode"
        @toggle-select-mode="toggleSelectMode"
        @canvas-transform="handleCanvasTransform"
        @box-selection-end="handleBoxSelectionEnd"
        @selection-drag="handleSelectionDrag"
        @shape-or-image-selected="handleShapeOrImageSelected"
        @delete-selected-textboxes="handleDeleteSelectedTextBoxes"
        @update-textboxes="handleUpdateTextBoxes"
      />
      <TextEditor 
        ref="textEditorRef"
        :is-adding-text="isAddingText"
        :is-selecting="isSelecting"
        :canvas-container="canvasContainer"
        :scale="canvasScale"
        :offset="canvasOffset"
        @text-box-added="handleTextBoxAdded"
        @text-changed="handleTextChanged; updateSelectedTextBoxes()"
        @text-drag="handleTextDrag"
        @text-box-selected="handleTextBoxSelected; updateSelectedTextBoxes()"
        @delete-all-selected="handleDeleteAllSelected"
      />
    </div>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
