/**
 * Skill Installer Service
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { getAPI } from '../api/clawdhub';
import { getSkillsDirectory, ensureDir, exists, findInstalledSkill } from '../utils/paths';
import { scanSkillContent, formatIssuesForDisplay, SecurityScanResult } from './security-scanner';

export interface InstalledSkillInfo {
  slug: string;
  name: string;
  description: string;
  version?: string;
  path: string;
  securityScore?: number;
}

export interface InstallOptions {
  force?: boolean;
  bypassSecurity?: boolean;
}

/**
 * Download and install a skill with security scanning
 */
export async function installSkill(slug: string, options: InstallOptions = {}): Promise<string> {
  const { force = false, bypassSecurity = false } = options;
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

  // Extract to temp location first for security scanning
  const tempDir = path.join(skillsDir, `.temp-${skillName}-${Date.now()}`);
  await extractZip(zipBuffer, tempDir);

  // Find and scan SKILL.md
  const skillMdPath = path.join(tempDir, 'SKILL.md');
  if (!(await exists(skillMdPath))) {
    await fs.rm(tempDir, { recursive: true, force: true });
    throw new Error('Invalid skill: missing SKILL.md');
  }

  const skillContent = await fs.readFile(skillMdPath, 'utf-8');
  const scanResult = scanSkillContent(skillContent, 'SKILL.md');

  // Handle security scan results
  if (!scanResult.safe && !bypassSecurity) {
    // Show security report
    const reportMd = formatIssuesForDisplay(scanResult);
    
    // Create temp file for security report
    const os = await import('os');
    const reportPath = path.join(os.tmpdir(), `security-report-${skillName}.md`);
    await fs.writeFile(reportPath, reportMd, 'utf-8');
    
    // Show report in editor
    const reportUri = vscode.Uri.file(reportPath);
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(reportUri), { preview: true });

    // Clean up temp extraction
    await fs.rm(tempDir, { recursive: true, force: true });

    // Show blocking message with options
    const choice = await vscode.window.showErrorMessage(
      `⛔ Security scan blocked "${slug}" (Score: ${scanResult.score}/100). ${scanResult.issues.length} issue(s) found.`,
      { modal: true },
      'View Report',
      'Force Install (Risky)',
      'Cancel'
    );

    if (choice === 'Force Install (Risky)') {
      // Confirm force install
      const confirm = await vscode.window.showWarningMessage(
        `⚠️ Are you sure you want to install "${slug}" despite security warnings? This could be dangerous.`,
        { modal: true },
        'Yes, I understand the risks',
        'Cancel'
      );

      if (confirm === 'Yes, I understand the risks') {
        return installSkill(slug, { force: true, bypassSecurity: true });
      }
    }

    throw new Error('Installation blocked due to security concerns');
  }

  // Show warning for non-critical issues
  if (scanResult.issues.length > 0 && scanResult.safe) {
    const warningChoice = await vscode.window.showWarningMessage(
      `⚠️ "${slug}" has ${scanResult.issues.length} minor security notice(s) (Score: ${scanResult.score}/100). Continue?`,
      'Install Anyway',
      'View Details',
      'Cancel'
    );

    if (warningChoice === 'View Details') {
      const reportMd = formatIssuesForDisplay(scanResult);
      const os = await import('os');
      const reportPath = path.join(os.tmpdir(), `security-report-${skillName}.md`);
      await fs.writeFile(reportPath, reportMd, 'utf-8');
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(reportPath)), { preview: true });
      
      // Clean up and cancel
      await fs.rm(tempDir, { recursive: true, force: true });
      throw new Error('Cancelled');
    } else if (warningChoice !== 'Install Anyway') {
      await fs.rm(tempDir, { recursive: true, force: true });
      throw new Error('Cancelled');
    }
  }

  // Move from temp to final location
  if (await exists(targetDir)) {
    await fs.rm(targetDir, { recursive: true, force: true });
  }
  await fs.rename(tempDir, targetDir);

  // Save security score metadata
  const metadataPath = path.join(targetDir, '.security-scan.json');
  await fs.writeFile(metadataPath, JSON.stringify({
    scanDate: new Date().toISOString(),
    score: scanResult.score,
    issueCount: scanResult.issues.length,
    safe: scanResult.safe
  }, null, 2), 'utf-8');

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
