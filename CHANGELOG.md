# Changelog

## [0.2.0] - 2026-01-31

### Added
- **🛡️ Security Scanning**: Automatic security analysis of skills before installation
  - Detects destructive commands (rm -rf, fork bombs)
  - Blocks remote code execution patterns (curl | bash)
  - Warns about credential exfiltration attempts
  - Identifies prompt injection and jailbreak patterns
  - Catches reverse shell and backdoor indicators
  - Flags suspicious file/network access
- **Security Scan Command**: Right-click any skill to run a manual security scan
- **Security Score**: 0-100 rating for each skill based on detected issues
- **Blocking Protection**: Critical security issues prevent installation
- **Force Install Option**: Ability to bypass security for trusted skills (with confirmation)
- **Security Reports**: Detailed markdown reports showing all detected issues

### Changed
- Installation flow now includes automatic security scanning
- Skills with warnings show issue count before installation
- Error handling improved for security-blocked installations

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

