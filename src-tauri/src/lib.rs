pub mod git_conflicts;

use git_conflicts::sanitize_git_file_path;
pub use git_conflicts::{
    git_get_conflict_versions, git_list_conflicts, git_resolve_conflict_file, ConflictFileVersions,
};
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

fn sanitize_git_ref(input: &str, field_name: &str) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(format!("Invalid {}: must not be empty", field_name));
    }
    if trimmed.starts_with('-') {
        return Err(format!(
            "Invalid {}: cannot start with '-' (flag injection blocked)",
            field_name
        ));
    }
    if trimmed.contains("..")
        || trimmed.contains("@{")
        || trimmed.ends_with(".lock")
        || trimmed.starts_with('/')
        || trimmed.ends_with('/')
        || trimmed.starts_with('.')
        || trimmed.ends_with('.')
    {
        return Err(format!("Invalid {}: disallowed git ref sequence", field_name));
    }
    if trimmed.chars().any(|c| {
        c.is_control()
            || c.is_whitespace()
            || matches!(c, ':' | '~' | '^' | '?' | '*' | '[' | '\\')
    }) {
        return Err(format!(
            "Invalid {}: contains disallowed characters",
            field_name
        ));
    }
    Ok(trimmed.to_string())
}

#[tauri::command]
fn git_current_branch(repo_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(&["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
fn git_list_branches(repo_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(&["branch", "--format=%(refname:short)|%(HEAD)"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
fn git_checkout_branch(
    repo_path: String,
    branch_name: String,
    create: bool,
) -> Result<String, String> {
    let safe_branch = sanitize_git_ref(&branch_name, "branch_name")?;
    let args: Vec<&str> = if create {
        vec!["checkout", "-b", &safe_branch]
    } else {
        vec!["checkout", &safe_branch]
    };

    let output = Command::new("git")
        .args(&args)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        Ok(String::from_utf8_lossy(&output.stderr).trim().to_string())
    } else {
        Ok(stdout)
    }
}

#[tauri::command]
fn git_file_history(
    repo_path: String,
    file_path: String,
    limit: usize,
) -> Result<String, String> {
    let safe_file = sanitize_git_file_path(&file_path)?;
    let safe_limit = if limit == 0 { 1 } else { limit.min(500) };

    let output = Command::new("git")
        .args(&[
            "log",
            &format!("-n{}", safe_limit),
            "--pretty=format:%h|%s|%an|%ad",
            "--date=format:%d.%m.%Y %H:%M",
            "--",
            &safe_file,
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
fn git_show_file_at_commit(
    repo_path: String,
    commit_hash: String,
    file_path: String,
) -> Result<String, String> {
    let safe_commit = sanitize_git_ref(&commit_hash, "commit_hash")?;
    let safe_file = sanitize_git_file_path(&file_path)?;
    let object_spec = format!("{}:{}", safe_commit, safe_file);

    let output = Command::new("git")
        .args(&["show", &object_spec])
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
            git_diff_files,
            git_current_branch,
            git_list_branches,
            git_checkout_branch,
            git_file_history,
            git_show_file_at_commit,
            git_conflicts::git_list_conflicts,
            git_conflicts::git_get_conflict_versions,
            git_conflicts::git_resolve_conflict_file
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

