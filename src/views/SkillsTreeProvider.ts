/**
 * Skills Tree Provider
 * Browse skills from ClawdHub - similar to Awesome Copilot's UI
 */

import * as vscode from 'vscode';
import { getAPI, Skill } from '../api/clawdhub';

type TreeItem = CategoryItem | SkillItem | MessageItem | FilterItem;

export class SkillsTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private allSkills: Skill[] = [];
  private skills: Skill[] = [];
  private isLoading = false;
  private error: string | null = null;
  private searchQuery: string | null = null;
  private groupByCategory = true;
  private categoryFilter: string | null = null;
  private integrationFilter: string | null = null;

  constructor() {
    this.loadSkills();
  }

  refresh(): void {
    const api = getAPI();
    api.clearCache();
    this.categoryFilter = null;
    this.integrationFilter = null;
    this.loadSkills();
  }

  async loadSkills(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    this.searchQuery = null;
    this._onDidChangeTreeData.fire(undefined);

    try {
      const api = getAPI();
      this.allSkills = await api.getAllSkills();
      this.applyFilters();
    } catch (e: any) {
      this.error = e.message || 'Failed to load skills';
      this.allSkills = [];
      this.skills = [];
    }

    this.isLoading = false;
    this._onDidChangeTreeData.fire(undefined);
  }

  private applyFilters(): void {
    let filtered = this.allSkills;
    
    if (this.categoryFilter) {
      filtered = filtered.filter(s => (s.category || 'Other') === this.categoryFilter);
    }
    
    if (this.integrationFilter) {
      filtered = filtered.filter(s => s.integration === this.integrationFilter);
    }
    
    this.skills = filtered;
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

  getCategories(): string[] {
    const categories = new Set<string>();
    for (const skill of this.allSkills) {
      categories.add(skill.category || 'Other');
    }
    return Array.from(categories).sort();
  }

  getIntegrations(): string[] {
    const integrations = new Set<string>();
    for (const skill of this.allSkills) {
      if (skill.integration) {
        integrations.add(skill.integration);
      }
    }
    return Array.from(integrations).sort();
  }

  filterByCategory(category: string | null): void {
    this.categoryFilter = category;
    this.searchQuery = null;
    this.applyFilters();
    this._onDidChangeTreeData.fire(undefined);
  }

  filterByIntegration(integration: string | null): void {
    this.integrationFilter = integration;
    this.searchQuery = null;
    this.applyFilters();
    this._onDidChangeTreeData.fire(undefined);
  }

  clearFilters(): void {
    this.categoryFilter = null;
    this.integrationFilter = null;
    this.searchQuery = null;
    this.applyFilters();
    this._onDidChangeTreeData.fire(undefined);
  }

  hasActiveFilters(): boolean {
    return !!(this.categoryFilter || this.integrationFilter || this.searchQuery);
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
      .sort(([a], [b]) => {
        // Sort 'Other' to the end
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
      })
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
    this.description = `${skills.length} skill${skills.length === 1 ? '' : 's'}`;
    this.iconPath = new vscode.ThemeIcon('folder');
    this.contextValue = 'category';
  }
}

/**
 * Skill item that behaves like a clickable markdown file
 */
export class SkillItem extends vscode.TreeItem {
  constructor(public readonly skill: Skill) {
    super(skill.name, vscode.TreeItemCollapsibleState.None);

    this.label = `${skill.name}.skill.md`;
    this.description = this.createDescription();
    this.tooltip = this.createTooltip();
    this.contextValue = 'skill';
    this.iconPath = new vscode.ThemeIcon('markdown');
    
    this.command = {
      command: 'lobstore.preview',
      title: 'Preview Skill',
      arguments: [this]
    };
  }

  private createDescription(): string {
    const parts: string[] = [];
    
    // Stats badges (ClawHub style)
    if (this.skill.downloads) {
      parts.push(`⤓${this.formatNumber(this.skill.downloads)}`);
    }
    if (this.skill.stars) {
      parts.push(`⭐${this.formatNumber(this.skill.stars)}`);
    }
    if (this.skill.pushes) {
      parts.push(`⤒${this.skill.pushes}`);
    }
    
    // Version with update indicator
    if (this.skill.version) {
      const versionText = this.skill.latestVersion && this.skill.version !== this.skill.latestVersion
        ? `v${this.skill.version}→${this.skill.latestVersion}`
        : `v${this.skill.version}`;
      parts.push(versionText);
    }
    
    // Truncated description if no stats
    if (parts.length === 0 && this.skill.description) {
      return this.skill.description.length > 50 
        ? this.skill.description.slice(0, 47) + '...'
        : this.skill.description;
    }
    
    return parts.join(' · ');
  }

  private formatNumber(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  private createTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`### ${this.skill.name}\n\n`);
    
    if (this.skill.description) {
      md.appendMarkdown(this.skill.description + '\n\n');
    }

    // Stats section
    const stats: string[] = [];
    if (this.skill.downloads) stats.push(`⤓ ${this.skill.downloads.toLocaleString()} downloads`);
    if (this.skill.stars) stats.push(`⭐ ${this.skill.stars.toLocaleString()} stars`);
    if (this.skill.pushes) stats.push(`⤒ ${this.skill.pushes} pushes`);
    if (stats.length > 0) {
      md.appendMarkdown(`**Stats:** ${stats.join(' · ')}\n\n`);
    }

    // Version info
    if (this.skill.version) {
      const hasUpdate = this.skill.latestVersion && this.skill.version !== this.skill.latestVersion;
      if (hasUpdate) {
        md.appendMarkdown(`**Version:** ${this.skill.version} → **${this.skill.latestVersion}** (update available)\n\n`);
      } else {
        md.appendMarkdown(`**Version:** ${this.skill.version}\n\n`);
      }
    }

    // Author
    if (this.skill.author) {
      md.appendMarkdown(`**Author:** ${this.skill.author}\n\n`);
    }

    // Platform support
    if (this.skill.platforms?.length) {
      const platformIcons: Record<string, string> = {
        macos: '🍎',
        windows: '🪟',
        linux: '🐧'
      };
      const platformBadges = this.skill.platforms
        .map(p => `${platformIcons[p] || ''} ${p}`)
        .join(' · ');
      md.appendMarkdown(`**Platforms:** ${platformBadges}\n\n`);
    }

    // Dependencies section
    const deps: string[] = [];
    if (this.skill.requiredBins?.length) {
      deps.push(`**Required CLIs:** \`${this.skill.requiredBins.join('`, `')}\``);
    }
    if (this.skill.requiredEnv?.length) {
      deps.push(`**Required Env Vars:** \`${this.skill.requiredEnv.join('`, `')}\``);
    }
    if (deps.length > 0) {
      md.appendMarkdown('---\n#### Dependencies\n' + deps.join('\n') + '\n\n');
    }

    // Compatibility
    if (this.skill.compatibility) {
      md.appendMarkdown(`**Compatibility:** ${this.skill.compatibility}\n\n`);
    }

    // License
    if (this.skill.license) {
      md.appendMarkdown(`**License:** ${this.skill.license}\n\n`);
    }

    // Tags
    if (this.skill.tags?.length) {
      md.appendMarkdown(`**Tags:** ${this.skill.tags.join(', ')}\n\n`);
    }

    // Integration type badge
    if (this.skill.integration) {
      md.appendMarkdown(`**Integration:** 🔗 ${this.skill.integration}\n\n`);
    }

    md.appendMarkdown('---\n*Click to preview · Right-click to download*');
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

/**
 * Filter indicator item (shows active filters)
 */
class FilterItem extends vscode.TreeItem {
  constructor(filterType: string, filterValue: string) {
    super(`${filterType}: ${filterValue}`, vscode.TreeItemCollapsibleState.None);
    this.description = '(click to clear)';
    this.iconPath = new vscode.ThemeIcon('filter-filled');
    this.contextValue = 'filter';
    this.command = {
      command: 'lobstore.clearFilters',
      title: 'Clear Filters'
    };
  }
}
