import { invoke } from "@tauri-apps/api/core";

interface Tab {
  id: string;
  title: string;
  content: string;
  isSaved: boolean;
  filePath?: string;
  lastModified: number;
  isDirty: boolean;
  type?: 'note' | 'settings';  // Add type to distinguish between note and settings tabs
}

// const mainContent = document.getElementById("main-content") as HTMLDivElement;
const noteArea = document.getElementById("note-area") as HTMLDivElement;
const settingsView = document.getElementById("settings-view") as HTMLDivElement;
const statusMsg = document.getElementById("status-msg") as HTMLElement;
const charCount = document.getElementById("char-count") as HTMLElement;
const newBtn = document.getElementById("new-note") as HTMLButtonElement;
const openBtn = document.getElementById("open-note") as HTMLButtonElement;
const saveBtn = document.getElementById("save-note") as HTMLButtonElement;
const saveAsBtn = document.getElementById("save-as-note") as HTMLButtonElement;
const exitBtn = document.getElementById("exit-app") as HTMLButtonElement;
const fileMenuBtn = document.getElementById("file-menu-btn") as HTMLButtonElement;
const tabBar = document.getElementById("tab-bar") as HTMLDivElement;
const newTabBtn = document.getElementById("new-tab-btn") as HTMLButtonElement;
const settingsBtn = document.getElementById("settings-btn") as HTMLButtonElement;
const backToNotesBtn = document.getElementById("back-to-notes-btn") as HTMLButtonElement;
const boldBtn = document.getElementById("bold-btn") as HTMLButtonElement;
const italicBtn = document.getElementById("italic-btn") as HTMLButtonElement;
const bulletListBtn = document.getElementById("bullet-list-btn") as HTMLButtonElement;
const numberListBtn = document.getElementById("number-list-btn") as HTMLButtonElement;
const exportPdfBtn = document.getElementById("export-pdf") as HTMLButtonElement;
const exportHtmlBtn = document.getElementById("export-html") as HTMLButtonElement;
const exportTextBtn = document.getElementById("export-text") as HTMLButtonElement;

// Settings and Modal Optimization
// const MODAL_ANIMATION_DURATION = 200; // ms

// Cache DOM queries
const settingsElements = {
  fontFamily: document.getElementById("font-family-select") as HTMLSelectElement,
  fontSize: document.getElementById("font-size-input") as HTMLInputElement,
  notesDir: document.getElementById("notes-directory-path") as HTMLSpanElement,
  openDirBtn: document.getElementById("open-notes-directory") as HTMLButtonElement,
  changeDirBtn: document.getElementById("change-notes-directory") as HTMLButtonElement,
  applyBtn: document.getElementById("apply-settings-btn") as HTMLButtonElement
};

// Settings cache
const settingsCache = {
  fontFamily: localStorage.getItem("minnote-fontFamily"),
  fontSize: localStorage.getItem("minnote-fontSize"),
  notesDirectory: null as string | null
};

// Use Map for better performance with tab lookups
const tabsMap = new Map<string, Tab>();
let activeTabId: string | null = null;
let autoSaveTimer: number | undefined;
const AUTO_SAVE_DELAY = 1000; // ms

// Performance optimizations
// const DEBOUNCE_DELAY = 150;
// const THROTTLE_DELAY = 100;
// const TEXT_UPDATE_THROTTLE = 100; // ms

// Optimize tab switching with content caching
const tabContentCache = new Map<string, string>();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Performance monitoring
const performanceMetrics = {
  tabSwitches: 0,
  saveOperations: 0,
  loadOperations: 0,
  startTime: Date.now(),
  errors: 0,
  cacheHits: 0,
  cacheMisses: 0
};

function logPerformanceMetric(metric: keyof typeof performanceMetrics) {
  performanceMetrics[metric]++;
  // Log metrics periodically
  if (performanceMetrics[metric] % 100 === 0) {
    console.log(`Performance metrics:`, {
      ...performanceMetrics,
      uptime: Date.now() - performanceMetrics.startTime
    });
  }
}

// File system caching
const fileSystemCache = new Map<string, {
  content: string;
  timestamp: number;
}>();

const MAX_CACHE_SIZE = 50;
const MAX_TAB_CONTENT_LENGTH = 1000000; // 1MB

// Memory management
function cleanupCache() {
  if (tabContentCache.size > MAX_CACHE_SIZE) {
    const oldestKey = Array.from(tabContentCache.keys())[0];
    tabContentCache.delete(oldestKey);
    logPerformanceMetric('cacheHits');
  }
}

// Error handling
function handleError(error: Error, context: string) {
  console.error(`Error in ${context}:`, error);
  setStatus(`Error: ${error.message}`);
  performanceMetrics.errors++;
  
  // Implement retry logic for specific operations
  if (context === 'save_note') {
    retryOperation(() => saveNote(noteArea.innerHTML, activeTabId!, true), 3);
  } else if (context === 'load_note') {
    const activeTab = activeTabId ? tabsMap.get(activeTabId) : undefined;
    retryOperation(async () => {
      await loadNote(activeTab?.filePath);
    }, 3);
  }
}

// Retry logic
async function retryOperation(operation: () => Promise<void>, maxRetries: number) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      await operation();
      return;
    } catch (error) {
      retries++;
      if (retries === maxRetries) {
        handleError(error as Error, 'retry_operation');
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
}

function createNewTab(type: 'note' | 'settings' = 'note'): Tab {
  const tabId = `tab-${Date.now()}`;
  const tab: Tab = {
    id: tabId,
    title: type === 'settings' ? "Settings" : "Untitled",
    content: "",
    isDirty: false,
    isSaved: true,
    filePath: undefined,
    lastModified: Date.now(),
    type: type
  };
  
  tabsMap.set(tabId, tab);
  updateTabUI();
  return tab;
}

function switchToTab(tabId: string) {
  const tab = tabsMap.get(tabId);
  if (!tab) return;

  // Save current tab content if exists
  if (activeTabId) {
    const currentTab = tabsMap.get(activeTabId);
    if (currentTab) {
      currentTab.content = noteArea.innerHTML;
      currentTab.lastModified = Date.now();
      tabContentCache.set(activeTabId, noteArea.innerHTML);
    }
  }

  // Switch to new tab
  activeTabId = tabId;
  
  // Handle different tab types
  if (tab.type === 'settings') {
    noteArea.style.display = "none";
    settingsView.style.display = "block";
    loadSettingsToView();
  } else {
    noteArea.style.display = "block";
    settingsView.style.display = "none";
    
    // Check cache first
    const cachedContent = tabContentCache.get(tabId);
    if (cachedContent && Date.now() - tab.lastModified < CACHE_EXPIRY) {
      noteArea.innerHTML = cachedContent;
      performanceMetrics.cacheHits++;
    } else {
      noteArea.innerHTML = tab.content;
      tabContentCache.set(tabId, tab.content);
      performanceMetrics.cacheMisses++;
    }
  }
  
  updateCharCount();
  updateTabUI();
  logPerformanceMetric('tabSwitches');
}

// Optimize tab UI updates
function updateTabUI() {
  if (!tabBar) return;
  
  // Clear existing tabs
  tabBar.innerHTML = "";
  
  // Add tabs
  tabsMap.forEach((tab, id) => {
    const tabElement = document.createElement("div");
    tabElement.className = `tab ${id === activeTabId ? "active" : ""}`;
    tabElement.innerHTML = `
      <span class="tab-title">${tab.title}${tab.isDirty ? " *" : ""}</span>
      <button class="tab-close" data-tab-id="${id}">×</button>
    `;
    
    // Add click event for tab switching
    tabElement.addEventListener("click", (e) => {
      if (!(e.target as HTMLElement).classList.contains("tab-close")) {
        switchToTab(id);
      }
    });
    
    // Add click event for close button
    const closeBtn = tabElement.querySelector(".tab-close");
    closeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(id);
    });
    
    tabBar.appendChild(tabElement);
  });
  
  // Add new tab button inside the tab bar
  const newTabBtn = document.createElement("button");
  newTabBtn.className = "new-tab-btn";
  newTabBtn.textContent = "+";
  newTabBtn.addEventListener("click", () => {
    const newTab = createNewTab();
    switchToTab(newTab.id);
  });
  tabBar.appendChild(newTabBtn);
}

// Optimize tab closing
async function closeTab(tabId: string) {
  const tab = tabsMap.get(tabId);
  if (!tab) return;

  if (tab.isDirty) {
    const response = await showSaveDialog(tab);
    if (response === 'cancel') return;
    if (response === 'save') {
      await saveNote(tab.content, tabId, true);
    }
  }

  tabsMap.delete(tabId);
  tabContentCache.delete(tabId);
  
  if (activeTabId === tabId) {
    // Find next available tab
    const nextTab = Array.from(tabsMap.keys())[0];
    activeTabId = nextTab || null;
    
    if (activeTabId) {
      switchToTab(activeTabId);
    } else {
      noteArea.innerHTML = "";
      updateCharCount();
    }
  }
  
  updateTabUI();
}

async function showSaveDialog(tab: Tab): Promise<'save' | 'dont-save' | 'cancel'> {
  const dialog = document.createElement('div');
  dialog.className = 'save-dialog';
  dialog.innerHTML = `
    <div class="save-dialog-content">
      <h3>Save Changes?</h3>
      <p>Do you want to save changes to "${tab.title}"?</p>
      <div class="save-dialog-buttons">
        <button class="save-btn">Save</button>
        <button class="dont-save-btn">Don't Save</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  return new Promise((resolve) => {
    const saveBtn = dialog.querySelector('.save-btn');
    const dontSaveBtn = dialog.querySelector('.dont-save-btn');
    const cancelBtn = dialog.querySelector('.cancel-btn');

    saveBtn?.addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve('save');
    });

    dontSaveBtn?.addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve('dont-save');
    });

    cancelBtn?.addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve('cancel');
    });
  });
}

// Text area optimization
// const TEXT_UPDATE_THROTTLE = 100; // ms

// Optimize text area input handling
if (noteArea) {
  let lastContent = '';
  let isUpdating = false;

  noteArea.addEventListener('input', debounce(() => {
    if (!activeTabId || isUpdating) return;
    const activeTab = tabsMap.get(activeTabId);
    if (!activeTab) return;
    const newContent = noteArea.innerHTML;
    if (newContent === lastContent) return;
    isUpdating = true;
    activeTab.isDirty = true;
    activeTab.content = newContent;
    lastContent = newContent;
    requestAnimationFrame(() => {
      updateTabUI();
      updateCharCount();
      setStatus("Editing...");
      isUpdating = false;
    });
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = window.setTimeout(() => {
      if (activeTabId) {
        saveNote(noteArea.innerHTML, activeTabId, false);
      }
    }, AUTO_SAVE_DELAY);
  }, 100));

  noteArea.addEventListener('scroll', throttle(() => {
    // Handle scroll events if needed
  }, 100), { passive: true });

  noteArea.addEventListener('select', throttle(() => {
    // Handle selection changes if needed
  }, 100), { passive: true });
}

// Optimize character count updates
function updateCharCount() {
  const text = noteArea.innerText;
  const count = text.length;
  charCount.textContent = `${count} characters`;
}

// Optimize status updates
const statusUpdateQueue: string[] = [];
let isUpdatingStatus = false;

function setStatus(msg: string) {
  if (!statusMsg) return;
  
  statusUpdateQueue.push(msg);
  if (!isUpdatingStatus) {
    updateStatus();
  }
}

function updateStatus() {
  if (!statusMsg || statusUpdateQueue.length === 0) {
    isUpdatingStatus = false;
    return;
  }

  isUpdatingStatus = true;
  const msg = statusUpdateQueue.shift();
  if (msg) {
    requestAnimationFrame(() => {
      statusMsg.textContent = msg;
      if (statusUpdateQueue.length > 0) {
        setTimeout(updateStatus, 50);
      } else {
        isUpdatingStatus = false;
      }
    });
  }
}

// Optimize content saving
async function saveNote(content: string, tabId: string, forcePrompt: boolean = false) {
  try {
    const tab = tabsMap.get(tabId);
    if (!tab) return;

    // Check content length
    if (content.length > MAX_TAB_CONTENT_LENGTH) {
      handleError(new Error('Content too large to save'), 'save_note');
      return;
    }

    let filePath = tab.filePath;
    
    // Only prompt for filename if explicitly saving (Save/Save As) or if forcePrompt is true
    if (!filePath && forcePrompt) {
      const fileName = prompt("Enter file name:", tab.title);
      if (!fileName) return;
      
      const finalFileName = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
      filePath = finalFileName;
      tab.filePath = filePath;
      tab.title = fileName.replace('.txt', '');
      updateTabUI();
    }

    // If no filePath and not forcing prompt, just update the tab state
    if (!filePath) {
      tab.isDirty = true;
      return;
    }

    // Use requestIdleCallback for non-critical operations
    requestIdleCallback(() => {
      invoke("save_note", { content, filePath }).then(() => {
        tab.isSaved = true;
        tab.isDirty = false;
        tab.lastModified = Date.now();
        
        // Update cache
        fileSystemCache.set(filePath, {
          content,
          timestamp: Date.now()
        });
        
        setStatus("Saved");
        setTimeout(() => setStatus("Ready"), 2000);
        logPerformanceMetric('saveOperations');
      }).catch(e => {
        handleError(e as Error, 'save_note');
      });
    });
  } catch (e) {
    handleError(e as Error, 'save_note');
  }
}

// Optimize content loading
async function loadNote(filePath?: string) {
  try {
    if (filePath) {
      const cached = fileSystemCache.get(filePath);
      if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        performanceMetrics.cacheHits++;
        return cached.content;
      }
      performanceMetrics.cacheMisses++;
    }

    const content = await invoke<string>("read_file", { filePath });
    if (!activeTabId) return;

    const activeTab = tabsMap.get(activeTabId);
    if (activeTab) {
      // Check content length
      if (content && content.length > MAX_TAB_CONTENT_LENGTH) {
        handleError(new Error('File too large'), 'load_note');
        return;
      }

      activeTab.content = content || "";
      activeTab.isSaved = true;
      activeTab.isDirty = false;
      activeTab.lastModified = Date.now();
      
      if (filePath) {
        activeTab.filePath = filePath;
        activeTab.title = filePath.split('/').pop()?.replace('.txt', '') || "Untitled";
        updateTabUI();
        
        // Cache the content
        fileSystemCache.set(filePath, {
          content: content || "",
          timestamp: Date.now()
        });
      }
      
      noteArea.innerHTML = content || "";
      tabContentCache.set(activeTabId, content || "");
      updateCharCount();
      setStatus("Note loaded");
      setTimeout(() => setStatus("Ready"), 2000);
      
      logPerformanceMetric('loadOperations');
    }
  } catch (e) {
    handleError(e as Error, 'load_note');
  }
}

// --- Settings Modal Logic ---

// Update settings loading function
async function loadSettingsToView() {
  // Load font settings from cache
  if (settingsElements.fontFamily) {
    settingsElements.fontFamily.value = settingsCache.fontFamily || 
      (noteArea ? getComputedStyle(noteArea).fontFamily : 'var(--font-main)');
  }
  
  if (settingsElements.fontSize) {
    settingsElements.fontSize.value = settingsCache.fontSize || 
      (noteArea ? parseInt(getComputedStyle(noteArea).fontSize).toString() : '16');
  }

  // Load notes directory path if not cached
  if (!settingsCache.notesDirectory) {
    try {
      const path = await invoke<string>("get_notes_directory");
      settingsCache.notesDirectory = path;
      if (settingsElements.notesDir) {
        settingsElements.notesDir.textContent = path;
      }
    } catch (e) {
      if (settingsElements.notesDir) {
        settingsElements.notesDir.textContent = "Error loading directory path";
      }
    }
  } else if (settingsElements.notesDir) {
    settingsElements.notesDir.textContent = settingsCache.notesDirectory;
  }
}

// Update settings application function
function applySettings() {
  const selectedFontFamily = settingsElements.fontFamily.value;
  const selectedFontSize = settingsElements.fontSize.value;

  // Update settings cache
  settingsCache.fontFamily = selectedFontFamily;
  settingsCache.fontSize = selectedFontSize;

  // Apply settings
  if (noteArea) {
    noteArea.style.fontFamily = selectedFontFamily;
    noteArea.style.fontSize = `${selectedFontSize}px`;
  }

  // Save settings
  saveSettings(selectedFontFamily, selectedFontSize);

  setStatus("Settings applied");
  setTimeout(() => setStatus("Ready"), 2000);
}

function saveSettings(fontFamily: string, fontSize: string) {
  localStorage.setItem("minnote-fontFamily", fontFamily);
  localStorage.setItem("minnote-fontSize", fontSize);
}

// --- End Settings Modal Logic ---

// Toggle dropdown menu
fileMenuBtn?.addEventListener("click", (e) => {
  const dropdown = (e.currentTarget as HTMLElement).closest('.dropdown');
  dropdown?.classList.toggle('active');
  e.stopPropagation();
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const dropdown = document.querySelector('.dropdown.active');
  if (dropdown && !(e.target as HTMLElement).closest('.dropdown')) {
    dropdown.classList.remove('active');
  }
});

// Cleanup function
function cleanup() {
  // Remove event listeners
  window.removeEventListener('resize', () => {});
  if (noteArea) {
    noteArea.removeEventListener('input', () => {});
    noteArea.removeEventListener('scroll', () => {});
  }
}

// Register cleanup on window unload
window.addEventListener('unload', cleanup);

// Optimize tab switching
if (tabBar) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          // Optimize non-visible tabs
          const tab = entry.target as HTMLElement;
          tab.style.visibility = 'hidden';
        } else {
          const tab = entry.target as HTMLElement;
          tab.style.visibility = 'visible';
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('.tab').forEach(tab => {
    observer.observe(tab);
  });
}

// Optimize modal rendering
const modal = document.querySelector('.modal');
if (modal) {
  // Use requestAnimationFrame for smooth animations
  // function showModal() { ... }
  // function hideModal() { ... }
}

// Memory management
let activeTimeouts: ReturnType<typeof setTimeout>[] = [];
let activeIntervals: ReturnType<typeof setInterval>[] = [];

// function createTimeout(callback: () => void, delay: number) {
//   const timeout = setTimeout(() => {
//     callback();
//     activeTimeouts = activeTimeouts.filter(t => t !== timeout);
//   }, delay);
//   activeTimeouts.push(timeout);
//   return timeout;
// }

// function createInterval(callback: () => void, delay: number) {
//   const interval = setInterval(callback, delay);
//   activeIntervals.push(interval);
//   return interval;
// }

// Cleanup all timeouts and intervals
function cleanupTimers() {
  activeTimeouts.forEach(clearTimeout);
  activeIntervals.forEach(clearInterval);
  activeTimeouts = [];
  activeIntervals = [];
}

// Register cleanup
window.addEventListener('unload', cleanupTimers);

saveBtn?.addEventListener("click", () => {
  if (!activeTabId) return;
  saveNote(noteArea.innerHTML, activeTabId, true);
});

saveAsBtn?.addEventListener("click", () => {
  if (!activeTabId) return;
  const activeTab = tabsMap.get(activeTabId);
  if (activeTab) {
    // Clear the file path to force a new save dialog
    activeTab.filePath = undefined;
    saveNote(noteArea.innerHTML, activeTabId, true);
  }
});

openBtn?.addEventListener("click", async () => {
  try {
    const filePath = await invoke<string>("open_file_dialog");
    if (filePath) {
      const newTab = createNewTab();
      switchToTab(newTab.id);
      await loadNote(filePath);
    }
  } catch (e) {
    setStatus("Error opening file");
  }
});

newBtn?.addEventListener("click", () => {
  const newTab = createNewTab();
  switchToTab(newTab.id);
  setStatus("New note");
  setTimeout(() => setStatus("Ready"), 2000);
});

exitBtn?.addEventListener("click", async () => {
  if (noteArea.innerHTML && !confirm("Exit? Unsaved changes will be lost.")) {
    return;
  }
  try {
    // For now just show a message - the window close API is different in Tauri 2
    // and would require additional permissions in the capabilities
    setStatus("Exit functionality not implemented yet");
    setTimeout(() => setStatus("Ready"), 2000);
  } catch (e) {
    console.error("Failed to exit", e);
  }
});

window.addEventListener("DOMContentLoaded", () => {
  // Create initial tab
  const initialTab = createNewTab();
  switchToTab(initialTab.id);
  loadSettings();
});

// Add periodic cleanup
setInterval(() => {
  cleanupCache();
  // Log performance metrics every 5 minutes
  console.log('Performance metrics:', {
    ...performanceMetrics,
    uptime: Date.now() - performanceMetrics.startTime
  });
}, 5 * 60 * 1000);

// Add error boundary
window.addEventListener('error', (event) => {
  handleError(event.error, 'global_error');
  event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
  handleError(event.reason, 'unhandled_promise');
  event.preventDefault();
});

// Add event listener for new tab button
newTabBtn?.addEventListener("click", () => {
  const newTab = createNewTab();
  switchToTab(newTab.id);
});

// Add event listener for settings button
settingsBtn?.addEventListener("click", () => {
  // Check if settings tab already exists
  const existingSettingsTab = Array.from(tabsMap.values()).find(tab => tab.type === 'settings');
  
  if (existingSettingsTab) {
    // Switch to existing settings tab
    switchToTab(existingSettingsTab.id);
  } else {
    // Create new settings tab
    const settingsTab = createNewTab('settings');
    switchToTab(settingsTab.id);
  }
});

// Update back to notes button to close settings tab
backToNotesBtn?.addEventListener("click", () => {
  if (activeTabId) {
    const activeTab = tabsMap.get(activeTabId);
    if (activeTab?.type === 'settings') {
      closeTab(activeTabId);
    }
  }
});

// Update apply settings button to close settings tab after applying
settingsElements.applyBtn?.addEventListener("click", () => {
  applySettings();
  if (activeTabId) {
    const activeTab = tabsMap.get(activeTabId);
    if (activeTab?.type === 'settings') {
      closeTab(activeTabId);
    }
  }
});

// Update directory operation handlers
settingsElements.openDirBtn?.addEventListener("click", async () => {
  try {
    await invoke("open_notes_directory");
  } catch (e) {
    setStatus("Error opening notes directory");
  }
});

settingsElements.changeDirBtn?.addEventListener("click", async () => {
  try {
    const newPath = await invoke<string>("select_notes_directory");
    settingsCache.notesDirectory = newPath;
    if (settingsElements.notesDir) {
      settingsElements.notesDir.textContent = newPath;
      setStatus("Notes directory changed");
      setTimeout(() => setStatus("Ready"), 2000);
    }
  } catch (e) {
    if (e !== "No directory selected") {
      setStatus("Error changing notes directory");
    }
  }
});

// Load saved settings
function loadSettings() {
  // Load font settings
  const savedFontFamily = localStorage.getItem("minnote-fontFamily");
  const savedFontSize = localStorage.getItem("minnote-fontSize");

  if (noteArea) {
    if (savedFontFamily) {
      noteArea.style.fontFamily = savedFontFamily;
    }
    if (savedFontSize) {
      noteArea.style.fontSize = `${savedFontSize}px`;
    }
  }

  // Load notes directory
  invoke<string>("get_notes_directory")
    .then(path => {
      settingsCache.notesDirectory = path;
    })
    .catch(e => {
      console.error("Error loading notes directory:", e);
    });
}

// Debounce function for frequent events
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for performance-heavy operations
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Add formatting functions
function formatText(command: string, value: string = '') {
  document.execCommand(command, false, value);
  noteArea.focus();
}

function toggleFormatButton(button: HTMLButtonElement, command: string) {
  const isActive = document.queryCommandState(command);
  button.classList.toggle('active', isActive);
}

// Add event listeners for formatting buttons
boldBtn.addEventListener('click', () => formatText('bold'));
italicBtn.addEventListener('click', () => formatText('italic'));
bulletListBtn.addEventListener('click', () => formatText('insertUnorderedList'));
numberListBtn.addEventListener('click', () => formatText('insertOrderedList'));

// Add keyboard shortcuts
noteArea.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'b':
        e.preventDefault();
        formatText('bold');
        break;
      case 'i':
        e.preventDefault();
        formatText('italic');
        break;
    }
  }
});

// Update button states when selection changes
noteArea.addEventListener('mouseup', () => {
  toggleFormatButton(boldBtn, 'bold');
  toggleFormatButton(italicBtn, 'italic');
});

noteArea.addEventListener('keyup', () => {
  toggleFormatButton(boldBtn, 'bold');
  toggleFormatButton(italicBtn, 'italic');
});

// Export functions
async function exportNote(format: 'pdf' | 'html' | 'text') {
  if (!activeTabId) return;
  
  const tab = tabsMap.get(activeTabId);
  if (!tab) return;

  try {
    const content = noteArea.innerHTML;
    const fileName = tab.title || 'untitled';
    
    switch (format) {
      case 'pdf':
        await invoke("export_pdf", { content, fileName });
        break;
      case 'html':
        await invoke("export_html", { content, fileName });
        break;
      case 'text':
        await invoke("export_text", { content: noteArea.innerText, fileName });
        break;
    }
    
    setStatus(`Exported as ${format.toUpperCase()}`);
    setTimeout(() => setStatus("Ready"), 2000);
  } catch (error) {
    handleError(error as Error, 'export_note');
  }
}

// Add event listeners for export buttons
exportPdfBtn?.addEventListener("click", () => exportNote('pdf'));
exportHtmlBtn?.addEventListener("click", () => exportNote('html'));
exportTextBtn?.addEventListener("click", () => exportNote('text'));
