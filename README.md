# 🦞 Lobstore Skills

A VS Code extension that allows you to browse, preview, and download AI agent skills from [ClawdHub](https://clawdhub.com).

Similar to [Awesome Copilot](https://marketplace.visualstudio.com/items?itemName=TimHeuer.awesome-copilot), but pulls from the ClawdHub skills registry instead.

## Features

- **🔍 Browse**: Explore skills in a convenient tree view
- **📖 Preview**: View SKILL.md content before downloading
- **⬇️ Download**: Save skills to `~/.copilot/skills/` for GitHub Copilot
- **🔃 Refresh**: Update data with manual refresh
- **💾 Caching**: Smart caching for better performance

## How to Use

1. **Open the Extension**: Click the 🦞 Lobstore icon in the Activity Bar
2. **Browse Skills**: Expand categories or use search to find skills
3. **Preview Content**: Click the preview icon (👁️) on any skill to see its SKILL.md
4. **Download Skills**: Click the download icon (⬇️) to install to your system
5. **Refresh Data**: Click the refresh icon to update from ClawdHub

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
- Internet connection to fetch from ClawdHub
- GitHub Copilot (optional, but recommended)

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `lobstore.skillsDirectory` | `~/.copilot/skills` | Where to install skills |
| `lobstore.registryUrl` | `https://clawdhub.com` | ClawdHub registry URL |

## Commands

| Command | Description |
|---------|-------------|
| `Lobstore: Refresh` | Update skills from ClawdHub |
| `Lobstore: Search` | Search for skills |
| `Lobstore: Preview` | Preview a skill's SKILL.md |
| `Lobstore: Download` | Install a skill |
| `Lobstore: Uninstall` | Remove an installed skill |

## What are Skills?

Skills are instruction sets that teach AI assistants how to perform specialized tasks. Each skill contains:

- **SKILL.md**: Instructions the AI follows
- **Scripts**: Optional automation helpers
- **References**: Documentation the AI can reference
- **Examples**: Sample code or outputs

When you ask Copilot something relevant to a skill, it automatically loads those instructions.

**Example:** Install the `frontend-design` skill, then ask Copilot "build me a dashboard" - it will follow the skill's design guidelines.

## Development

```bash
npm install
npm run compile
# Press F5 to test in Extension Development Host
```

## Credits

- [ClawdHub](https://clawdhub.com) - The skills registry
- [Awesome Copilot](https://github.com/github/awesome-copilot) - Inspiration for the UI pattern
- [AgentSkills](https://agentskills.io) - The open standard

## License

MIT

---

*This extension is not affiliated with ClawdHub, GitHub, or Anthropic.*
