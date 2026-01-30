# 🦞 Lobstore Skills

A VS Code extension that allows you to browse, preview, and download AI agent skills from [MoltHub](https://github.com/moltbot/skills).

Similar to [Awesome Copilot](https://marketplace.visualstudio.com/items?itemName=TimHeuer.awesome-copilot), but pulls from the moltbot/skills GitHub repository instead.

## Features

- **⚡ Instant Loading**: Skills data bundled with the extension for zero-latency browsing
- **🔍 Browse**: Explore skills in a convenient tree view grouped by category
- **📖 Preview**: View SKILL.md content before downloading
- **⬇️ Download**: Save skills to `~/.copilot/skills/` for GitHub Copilot
- **🔃 Auto-Update**: GitHub Action refreshes skills daily (no user action needed)
- **💾 Offline-Ready**: Browse skills even without internet

## How It Works

**Data Source**: The extension loads skill metadata from a pre-built JSON file that is updated daily by a GitHub Action. This avoids GitHub API rate limits and provides instant loading.

**Updates**: The skill catalog is automatically refreshed every day at 6am UTC via GitHub Actions workflow. Extension users get the latest skills when they update the extension.

## How to Use

1. **Open the Extension**: Click the 🦞 Lobstore icon in the Activity Bar
2. **Browse Skills**: Expand categories to see available skills (loads instantly!)
3. **Preview Content**: Click the preview icon (👁️) on any skill to see its SKILL.md
4. **Download Skills**: Click the download icon (⬇️) to install to your system
5. **Manage Installed**: View and uninstall skills from the "Installed" tab

## Folder Structure

Downloaded skills are installed to:

```
~/.copilot/skills/
└── skill-name/
    ├── SKILL.md          ← Main skill file (Copilot reads this)
    ├── scripts/          ← Optional helper scripts
    ├── references/       ← Optional reference docs
    └── examples/         ← Optional examples
```

GitHub Copilot automatically detects and uses skills from this location when you have `chat.useAgentSkills` enabled.

## Compatibility

Skills from ClawdHub work with:

| Tool | Location |
|------|----------|
| GitHub Copilot | `~/.copilot/skills/` |
| Claude Code | `~/.claude/skills/` |
| Codex | `~/.codex/skills/` |
| Moltbot/Clawdbot | `~/.clawdbot/skills/` |

All these tools use the same [AgentSkills](https://agentskills.io) open standard.

## Requirements

- VS Code 1.85.0 or higher
- GitHub Copilot (optional, but recommended for using the skills)

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `lobstore.skillsDirectory` | `~/.copilot/skills` | Where to install skills |
| `lobstore.registryUrl` | `https://api.github.com/repos/moltbot/skills` | Skills repository URL |

## Commands

| Command | Description |
|---------|-------------|
| `Lobstore: Refresh` | Reload skills list from bundled data |
| `Lobstore: Search` | Search for skills |
| `Lobstore: Preview` | Preview a skill's SKILL.md |
| `Lobstore: Download` | Install a skill |
| `Lobstore: Uninstall` | Remove an installed skill |
| `Lobstore: Open in Browser` | View skill on GitHub |
| `Lobstore: Reveal in Finder` | Show installed skill in file manager |

## Architecture

### Data Pipeline

```
GitHub Repo (moltbot/skills)
       ↓
GitHub Actions (daily cron @ 6am UTC)
       ↓
scripts/fetch-skills.js (fetch all skills)
       ↓
data/skills.json (bundled with extension)
       ↓
VS Code Extension (instant load)
```

### No Rate Limits

By pre-fetching and bundling skills data, we avoid:
- ❌ GitHub API rate limits (60 req/hour unauthenticated)
- ❌ Slow initial load times
- ❌ Network dependency for browsing

### Updating Skills Data

The extension data is updated automatically by:
1. GitHub Action runs daily (`.github/workflows/sync-skills.yml`)
2. Fetches all skills from moltbot/skills repo
3. Generates `data/skills.json` with full catalog
4. Commits back to repo
5. Next extension build includes updated data

## What are Skills?

Skills are instruction sets that teach AI assistants how to perform specialized tasks. Each skill contains:

- **SKILL.md**: Instructions the AI follows
- **Scripts**: Optional automation helpers
- **References**: Documentation the AI can reference
- **Examples**: Sample code or outputs

When you ask Copilot something relevant to a skill, it automatically loads those instructions.

**Example:** Install the `frontend-design` skill, then ask Copilot "build me a dashboard" - it will follow the skill's design guidelines.

## Development

### Setup

```bash
npm install
npm run compile
npm run copy-data
```

### Testing

Press `F5` to launch Extension Development Host

### Manual Data Refresh

To manually update skills data (for development):

```bash
node scripts/fetch-skills.js
npm run compile && npm run copy-data
```

### Project Structure

```
lobstore-skills/
├── .github/
│   └── workflows/
│       └── sync-skills.yml    ← Daily auto-update workflow
├── src/
│   ├── extension.ts            ← Main entry point
│   ├── api/clawdhub.ts         ← Loads skills from JSON
│   ├── services/installer.ts   ← Downloads and installs skills
│   ├── views/                  ← Tree view providers
│   └── utils/                  ← Path utilities
├── scripts/
│   └── fetch-skills.js         ← Fetches from GitHub API
├── data/
│   └── skills.json             ← Pre-built skills catalog (144 skills)
└── dist/                       ← Compiled output
```

## Credits

- [moltbot/skills](https://github.com/moltbot/skills) - The skills repository
- [Awesome Copilot](https://github.com/github/awesome-copilot) - Inspiration for the UI pattern
- [AgentSkills](https://agentskills.io) - The open standard

---

**Note**: This is an unofficial extension. It is not affiliated with GitHub, Microsoft, or Anthropic.

## License

MIT

---

*This extension is not affiliated with ClawdHub, GitHub, or Anthropic.*
