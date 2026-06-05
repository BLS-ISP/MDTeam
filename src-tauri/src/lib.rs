use std::process::Command;

#[tauri::command]
fn git_init(repo_path: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(&["init"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

#[tauri::command]
fn git_status(repo_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(&["status", "--porcelain"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn git_log(repo_path: String, limit: usize) -> Result<String, String> {
    let output = Command::new("git")
        .args(&[
            "log",
            &format!("-n{}", limit),
            "--pretty=format:%h|%s|%an|%ad",
            "--date=format:%d.%m.%Y %H:%M"
        ])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn git_commit(repo_path: String, message: String) -> Result<(), String> {
    // 1. git add .
    let add_output = Command::new("git")
        .args(&["add", "."])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    if !add_output.status.success() {
        return Err(String::from_utf8_lossy(&add_output.stderr).to_string());
    }

    // 2. git commit -m
    let commit_output = Command::new("git")
        .args(&["commit", "-m", &message])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    if !commit_output.status.success() {
        return Err(String::from_utf8_lossy(&commit_output.stderr).to_string());
    }
    Ok(())
}

#[tauri::command]
fn git_push(repo_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(&["push"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn git_pull(repo_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(&["pull"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn git_diff_files(repo_path: String, start_commit: String, end_commit: String) -> Result<String, String> {
    let end_arg = if end_commit == "current" || end_commit.is_empty() {
        "HEAD".to_string()
    } else {
        end_commit
    };

    let output = Command::new("git")
        .args(&["diff", "--name-status", &format!("{}..{}", start_commit, end_arg)])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            git_init,
            git_status,
            git_log,
            git_commit,
            git_push,
            git_pull,
            git_diff_files
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

