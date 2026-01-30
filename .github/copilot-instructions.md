# Lobstore Skills - VS Code Extension

## Architecture Overview

This is a VS Code extension for browsing and installing AI agent skills from ClawdHub. It follows the standard VS Code extension architecture:

- **Entry point**: [src/extension.ts](../src/extension.ts) - registers commands, tree views, and providers
- **API layer**: [src/api/clawdhub.ts](../src/api/clawdhub.ts) - fetches from ClawdHub registry with 5-minute caching
- **Service layer**: [src/services/installer.ts](../src/services/installer.ts) - handles skill download/installation/uninstallation
- **View layer**: [src/views/](../src/views/) - two TreeDataProviders for browsing and installed skills
- **Utilities**: [src/utils/paths.ts](../src/utils/paths.ts) - manages skill directory locations

## Key Patterns

### TreeDataProvider Pattern
Both tree views (`SkillsTreeProvider`, `InstalledTreeProvider`) follow the same state management pattern:
- Use `EventEmitter<TreeItem | undefined>` for refresh
- Handle loading/error/empty states via `MessageItem` nodes
- Display skills grouped by category (browse view) or flat list (installed view)

Example:
```typescript
// Always fire change event to trigger re-render
this._onDidChangeTreeData.fire(undefined);
```

### Command Registration
All commands are registered in `extension.ts` using the `lobstore.*` namespace:
```typescript
vscode.commands.registerCommand('lobstore.refresh', () => {
  skillsProvider.refresh();
  installedProvider.refresh();
});
```

### Virtual Document Preview
Preview uses a virtual document provider pattern to show SKILL.md content:
```typescript
const uri = vscode.Uri.parse(`lobstore-preview:${slug}.md`);
// Content stored in Map<slug, content>
```

### Multi-Location Skill Discovery
The extension checks multiple directories for installed skills (see `getAllSkillDirectories()`):
- `~/.copilot/skills` (primary)
- `~/.claude/skills`
- `~/.clawdbot/skills`

This enables cross-tool compatibility with the AgentSkills standard.

## Build & Development

```bash
# Compile TypeScript
npm run compile

# Watch mode (auto-recompile on changes)
npm run watch

# Test in Extension Development Host
# Press F5 in VS Code
```

**Important**: The extension activates when the `lobstoreSkills` view is opened (see `activationEvents` in [package.json](../package.json)).

## API Integration

GitHub API endpoints used:
- `GET /repos/moltbot/skills/contents/skills` - list all user directories
- `GET /repos/moltbot/skills/contents/skills/{user}` - list skills for each user
- `GET https://raw.githubusercontent.com/moltbot/skills/main/skills/{user}/{skill}/SKILL.md` - get skill content

**Performance optimizations**:
- Limits to first 50 users to avoid rate limiting
- Fetches in parallel batches of 10
- 5-minute cache TTL to reduce API calls

## Installation Flow

1. User clicks download → `installSkill(slug)` called
2. Check if already installed (prompt to overwrite)
3. Download zip from API (`downloadSkill()`)
4. Extract using `adm-zip` - auto-strips single-root-directory zips
5. Verify `SKILL.md` exists (fails if missing)
6. Install to `~/.copilot/skills/{slug}/`

## Configuration

Extension settings (defined in [package.json](../package.json) contributions):
- `lobstore.skillsDirectory` - custom install location (default: `~/.copilot/skills`)
- `lobstore.registryUrl` - ClawdHub URL (default: `https://clawdhub.com`)

## File Structure Conventions

- All source in `src/`, compiled to `dist/`
- Group by layer: `api/`, `services/`, `views/`, `utils/`
- Type definitions in `src/types/` (e.g., `adm-zip.d.ts` for third-party types)
- No test files currently (empty pattern: `**/*.test.ts`)

## Common Tasks

**Add a new command:**
1. Add to `package.json` → `contributes.commands[]`
2. Register in `extension.ts` → `context.subscriptions.push(...)`
3. If tree-item specific, add `contextValue` check in menu contributions

**Add API method:**
1. Define interface in `clawdhub.ts` (export type)
2. Implement method in `ClawdHubAPI` class
3. Use `fetchWithCache()` for GET requests that should cache

**Add tree view state:**
1. Add property to provider class (e.g., `private searchQuery: string | null`)
2. Fire change event after updating: `this._onDidChangeTreeData.fire(undefined)`
3. Check state in `getChildren()` to conditionally render nodes

## Dependencies

- `vscode` - VS Code API
- `adm-zip` - zip extraction (includes custom type definitions in `src/types/`)
- TypeScript compiled to CommonJS (ES2022 target)

## Key Files to Know

- [src/extension.ts](../src/extension.ts) - Command registration and activation logic
- [src/views/SkillsTreeProvider.ts](../src/views/SkillsTreeProvider.ts) - Browse skills UI (with category grouping)
- [src/services/installer.ts](../src/services/installer.ts) - Skill installation + file operations
- [src/utils/paths.ts](../src/utils/paths.ts) - Cross-platform path resolution (supports `~` expansion)
