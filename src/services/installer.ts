/**
 * Skill Installer Service
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { getAPI } from '../api/clawdhub';
import { getSkillsDirectory, ensureDir, exists, findInstalledSkill } from '../utils/paths';

export interface InstalledSkillInfo {
  slug: string;
  name: string;
  description: string;
  version?: string;
  path: string;
}

/**
 * Download and install a skill
 */
export async function installSkill(slug: string, force: boolean = false): Promise<string> {
  const api = getAPI();
  const skillsDir = getSkillsDirectory();
  
  // Use only the skill name (not username/skillname) for the folder
  const skillName = slug.split('/')[1];
  const targetDir = path.join(skillsDir, skillName);

  // Check if exists
  const existing = await findInstalledSkill(skillName);
  if (existing && !force) {
    const choice = await vscode.window.showWarningMessage(
      `"${slug}" is already installed. Overwrite?`,
      'Yes', 'No'
    );
    if (choice !== 'Yes') {
      throw new Error('Cancelled');
    }
    await fs.rm(existing, { recursive: true, force: true });
  }

  // Ensure directory
  await ensureDir(skillsDir);

  // Download
  const zipBuffer = await api.downloadSkill(slug);

  // Extract
  await extractZip(zipBuffer, targetDir);

  // Verify
  const skillMd = path.join(targetDir, 'SKILL.md');
  if (!(await exists(skillMd))) {
    await fs.rm(targetDir, { recursive: true, force: true });
    throw new Error('Invalid skill: missing SKILL.md');
  }

  return targetDir;
}

/**
 * Extract zip to directory
 */
async function extractZip(zipBuffer: Buffer, targetDir: string): Promise<void> {
  await ensureDir(targetDir);

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  // Check for single root directory
  const roots = new Set<string>();
  for (const entry of entries) {
    const parts = entry.entryName.split('/');
    if (parts.length > 1 && parts[0]) {
      roots.add(parts[0]);
    }
  }

  const stripPrefix = roots.size === 1 ? [...roots][0] + '/' : '';

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    let entryPath = entry.entryName;
    if (stripPrefix && entryPath.startsWith(stripPrefix)) {
      entryPath = entryPath.slice(stripPrefix.length);
    }
    if (!entryPath) continue;

    const fullPath = path.join(targetDir, entryPath);
    await ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, entry.getData());
  }
}

/**
 * Uninstall a skill
 */
export async function uninstallSkill(slug: string): Promise<boolean> {
  const skillPath = await findInstalledSkill(slug);
  if (!skillPath) {
    vscode.window.showWarningMessage(`"${slug}" is not installed.`);
    return false;
  }

  const choice = await vscode.window.showWarningMessage(
    `Uninstall "${slug}"?`,
    'Yes', 'No'
  );

  if (choice !== 'Yes') return false;

  await fs.rm(skillPath, { recursive: true, force: true });
  return true;
}

/**
 * Parse SKILL.md to get metadata
 */
export async function parseSkillMd(skillPath: string): Promise<InstalledSkillInfo | null> {
  const skillMd = path.join(skillPath, 'SKILL.md');

  if (!(await exists(skillMd))) return null;

  try {
    const content = await fs.readFile(skillMd, 'utf-8');
    const slug = path.basename(skillPath);

    let name = slug;
    let description = '';
    let version: string | undefined;

    // Parse YAML frontmatter
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
      const fm = match[1];
      const nameMatch = fm.match(/^name:\s*['"]?(.+?)['"]?\s*$/m);
      if (nameMatch) name = nameMatch[1];

      const descMatch = fm.match(/^description:\s*['"]?(.+?)['"]?\s*$/m);
      if (descMatch) description = descMatch[1];

      const verMatch = fm.match(/^version:\s*['"]?(.+?)['"]?\s*$/m);
      if (verMatch) version = verMatch[1];
    }

    return { slug, name, description, version, path: skillPath };
  } catch {
    return null;
  }
}

/**
 * Get info for all installed skills
 */
export async function getInstalledSkills(): Promise<InstalledSkillInfo[]> {
  const { listInstalledSkills } = await import('../utils/paths');
  const installed = await listInstalledSkills();
  const skills: InstalledSkillInfo[] = [];

  for (const { slug, path: skillPath } of installed) {
    const info = await parseSkillMd(skillPath);
    if (info) {
      skills.push(info);
    } else {
      skills.push({ slug, name: slug, description: '', path: skillPath });
    }
  }

  return skills;
}
