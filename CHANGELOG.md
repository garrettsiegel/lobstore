# Changelog

## [0.1.0] - 2026-01-29

### Added
- Initial release of Lobstore Skills
- Browse 1500+ skills from moltbot/skills repository
- Organized by categories (Web3, Payments, Productivity, AI & ML, Frontend, Backend, DevOps, Testing, Security, Data)
- Click skills to preview SKILL.md content instantly
- One-click download to workspace `.github/skills/`
- View and manage installed skills in dedicated tab
- Uninstall skills with confirmation
- Reveal skill folders in Finder/Explorer
- Open skills in browser on GitHub
- Search functionality across all skills
- Automatic daily updates via GitHub Actions (no extension republish needed)
- 24-hour local cache with URL-based fetching
- Offline-ready with bundled skills data
- No GitHub API rate limits (uses pre-built data file)
- Professional lobster icon 🦞

### Technical
- Built with TypeScript
- Uses VS Code TreeView API for skill browsing
- Downloads via raw.githubusercontent.com (no rate limits)
- Multi-location skill discovery (workspace, home, etc.)
- Proper error handling and user feedback

