use std::fs;
use tauri_plugin_dialog::DialogExt;
use std::sync::mpsc;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn save_note(content: String, file_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_note(file_path: Option<String>) -> Result<String, String> {
    match file_path {
        Some(path) => {
            match fs::read_to_string(&path) {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet, save_note, load_note, open_file_dialog])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
