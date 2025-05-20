# MinNote

A minimal, elegant note-taking desktop application built with [Tauri 2.0](https://tauri.app/) and vanilla TypeScript. MinNote provides a clean, distraction-free environment for writing and storing notes locally on your device with a modern, native feel across all platforms.

<div align="center">
  <img src="./src/assets/tauri.svg" width="80" />
</div>

**Simple. Fast. Secure.**

## Features

- **Minimal UI**: Clean, modern Notepad-like interface focused purely on writing
- **Auto-save**: Your notes are automatically saved as you type with status indicators
- **File Operations**: Full dropdown menu with New, Open, Save, Save As, and Exit options
- **Local Storage**: All notes stored securely in your app data directory using Rust for file handling
- **Cross-platform**: Works seamlessly on Windows, macOS, and Linux with native performance
- **Dark/Light Mode**: Automatically adapts to your system theme preferences
- **Lightweight**: Incredibly fast startup and minimal memory footprint (~10MB RAM usage)
- **Character Count**: Real-time character counting for your notes
- **Status Updates**: Informative status bar with operation feedback

## Screenshots

![MinNote Screenshot](./src/assets/vite.svg) <!-- Replace with actual screenshot if available -->

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Rust](https://www.rust-lang.org/tools/install) (stable version required for Tauri)
- [Tauri CLI](https://tauri.app/v2/guides/getting-started/prerequisites/) (for development)

### Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/yourusername/minnote.git
   cd minnote
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Run the app in development mode:

   ```sh
   npm run tauri dev
   ```

### Build for Production

To build the app for release:

```sh
npm run tauri build
```

The compiled binaries will be available in:

- Windows: `src-tauri/target/release/minnote.exe`
- macOS: `src-tauri/target/release/bundle/dmg/MinNote_x.x.x_aarch64.dmg` or `MinNote_x.x.x_x86_64.dmg`
- Linux: `src-tauri/target/release/bundle/appimage/minnote_x.x.x_amd64.AppImage`

## Project Structure

- `index.html` – Main HTML file with app structure and UI components
- `src/`
  - `main.ts` – Frontend TypeScript logic for the editor and UI interactions
  - `styles.css` – Styling for the entire application (light/dark theme support)
  - `assets/` – Images and icons used in the app
- `src-tauri/` – Rust backend for native functionality
  - `src/lib.rs` – Core Rust functionality for file system operations
  - `Cargo.toml` – Rust dependencies and project configuration
  - `tauri.conf.json` – Tauri configuration (permissions, window settings)
- `package.json` – Project metadata, dependencies, and npm scripts

## Technology Stack

- **Frontend**:
  - HTML5 for structure
  - CSS3 for styling with CSS variables for theming
  - TypeScript for type-safe scripting
  - No external UI frameworks (pure vanilla implementation)
  
- **Backend**:
  - Rust with Tauri 2.0 framework
  - `dirs` crate for cross-platform file system access
  - Native file system operations for data persistence
  
- **Build & Development**:
  - Vite for frontend development and bundling
  - TypeScript compiler for static typing
  - Cargo for Rust package management
  - Tauri CLI for development workflow

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|--------------|-------|
| New Note | Ctrl+N | ⌘+N |
| Save | Ctrl+S | ⌘+S |
| Save As | Ctrl+Shift+S | ⌘+Shift+S |
| Open | Ctrl+O | ⌘+O |
| Exit | Alt+F4 | ⌘+Q |

## Technical Details

### How Auto-Save Works

The app implements a debounced auto-save feature that waits for 1 second of inactivity before saving your note. This ensures efficient file system access without sacrificing data safety. A status indicator at the bottom of the app shows the current state:

- **Editing...**: Changes detected, not yet saved
- **Saved**: Note successfully saved to disk
- **Ready**: App is idle and ready for input

### Storage Implementation

Notes are stored in your system's standard app data directory:

- Windows: `%APPDATA%\minnote\note.txt`
- macOS: `~/Library/Application Support/minnote/note.txt`
- Linux: `~/.local/share/minnote/note.txt`

The cross-platform `dirs` crate in Rust ensures that your notes are always saved in the appropriate location for your operating system.

## Development

This project demonstrates how to build a modern desktop app with web technologies and Rust. The Tauri 2.0 framework provides significant advantages:

- **Security**: Rust's memory safety and filesystem sandboxing
- **Performance**: Native speed and low resource usage
- **Cross-platform**: One codebase for all major desktop platforms
- **Simplicity**: Minimal dependencies and straightforward architecture

### Future Features

- **Multiple Notes**: Support for managing multiple note files
- **Markdown Support**: Rich text formatting with Markdown syntax
- **Custom Themes**: User-defined color schemes and fonts
- **Search Functionality**: Full-text search across notes
- **File Drag & Drop**: Import and export via drag and drop
- **Autosave Options**: Configurable autosave intervals
- **Keyboard Navigation**: Enhanced keyboard shortcuts
- **Export Formats**: PDF, HTML, and plain text exports
- **Text Statistics**: Word count and reading time estimates

## Development Tools

### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) with the following extensions:
  - [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) for Tauri development
  - [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) for Rust language support
  - [TypeScript](https://marketplace.visualstudio.com/items?itemName=ms-typescript.typescript) for TypeScript development
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) for JavaScript/TypeScript linting

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits & Acknowledgments

- Built with [Tauri](https://tauri.app/)
- Inspired by minimal note-taking apps like Notepad and SimpleNote
- Icons from [Tauri](https://tauri.app/) and [Vite](https://vitejs.dev/)
