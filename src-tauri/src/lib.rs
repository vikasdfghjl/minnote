use std::fs;
use dirs;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn save_note(content: String) -> Result<(), String> {
    let dir = dirs::data_dir().ok_or("No app data dir")?;
    let file_path = dir.join("minnote").join("note.txt");
    fs::create_dir_all(file_path.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_note() -> Result<String, String> {
    let dir = dirs::data_dir().ok_or("No app data dir")?;
    let file_path = dir.join("minnote").join("note.txt");
    match fs::read_to_string(&file_path) {
        Ok(content) => Ok(content),
        Err(_) => Ok(String::new()), // Return empty if not found
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, save_note, load_note])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
