import { invoke } from "@tauri-apps/api/core";

const noteArea = document.getElementById("note-area") as HTMLTextAreaElement;
const statusMsg = document.getElementById("status-msg") as HTMLElement;
const charCount = document.getElementById("char-count") as HTMLElement;
const newBtn = document.getElementById("new-note") as HTMLButtonElement;
const openBtn = document.getElementById("open-note") as HTMLButtonElement;
const saveBtn = document.getElementById("save-note") as HTMLButtonElement;
const saveAsBtn = document.getElementById("save-as-note") as HTMLButtonElement;
const exitBtn = document.getElementById("exit-app") as HTMLButtonElement;
const fileMenuBtn = document.getElementById("file-menu-btn") as HTMLButtonElement;

let autoSaveTimer: number | undefined;
const AUTO_SAVE_DELAY = 1000; // ms

function setStatus(msg: string) {
  if (statusMsg) statusMsg.textContent = msg;
}

function updateCharCount() {
  if (charCount) {
    const count = noteArea.value.length;
    charCount.textContent = `${count} character${count !== 1 ? 's' : ''}`;
  }
}

async function saveNote(content: string) {
  try {
    await invoke("save_note", { content });
    setStatus("Saved");
    setTimeout(() => setStatus("Ready"), 2000);
  } catch (e) {
    setStatus("Error saving note");
  }
}

async function loadNote() {
  try {
    const content = await invoke<string>("load_note");
    noteArea.value = content || "";
    updateCharCount();
    setStatus("Note loaded");
    setTimeout(() => setStatus("Ready"), 2000);
  } catch (e) {
    setStatus("Error loading note");
  }
}

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
  setStatus("Editing...");
  updateCharCount();
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => {
    saveNote(noteArea.value);
  }, AUTO_SAVE_DELAY);
});

saveBtn?.addEventListener("click", () => saveNote(noteArea.value));
saveAsBtn?.addEventListener("click", () => {
  // TODO: Implement save as functionality
  setStatus("Save As not yet implemented");
  setTimeout(() => setStatus("Ready"), 2000);
});

openBtn?.addEventListener("click", () => loadNote());
newBtn?.addEventListener("click", () => {
  if (noteArea.value && !confirm("Create new note? Unsaved changes will be lost.")) {
    return;
  }
  noteArea.value = "";
  updateCharCount();
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
  loadNote();
});
