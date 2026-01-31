/**
 * Path utilities for skill directories
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

/**
 * Get the primary skills install directory
 */
export function getSkillsDirectory(): string {
  const config = vscode.workspace.getConfiguration('lobstore');
  const customDir = config.get<string>('skillsDirectory', '');

  if (customDir && customDir.trim()) {
    return expandPath(customDir);
  }

  // Default: workspace .github/skills (for GitHub Copilot)
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    return path.join(workspaceFolder.uri.fsPath, '.github', 'skills');
  }

  // Fallback to home directory if no workspace
  return path.join(os.homedir(), '.github', 'skills');
}

/**
 * Get all skill directories to scan
 */
export function getAllSkillDirectories(): string[] {
  const dirs: string[] = [];
  const home = os.homedir();

  // Primary (workspace .github/skills)
  dirs.push(getSkillsDirectory());

  // Other common locations
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const others = [
    ...(workspaceFolder ? [
      path.join(workspaceFolder.uri.fsPath, '.github', 'skills'),
      path.join(workspaceFolder.uri.fsPath, '.github', 'copilot', 'skills')
    ] : []),
    path.join(home, '.github', 'skills'),
    path.join(home, '.copilot', 'skills'),
    path.join(home, '.claude', 'skills'),
    path.join(home, '.openclaw', 'skills'),
  ];

  for (const dir of others) {
    if (!dirs.includes(dir)) {
      dirs.push(dir);
    }
  }

  return dirs;
}

/**
 * Expand ~ in paths
 */
export function expandPath(p: string): string {
  if (p.startsWith('~')) {
    p = path.join(os.homedir(), p.slice(1));
  }
  return path.resolve(p);
}

/**
 * Ensure directory exists
 */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Check if path exists
 */
export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find where a skill is installed
 */
export async function findInstalledSkill(slug: string): Promise<string | null> {
  for (const dir of getAllSkillDirectories()) {
    const skillPath = path.join(dir, slug);
    const skillMd = path.join(skillPath, 'SKILL.md');
    if (await exists(skillMd)) {
      return skillPath;
    }
  }
  return null;
}

/**
 * List all installed skills
 */
export async function listInstalledSkills(): Promise<Array<{ slug: string; path: string }>> {
  const skills: Array<{ slug: string; path: string }> = [];
  const seen = new Set<string>();

  for (const dir of getAllSkillDirectories()) {
    if (!(await exists(dir))) continue;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillPath = path.join(dir, entry.name);
        const skillMd = path.join(skillPath, 'SKILL.md');

        if ((await exists(skillMd)) && !seen.has(entry.name)) {
          seen.add(entry.name);
          skills.push({ slug: entry.name, path: skillPath });
        }
      }
    } catch (e) {
      // Skip inaccessible directories
    }
  }

  return skills;
}
