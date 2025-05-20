use std::fs;
use tauri_plugin_dialog::DialogExt;
use std::sync::mpsc;
use dirs::data_dir;
use std::path::PathBuf;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn save_note(content: String, file_path: String) -> Result<(), String> {
    // Get the notes directory from config or use default
    let notes_dir = if let Ok(custom_dir) = fs::read_to_string("notes_dir.txt") {
        if !custom_dir.trim().is_empty() {
            std::path::PathBuf::from(custom_dir.trim())
        } else {
            let data_dir = data_dir().ok_or("Could not find data directory")?;
            data_dir.join("minnote")
        }
    } else {
        let data_dir = data_dir().ok_or("Could not find data directory")?;
        data_dir.join("minnote")
    };
    
    // Create notes directory if it doesn't exist
    fs::create_dir_all(&notes_dir).map_err(|e| e.to_string())?;
    
    // Create the full path by joining notes_dir with the file_path
    let full_path = notes_dir.join(file_path);
    
    // Create parent directories if they don't exist
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    // Write the file
    fs::write(&full_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_note(file_path: Option<String>) -> Result<String, String> {
    match file_path {
        Some(path) => {
            // Get the notes directory from config or use default
            let notes_dir = if let Ok(custom_dir) = fs::read_to_string("notes_dir.txt") {
                if !custom_dir.trim().is_empty() {
                    std::path::PathBuf::from(custom_dir.trim())
                } else {
                    let data_dir = data_dir().ok_or("Could not find data directory")?;
                    data_dir.join("minnote")
                }
            } else {
                let data_dir = data_dir().ok_or("Could not find data directory")?;
                data_dir.join("minnote")
            };

            let full_path = notes_dir.join(path);
            match fs::read_to_string(&full_path) {
                Ok(content) => Ok(content),
                Err(e) => Err(e.to_string()),
            }
        },
        None => Ok(String::new()), // Return empty if no file specified
    }
}

#[tauri::command]
async fn open_file_dialog(window: tauri::Window) -> Result<String, String> {
    let (tx, rx) = mpsc::channel();
    
    window.dialog()
        .file()
        .add_filter("Text Files", &["txt"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });

    match rx.recv().map_err(|_| "Dialog was closed".to_string())? {
        Some(path) => Ok(path.to_string()),
        None => Err("No file selected".to_string()),
    }
}

#[tauri::command]
fn get_notes_directory() -> Result<String, String> {
    // First try to get custom directory from config
    if let Ok(custom_dir) = std::fs::read_to_string("notes_dir.txt") {
        if !custom_dir.trim().is_empty() {
            return Ok(custom_dir.trim().to_string());
        }
    }
    
    // Fall back to default directory
    let data_dir = data_dir().ok_or("Could not find data directory")?;
    let notes_dir = data_dir.join("minnote");
    Ok(notes_dir.to_string_lossy().to_string())
}

#[tauri::command]
async fn select_notes_directory(window: tauri::Window) -> Result<String, String> {
    let (tx, rx) = mpsc::channel();
    
    window.dialog()
        .file()
        .add_filter("All Files", &["*"])
        .pick_folder(move |path| {
            let _ = tx.send(path);
        });

    match rx.recv().map_err(|_| "Dialog was closed".to_string())? {
        Some(path) => {
            // Save the selected directory to config
            fs::write("notes_dir.txt", path.to_string())
                .map_err(|e| e.to_string())?;
            Ok(path.to_string())
        },
        None => Err("No directory selected".to_string()),
    }
}

#[tauri::command]
fn open_notes_directory() -> Result<(), String> {
    let data_dir = data_dir().ok_or("Could not find data directory")?;
    let notes_dir = data_dir.join("minnote");
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(notes_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(notes_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(notes_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            save_note, 
            load_note, 
            open_file_dialog,
            get_notes_directory,
            open_notes_directory,
            select_notes_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
