/**
 * Installed Skills Tree Provider
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getInstalledSkills, InstalledSkillInfo } from '../services/installer';

type TreeItem = InstalledSkillItem | MessageItem;

export class InstalledTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private skills: InstalledSkillInfo[] = [];
  private isLoading = false;

  constructor() {
    this.refresh();
  }

  async refresh(): Promise<void> {
    this.isLoading = true;
    this._onDidChangeTreeData.fire(undefined);

    try {
      this.skills = await getInstalledSkills();
    } catch {
      this.skills = [];
    }

    this.isLoading = false;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): TreeItem[] {
    if (this.isLoading) {
      return [new MessageItem('Loading...', 'loading~spin')];
    }

    if (this.skills.length === 0) {
      return [new MessageItem('No skills installed', 'info')];
    }

    return this.skills.map(s => new InstalledSkillItem(s));
  }
}

/**
 * Installed skill item
 */
export class InstalledSkillItem extends vscode.TreeItem {
  constructor(public readonly skill: InstalledSkillInfo) {
    super(skill.name, vscode.TreeItemCollapsibleState.None);

    // Show path abbreviated
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const displayPath = skill.path.startsWith(home)
      ? '~' + skill.path.slice(home.length)
      : skill.path;

    this.description = displayPath;
    this.tooltip = this.createTooltip();
    this.contextValue = 'installedSkill';
    this.iconPath = new vscode.ThemeIcon('symbol-method');
    this.resourceUri = vscode.Uri.file(skill.path);
  }

  private createTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`### ${this.skill.name}\n\n`);

    if (this.skill.description) {
      md.appendMarkdown(this.skill.description + '\n\n');
    }

    md.appendMarkdown(`**Path:** \`${this.skill.path}\`\n`);

    if (this.skill.version) {
      md.appendMarkdown(`**Version:** ${this.skill.version}\n`);
    }

    return md;
  }
}

/**
 * Message item
 */
class MessageItem extends vscode.TreeItem {
  constructor(message: string, icon: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}
