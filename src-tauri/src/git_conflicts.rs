use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFileVersions {
    pub file_path: String,
    pub base: String,
    pub ours: String,
    pub theirs: String,
    pub working_tree: String,
    pub has_base: bool,
    pub has_ours: bool,
    pub has_theirs: bool,
}

/// Strictly validates a repository-relative Git file path, blocking CLI flag
/// injection (leading `-`), directory traversal (`..`), absolute paths, drive
/// prefixes, control characters, and `.git` internal paths.
pub fn sanitize_git_file_path(input: &str) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Invalid file_path: must not be empty".to_string());
    }
    if trimmed.starts_with('-') {
        return Err("Invalid file_path: cannot start with '-' (flag injection blocked)".to_string());
    }

    let normalized = trimmed.replace('\\', "/");
    let mut clean = normalized.as_str();
    while let Some(rest) = clean.strip_prefix("./") {
        clean = rest;
    }

    if clean.is_empty() {
        return Err("Invalid file_path: must not be empty".to_string());
    }
    if clean.starts_with('-') {
        return Err("Invalid file_path: cannot start with '-' (flag injection blocked)".to_string());
    }
    if clean.starts_with('/') || clean.contains(':') {
        return Err("Invalid file_path: must be a relative repository path".to_string());
    }
    if clean.chars().any(|c| c.is_control()) {
        return Err("Invalid file_path: contains control characters".to_string());
    }
    if clean
        .split('/')
        .any(|seg| seg.is_empty() || seg == "." || seg == ".." || seg.eq_ignore_ascii_case(".git"))
    {
        return Err("Invalid file_path: path traversal or .git access is not allowed".to_string());
    }

    Ok(clean.to_string())
}

fn validate_repo_dir(repo_path: &str) -> Result<PathBuf, String> {
    let trimmed = repo_path.trim();
    if trimmed.is_empty() {
        return Err("Invalid repo_path: must not be empty".to_string());
    }
    let path = Path::new(trimmed);
    if !path.is_dir() {
        return Err("Invalid repo_path: directory does not exist".to_string());
    }
    fs::canonicalize(path).map_err(|e| format!("Failed to resolve repo_path: {}", e))
}

fn resolve_safe_repo_file(repo_path: &str, safe_rel_path: &str) -> Result<(PathBuf, PathBuf), String> {
    let canon_repo = validate_repo_dir(repo_path)?;
    let mut current = canon_repo.clone();

    for seg in safe_rel_path.split('/') {
        current.push(seg);
        if let Ok(meta) = fs::symlink_metadata(&current) {
            if meta.file_type().is_symlink() {
                return Err("Refusing to access symlinked path inside repository".to_string());
            }
            let canon_cur = fs::canonicalize(&current)
                .map_err(|e| format!("Failed to canonicalize target path: {}", e))?;
            if !canon_cur.starts_with(&canon_repo) {
                return Err("Security error: resolved path escapes repository root".to_string());
            }
        }
    }

    Ok((canon_repo, current))
}

fn read_git_index_stage(repo_dir: &Path, stage: u8, safe_file: &str) -> (String, bool) {
    let spec = format!(":{}:{}", stage, safe_file);
    match Command::new("git")
        .args(["show", &spec])
        .current_dir(repo_dir)
        .output()
    {
        Ok(out) if out.status.success() => (String::from_utf8_lossy(&out.stdout).to_string(), true),
        _ => (String::new(), false),
    }
}

#[tauri::command]
pub fn git_list_conflicts(repo_path: String) -> Result<Vec<String>, String> {
    let canon_repo = validate_repo_dir(&repo_path)?;
    let output = Command::new("git")
        .args(["-c", "core.quotepath=false", "diff", "--name-only", "--diff-filter=U"])
        .current_dir(&canon_repo)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let mut conflicts = Vec::new();
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(safe) = sanitize_git_file_path(trimmed) {
            if !conflicts.contains(&safe) {
                conflicts.push(safe);
            }
        }
    }
    Ok(conflicts)
}

#[tauri::command]
pub fn git_get_conflict_versions(
    repo_path: String,
    file_path: String,
) -> Result<ConflictFileVersions, String> {
    let safe_file = sanitize_git_file_path(&file_path)?;
    let (canon_repo, full_path) = resolve_safe_repo_file(&repo_path, &safe_file)?;

    let (base, has_base) = read_git_index_stage(&canon_repo, 1, &safe_file);
    let (ours, has_ours) = read_git_index_stage(&canon_repo, 2, &safe_file);
    let (theirs, has_theirs) = read_git_index_stage(&canon_repo, 3, &safe_file);

    let working_tree = if full_path.is_file() {
        fs::read_to_string(&full_path).map_err(|e| format!("Failed to read working tree file: {}", e))?
    } else {
        String::new()
    };

    if !has_base && !has_ours && !has_theirs && !full_path.exists() {
        return Err(format!(
            "File '{}' was not found in conflicted Git index stages or working tree",
            safe_file
        ));
    }

    Ok(ConflictFileVersions {
        file_path: safe_file,
        base,
        ours,
        theirs,
        working_tree,
        has_base,
        has_ours,
        has_theirs,
    })
}

#[tauri::command]
pub fn git_resolve_conflict_file(
    repo_path: String,
    file_path: String,
    resolved_content: String,
) -> Result<(), String> {
    let safe_file = sanitize_git_file_path(&file_path)?;
    let (canon_repo, full_path) = resolve_safe_repo_file(&repo_path, &safe_file)?;

    if let Some(parent) = full_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directories: {}", e))?;
        }
        let canon_parent = fs::canonicalize(parent)
            .map_err(|e| format!("Failed to verify parent directory: {}", e))?;
        if !canon_parent.starts_with(&canon_repo) {
            return Err("Security error: parent directory escapes repository root".to_string());
        }
    }

    fs::write(&full_path, resolved_content.as_bytes())
        .map_err(|e| format!("Failed to write resolved file: {}", e))?;

    let add_output = Command::new("git")
        .args(["add", "--", &safe_file])
        .current_dir(&canon_repo)
        .output()
        .map_err(|e| e.to_string())?;

    if !add_output.status.success() {
        return Err(String::from_utf8_lossy(&add_output.stderr).trim().to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_flags_and_traversal() {
        assert!(sanitize_git_file_path("-f").is_err());
        assert!(sanitize_git_file_path("./--upload-pack=evil").is_err());
        assert!(sanitize_git_file_path("../secret.md").is_err());
        assert!(sanitize_git_file_path("arc42/../../etc/passwd").is_err());
        assert!(sanitize_git_file_path("/abs/path.md").is_err());
        assert!(sanitize_git_file_path("C:\\temp\\a.md").is_err());
        assert!(sanitize_git_file_path(".git/config").is_err());
    }

    #[test]
    fn accepts_clean_relative_paths() {
        assert_eq!(sanitize_git_file_path("./arc42\\01_intro.md").unwrap(), "arc42/01_intro.md");
        assert_eq!(sanitize_git_file_path("issues/MDT-101.md").unwrap(), "issues/MDT-101.md");
    }

    #[test]
    fn lists_reads_and_resolves_real_git_conflict() {
        let dir = std::env::temp_dir().join(format!("mdteam_conflict_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("arc42")).unwrap();
        let run = |args: &[&str]| Command::new("git").args(args).current_dir(&dir).output().unwrap();
        run(&["init", "-b", "main"]);
        run(&["config", "user.email", "test@mdteam.local"]);
        run(&["config", "user.name", "Tester"]);
        fs::write(dir.join("arc42/goal.md"), "# Goal\nBase line\n").unwrap();
        run(&["add", "."]);
        run(&["commit", "-m", "base"]);
        run(&["checkout", "-b", "theirs-branch"]);
        fs::write(dir.join("arc42/goal.md"), "# Goal\nTeam version\n").unwrap();
        run(&["commit", "-am", "theirs"]);
        run(&["checkout", "main"]);
        fs::write(dir.join("arc42/goal.md"), "# Goal\nOur version\n").unwrap();
        run(&["commit", "-am", "ours"]);
        let _ = run(&["merge", "theirs-branch"]);

        let repo = dir.to_string_lossy().to_string();
        assert_eq!(git_list_conflicts(repo.clone()).unwrap(), vec!["arc42/goal.md"]);
        let v = git_get_conflict_versions(repo.clone(), "arc42/goal.md".into()).unwrap();
        assert!(v.base.contains("Base line") && v.ours.contains("Our version") && v.theirs.contains("Team version"));
        assert!(v.working_tree.contains("<<<<<<<"));
        git_resolve_conflict_file(repo.clone(), "arc42/goal.md".into(), "# Goal\nResolved\n".into()).unwrap();
        assert!(git_list_conflicts(repo).unwrap().is_empty());
        let _ = fs::remove_dir_all(&dir);
    }
}
