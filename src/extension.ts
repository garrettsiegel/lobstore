/**
 * Lobstore Skills Extension
 * Browse and download AI skills from ClawdHub
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { SkillsTreeProvider, SkillItem } from './views/SkillsTreeProvider';
import { InstalledTreeProvider, InstalledSkillItem } from './views/InstalledTreeProvider';
import { installSkill, uninstallSkill } from './services/installer';
import { getAPI, SkillDetail } from './api/clawdhub';
import { getSkillsDirectory } from './utils/paths';

export function activate(context: vscode.ExtensionContext) {
  console.log('Lobstore Skills is now active');

  try {
    // Create providers
    console.log('Creating SkillsTreeProvider...');
    const skillsProvider = new SkillsTreeProvider();
    console.log('Creating InstalledTreeProvider...');
    const installedProvider = new InstalledTreeProvider();

    // Register tree views
    console.log('Registering tree views...');
    const skillsView = vscode.window.createTreeView('lobstoreSkills', {
      treeDataProvider: skillsProvider,
      showCollapseAll: true,
    });

    const installedView = vscode.window.createTreeView('lobstoreInstalled', {
      treeDataProvider: installedProvider,
    });
    console.log('Tree views registered successfully');

    // ============================================
    // Refresh command
    // ============================================
    context.subscriptions.push(
      vscode.commands.registerCommand('lobstore.refresh', () => {
        skillsProvider.refresh();
        installedProvider.refresh();
      })
    );

  // ============================================
  // Search command
  // ============================================
  context.subscriptions.push(
    vscode.commands.registerCommand('lobstore.search', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search ClawdHub skills',
        placeHolder: 'e.g., "frontend", "kubernetes", "testing"',
      });

      if (query !== undefined) {
        await skillsProvider.search(query);
      }
    })
  );

  // ============================================
  // Filter by Category command
  // ============================================
  context.subscriptions.push(
    vscode.commands.registerCommand('lobstore.filterByCategory', async () => {
      const categories = skillsProvider.getCategories();
      
      if (categories.length === 0) {
        vscode.window.showInformationMessage('No categories available');
        return;
      }

      const items = [
        { label: '$(clear-all) Show All', category: null },
        ...categories.map(c => ({ label: `$(folder) ${c}`, category: c }))
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Filter skills by category',
        title: 'Select Category'
      });

      if (selected) {
        skillsProvider.filterByCategory(selected.category);
      }
    })
  );

  // ============================================
  // Filter by Integration command
  // ============================================
  context.subscriptions.push(
    vscode.commands.registerCommand('lobstore.filterByIntegration', async () => {
      const integrations = skillsProvider.getIntegrations();
      
      if (integrations.length === 0) {
        vscode.window.showInformationMessage('No integrations detected in skills');
        return;
      }

      const integrationIcons: Record<string, string> = {
        telegram: '📱',
        discord: '💬',
        slack: '💼',
        twitter: '🐦',
        github: '🐙',
        jira: '📋',
        notion: '📝',
        linear: '📊',
        stripe: '💳',
        openai: '🤖',
        anthropic: '🧠',
      };

      const items = [
        { label: '$(clear-all) Show All', integration: null },
        ...integrations.map(i => ({
          label: `${integrationIcons[i] || '🔗'} ${i.charAt(0).toUpperCase() + i.slice(1)}`,
          integration: i
        }))
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Filter skills by integration type',
        title: 'Select Integration'
      });

      if (selected) {
        skillsProvider.filterByIntegration(selected.integration);
      }
    })
  );

  // ============================================
  // Clear Filters command
  // ============================================
  context.subscriptions.push(
    vscode.commands.registerCommand('lobstore.clearFilters', () => {
      skillsProvider.clearFilters();
      vscode.window.showInformationMessage('Filters cleared');
    })
  );

  // ============================================
  // Preview command - shows SKILL.md content
  // ============================================
  context.subscriptions.push(
    vscode.commands.registerCommand('lobstore.preview', async (item: SkillItem | InstalledSkillItem) => {
      try {
        let content: string;
        let title: string;

        if (item instanceof InstalledSkillItem) {
          // Read local file
          const skillMdPath = path.join(item.skill.path, 'SKILL.md');
          const uri = vscode.Uri.file(skillMdPath);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: true });
          return;
        }

        // Fetch from API
        const api = getAPI();
        const detail = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Loading...' },
          () => api.getSkillDetail(item.skill.slug)
        );

        content = detail.content || '# No content available';
        title = `${detail.name} (SKILL.md)`;

        // Create temp file with proper .md extension for markdown rendering
        const os = await import('os');
        const fs = await import('fs/promises');
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `${item.skill.slug.replace('/', '-')}.SKILL.md`);
        await fs.writeFile(tempFile, content, 'utf-8');
        
        const uri = vscode.Uri.file(tempFile);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: true });

      } catch (e: any) {
        vscode.window.showErrorMessage(`Preview failed: ${e.message}`);
      }
    })
  );

  // Virtual document provider for previews
  const previewContent = new Map<string, string>();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('lobstore-preview', {
      provideTextDocumentContent(uri: vscode.Uri): string {
        const slug = uri.path.replace('.md', '');
        return previewContent.get(slug) || '# Loading...';
      }
    })
  );

  // ============================================
  // Download command - installs to ~/.copilot/skills
  // ============================================
  context.subscriptions.push(
    vscode.commands.registerCommand('lobstore.download', async (item: SkillItem) => {
      if (!item?.skill) {
        vscode.window.showErrorMessage('No skill selected');
        return;
      }

      try {
        const skillPath = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Installing ${item.skill.name}...`,
          },
          () => installSkill(item.skill.slug)
        );

        const relativePath = vscode.workspace.asRelativePath(skillPath);
        const choice = await vscode.window.showInformationMessage(
          `✅ Installed "${item.skill.name}" to ${relativePath}`,
          'Open SKILL.md',
          'Reveal in Finder'
        );

        if (choice === 'Open SKILL.md') {
          const uri = vscode.Uri.file(path.join(skillPath, 'SKILL.md'));
          await vscode.window.showTextDocument(uri);
        } else if (choice === 'Reveal in Finder') {
          await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(skillPath));
        }

        installedProvider.refresh();
      } catch (e: any) {
        if (e.message !== 'Cancelled') {
          vscode.window.showErrorMessage(`Install failed: ${e.message}`);
        }
      }
    })
  );

  // ============================================
  // Uninstall command
  // ============================================
  context.subscriptions.push(
    vscode.commands.registerCommand('lobstore.uninstall', async (item: InstalledSkillItem) => {
      if (!item?.skill) return;

      const success = await uninstallSkill(item.skill.slug);
      if (success) {
        vscode.window.showInformationMessage(`Uninstalled "${item.skill.name}"`);
        installedProvider.refresh();
      }
    })
  );

  // ============================================
  // Open in browser command
  // ============================================
  context.subscriptions.push(
    vscode.commands.registerCommand('lobstore.openInBrowser', async (item: SkillItem) => {
      if (!item?.skill) return;

      const api = getAPI();
      const url = api.getSkillUrl(item.skill.slug);
      await vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );

  // ============================================
  // Reveal in Finder command
  // ============================================
  context.subscriptions.push(
    vscode.commands.registerCommand('lobstore.revealInFinder', async (item: InstalledSkillItem) => {
      if (!item?.skill) return;

      await vscode.commands.executeCommand(
        'revealFileInOS',
        vscode.Uri.file(item.skill.path)
      );
    })
  );

    // Add disposables
    context.subscriptions.push(skillsView, installedView);

    // Welcome message
    const hasShownWelcome = context.globalState.get('lobstore.welcomeShown');
    if (!hasShownWelcome) {
      const skillsDir = getSkillsDirectory();
      vscode.window.showInformationMessage(
        `🦞 Lobstore Skills ready! Skills install to ${skillsDir}`,
        'Configure'
      ).then(choice => {
        if (choice === 'Configure') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'lobstore');
        }
      });
      context.globalState.update('lobstore.welcomeShown', true);
    }
  } catch (error: any) {
    console.error('Lobstore Skills activation failed:', error);
    vscode.window.showErrorMessage(`Lobstore Skills failed to activate: ${error.message}`);
  }
}

export function deactivate() {
  console.log('Lobstore Skills deactivated');
}
