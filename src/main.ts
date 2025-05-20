import { invoke } from "@tauri-apps/api/core";

interface Tab {
  id: string;
  title: string;
  content: string;
  isSaved: boolean;
  filePath?: string;  // Add filePath to track where the file is saved
}

const noteArea = document.getElementById("note-area") as HTMLTextAreaElement;
const statusMsg = document.getElementById("status-msg") as HTMLElement;
const charCount = document.getElementById("char-count") as HTMLElement;
const newBtn = document.getElementById("new-note") as HTMLButtonElement;
const openBtn = document.getElementById("open-note") as HTMLButtonElement;
const saveBtn = document.getElementById("save-note") as HTMLButtonElement;
const saveAsBtn = document.getElementById("save-as-note") as HTMLButtonElement;
const exitBtn = document.getElementById("exit-app") as HTMLButtonElement;
const fileMenuBtn = document.getElementById("file-menu-btn") as HTMLButtonElement;
const tabBar = document.getElementById("tab-bar") as HTMLDivElement;

// Settings Modal Elements
const settingsBtn = document.getElementById("settings-btn") as HTMLButtonElement;
const settingsModal = document.getElementById("settings-modal") as HTMLDivElement;
const closeSettingsModalBtn = document.getElementById("close-settings-modal") as HTMLSpanElement;
const applySettingsBtn = document.getElementById("apply-settings-btn") as HTMLButtonElement;
const fontFamilySelect = document.getElementById("font-family-select") as HTMLSelectElement;
const fontSizeInput = document.getElementById("font-size-input") as HTMLInputElement;
const notesDirectoryPath = document.getElementById("notes-directory-path") as HTMLSpanElement;
const openNotesDirectoryBtn = document.getElementById("open-notes-directory") as HTMLButtonElement;

let tabs: Tab[] = [];
let activeTabId: string | null = null;
let autoSaveTimer: number | undefined;
const AUTO_SAVE_DELAY = 1000; // ms

function createNewTab(): Tab {
  const id = `tab-${Date.now()}`;
  const tab: Tab = {
    id,
    title: "Untitled",
    content: "",
    isSaved: true
  };
  tabs.push(tab);
  return tab;
}

function switchToTab(tabId: string) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  // Save current tab content if exists
  if (activeTabId) {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab) {
      currentTab.content = noteArea.value;
    }
  }

  // Switch to new tab
  activeTabId = tabId;
  noteArea.value = tab.content;
  updateCharCount();
  updateTabUI();
}

function updateTabUI() {
  if (!tabBar) return;
  
  tabBar.innerHTML = '';
  tabs.forEach(tab => {
    const tabElement = document.createElement('div');
    tabElement.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
    const title = tab.isSaved ? tab.title : `${tab.title} *`;
    tabElement.innerHTML = `
      <span class="tab-title">${title}</span>
      <button class="tab-close" data-tab-id="${tab.id}">×</button>
    `;
    
    tabElement.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).classList.contains('tab-close')) {
        switchToTab(tab.id);
      }
    });

    const closeBtn = tabElement.querySelector('.tab-close');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    tabBar.appendChild(tabElement);
  });
}

async function closeTab(tabId: string) {
  const tabIndex = tabs.findIndex(t => t.id === tabId);
  if (tabIndex === -1) return;

  const tab = tabs[tabIndex];
  if (!tab.isSaved) {
    const response = await showSaveDialog(tab);
    if (response === 'cancel') {
      return;
    }
    if (response === 'save') {
      await saveNote(tab.content, tab.id);
    }
  }

  tabs.splice(tabIndex, 1);
  
  if (activeTabId === tabId) {
    activeTabId = tabs.length > 0 ? tabs[0].id : null;
    if (activeTabId) {
      switchToTab(activeTabId);
    } else {
      noteArea.value = "";
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

function setStatus(msg: string) {
  if (statusMsg) statusMsg.textContent = msg;
}

function updateCharCount() {
  if (charCount) {
    const count = noteArea.value.length;
    charCount.textContent = `${count} character${count !== 1 ? 's' : ''}`;
  }
}

async function saveNote(content: string, tabId: string) {
  try {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    let filePath = tab.filePath;
    
    // If no file path exists, prompt for file name
    if (!filePath) {
      const fileName = prompt("Enter file name:", tab.title);
      if (!fileName) return; // User cancelled
      
      // Add .txt extension if not present
      const finalFileName = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
      filePath = finalFileName;
      tab.filePath = filePath;
      tab.title = fileName.replace('.txt', '');
      updateTabUI();
    }

    await invoke("save_note", { content, filePath });
    tab.isSaved = true;
    setStatus("Saved");
    setTimeout(() => setStatus("Ready"), 2000);
  } catch (e) {
    console.error("Error saving note:", e);
    setStatus("Error saving note");
  }
}

async function loadNote(filePath?: string) {
  try {
    const content = await invoke<string>("load_note", { filePath });
    if (!activeTabId) return;

    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) {
      activeTab.content = content || "";
      activeTab.isSaved = true;
      if (filePath) {
        activeTab.filePath = filePath;
        activeTab.title = filePath.split('/').pop()?.replace('.txt', '') || "Untitled";
        updateTabUI();
      }
      noteArea.value = content || "";
      updateCharCount();
      setStatus("Note loaded");
      setTimeout(() => setStatus("Ready"), 2000);
    }
  } catch (e) {
    setStatus("Error loading note");
  }
}

// --- Settings Modal Logic ---

function openSettingsModal() {
  if (settingsModal) settingsModal.style.display = "block";
  loadSettingsToModal(); // Load current/saved settings into modal inputs
}

function closeSettingsModal() {
  if (settingsModal) settingsModal.style.display = "none";
}

function applyAndCloseSettings() {
  const selectedFontFamily = fontFamilySelect.value;
  const selectedFontSize = fontSizeInput.value;

  if (noteArea) {
    noteArea.style.fontFamily = selectedFontFamily;
    noteArea.style.fontSize = `${selectedFontSize}px`;
  }
  saveSettings(selectedFontFamily, selectedFontSize);
  setStatus("Settings applied");
  setTimeout(() => setStatus("Ready"), 2000);
  closeSettingsModal();
}

function saveSettings(fontFamily: string, fontSize: string) {
  localStorage.setItem("minnote-fontFamily", fontFamily);
  localStorage.setItem("minnote-fontSize", fontSize);
}

function loadSettings() {
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
  // Ensure modal inputs are updated if modal is opened later
  // This is primarily handled by loadSettingsToModal when the modal opens.
}

async function loadSettingsToModal() {
  const savedFontFamily = localStorage.getItem("minnote-fontFamily");
  const savedFontSize = localStorage.getItem("minnote-fontSize");

  if (fontFamilySelect) {
    fontFamilySelect.value = savedFontFamily || (noteArea ? getComputedStyle(noteArea).fontFamily : 'var(--font-main)');
  }
  if (fontSizeInput) {
    fontSizeInput.value = savedFontSize || (noteArea ? parseInt(getComputedStyle(noteArea).fontSize).toString() : '16');
  }

  // Load notes directory path
  try {
    const path = await invoke<string>("get_notes_directory");
    if (notesDirectoryPath) {
      notesDirectoryPath.textContent = path;
    }
  } catch (e) {
    if (notesDirectoryPath) {
      notesDirectoryPath.textContent = "Error loading directory path";
    }
  }
}

// Event Listeners for Settings
settingsBtn?.addEventListener("click", openSettingsModal);
closeSettingsModalBtn?.addEventListener("click", closeSettingsModal);
applySettingsBtn?.addEventListener("click", applyAndCloseSettings);
openNotesDirectoryBtn?.addEventListener("click", async () => {
  try {
    await invoke("open_notes_directory");
  } catch (e) {
    setStatus("Error opening notes directory");
  }
});

// Close modal if user clicks outside of it
window.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    closeSettingsModal();
  }
});

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

noteArea?.addEventListener("input", () => {
  if (!activeTabId) return;
  
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab) {
    activeTab.isSaved = false;
    activeTab.content = noteArea.value;
    // Update tab title with asterisk if unsaved
    updateTabUI();
  }
  
  setStatus("Editing...");
  updateCharCount();
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => {
    if (activeTabId) {
      saveNote(noteArea.value, activeTabId);
    }
  }, AUTO_SAVE_DELAY);
});

saveBtn?.addEventListener("click", () => {
  if (!activeTabId) return;
  saveNote(noteArea.value, activeTabId);
});

saveAsBtn?.addEventListener("click", () => {
  if (!activeTabId) return;
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab) {
    // Clear the file path to force a new save dialog
    activeTab.filePath = undefined;
    saveNote(noteArea.value, activeTabId);
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
  if (noteArea.value && !confirm("Exit? Unsaved changes will be lost.")) {
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
