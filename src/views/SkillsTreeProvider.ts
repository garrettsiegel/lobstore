/**
 * Skills Tree Provider
 * Browse skills from ClawdHub - similar to Awesome Copilot's UI
 */

import * as vscode from 'vscode';
import { getAPI, Skill } from '../api/clawdhub';

type TreeItem = CategoryItem | SkillItem | MessageItem;

export class SkillsTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private skills: Skill[] = [];
  private isLoading = false;
  private error: string | null = null;
  private searchQuery: string | null = null;
  private groupByCategory = true;

  constructor() {
    this.loadSkills();
  }

  refresh(): void {
    const api = getAPI();
    api.clearCache();
    this.loadSkills();
  }

  async loadSkills(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    this.searchQuery = null;
    this._onDidChangeTreeData.fire(undefined);

    try {
      const api = getAPI();
      this.skills = await api.getAllSkills();
    } catch (e: any) {
      this.error = e.message || 'Failed to load skills';
      this.skills = [];
    }

    this.isLoading = false;
    this._onDidChangeTreeData.fire(undefined);
  }

  async search(query: string): Promise<void> {
    if (!query.trim()) {
      this.loadSkills();
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.searchQuery = query;
    this._onDidChangeTreeData.fire(undefined);

    try {
      const api = getAPI();
      this.skills = await api.search(query);
    } catch (e: any) {
      this.error = e.message || 'Search failed';
      this.skills = [];
    }

    this.isLoading = false;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    // Loading state
    if (this.isLoading) {
      return [new MessageItem('Loading...', 'loading~spin')];
    }

    // Error state
    if (this.error) {
      return [new MessageItem(`Error: ${this.error}`, 'error')];
    }

    // Empty state
    if (this.skills.length === 0) {
      const msg = this.searchQuery
        ? `No skills found for "${this.searchQuery}"`
        : 'No skills available';
      return [new MessageItem(msg, 'info')];
    }

    // If expanding a category, return its skills
    if (element instanceof CategoryItem) {
      return element.skills.map(s => new SkillItem(s));
    }

    // Root level
    if (this.searchQuery || !this.groupByCategory) {
      // Flat list for search results
      return this.skills.map(s => new SkillItem(s));
    }

    // Group by category
    const categories = new Map<string, Skill[]>();
    for (const skill of this.skills) {
      const cat = skill.category || 'Uncategorized';
      if (!categories.has(cat)) {
        categories.set(cat, []);
      }
      categories.get(cat)!.push(skill);
    }

    // If all uncategorized, show flat
    if (categories.size === 1 && categories.has('Uncategorized')) {
      return this.skills.map(s => new SkillItem(s));
    }

    // Return category items
    return Array.from(categories.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, skills]) => new CategoryItem(name, skills));
  }
}

/**
 * Category item (collapsible)
 */
class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly categoryName: string,
    public readonly skills: Skill[]
  ) {
    super(categoryName, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = `${skills.length} skills`;
    this.iconPath = new vscode.ThemeIcon('folder');
    this.contextValue = 'category';
  }
}

/**
 * Skill item with preview and download icons
 */
export class SkillItem extends vscode.TreeItem {
  constructor(public readonly skill: Skill) {
    super(skill.name, vscode.TreeItemCollapsibleState.None);

    this.description = skill.version ? `v${skill.version}` : '';
    this.tooltip = this.createTooltip();
    this.contextValue = 'skill';
    this.iconPath = new vscode.ThemeIcon('symbol-method');
  }

  private createTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`### ${this.skill.name}\n\n`);
    md.appendMarkdown(this.skill.description + '\n\n');

    if (this.skill.author) {
      md.appendMarkdown(`**Author:** ${this.skill.author}\n`);
    }
    if (this.skill.downloads) {
      md.appendMarkdown(`**Downloads:** ${this.skill.downloads.toLocaleString()}\n`);
    }
    if (this.skill.tags?.length) {
      md.appendMarkdown(`**Tags:** ${this.skill.tags.join(', ')}\n`);
    }

    md.appendMarkdown('\n---\n*Click preview to see SKILL.md, click download to install*');
    return md;
  }
}

/**
 * Message item (loading, error, empty)
 */
class MessageItem extends vscode.TreeItem {
  constructor(message: string, icon: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}
