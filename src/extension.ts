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

  // Create providers
  const skillsProvider = new SkillsTreeProvider();
  const installedProvider = new InstalledTreeProvider();

  // Register tree views
  const skillsView = vscode.window.createTreeView('lobstoreSkills', {
    treeDataProvider: skillsProvider,
    showCollapseAll: true,
  });

  const installedView = vscode.window.createTreeView('lobstoreInstalled', {
    treeDataProvider: installedProvider,
  });

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

        // Show in virtual document
        const uri = vscode.Uri.parse(`lobstore-preview:${item.skill.slug}.md`);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: true });

        // Register content provider for this
        previewContent.set(item.skill.slug, content);

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

        const choice = await vscode.window.showInformationMessage(
          `✅ Installed "${item.skill.name}"`,
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
}

export function deactivate() {
  console.log('Lobstore Skills deactivated');
}
