/**
 * Security Scanner Service
 * Scans skill content for potentially malicious patterns before installation
 */

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityIssue {
  severity: SecuritySeverity;
  category: string;
  pattern: string;
  match: string;
  line: number;
  description: string;
  recommendation: string;
}

export interface SecurityScanResult {
  safe: boolean;
  issues: SecurityIssue[];
  score: number; // 0-100, higher is safer
  summary: string;
}

interface SecurityPattern {
  pattern: RegExp;
  severity: SecuritySeverity;
  category: string;
  description: string;
  recommendation: string;
}

const SECURITY_PATTERNS: SecurityPattern[] = [
  // Critical: Direct shell command execution
  {
    pattern: /\b(rm\s+-rf\s+[\/~]|rm\s+-rf\s+\*|sudo\s+rm|mkfs|dd\s+if=|:\(\)\s*\{\s*:\|\s*:\s*&\s*\}\s*;|fork\s*bomb)/gi,
    severity: 'critical',
    category: 'Destructive Commands',
    description: 'Contains potentially destructive system commands that could delete files or damage the system',
    recommendation: 'Do not install this skill. These commands can cause irreversible damage.'
  },
  {
    pattern: /\b(curl|wget|fetch)\s+[^\s]+\s*\|\s*(bash|sh|zsh|python|node|perl|ruby)/gi,
    severity: 'critical',
    category: 'Remote Code Execution',
    description: 'Downloads and executes code from a remote source without verification',
    recommendation: 'Do not install. This pattern is commonly used for malware distribution.'
  },
  {
    pattern: /\beval\s*\(\s*[`'"]?\$|\beval\s+["'`]\s*\$|`[^`]*\$\([^)]+\)[^`]*`/gi,
    severity: 'critical',
    category: 'Code Injection',
    description: 'Uses eval with dynamic content, enabling arbitrary code execution',
    recommendation: 'Do not install. Eval with dynamic content is a major security risk.'
  },

  // High: Credential and data theft patterns
  {
    pattern: /\b(AWS_SECRET|AWS_ACCESS_KEY|GITHUB_TOKEN|OPENAI_API_KEY|API_KEY|SECRET_KEY|PRIVATE_KEY|PASSWORD|CREDENTIALS?)\b.*(\||>|>>|curl|wget|http|fetch|send|post|upload)/gi,
    severity: 'high',
    category: 'Credential Exfiltration',
    description: 'May attempt to access and transmit sensitive credentials or API keys',
    recommendation: 'Review carefully. This could steal your credentials.'
  },
  {
    pattern: /cat\s+[^\s]*\/(\.ssh|\.aws|\.gnupg|\.config|\.netrc|\.npmrc|\.pypirc|\.gitconfig)/gi,
    severity: 'high',
    category: 'Sensitive File Access',
    description: 'Attempts to read sensitive configuration or credential files',
    recommendation: 'Do not install. This accesses sensitive system files.'
  },
  {
    pattern: /\b(base64|xxd|od)\s+.*\|\s*(curl|wget|nc|netcat|http)/gi,
    severity: 'high',
    category: 'Data Exfiltration',
    description: 'Encodes and transmits data to external servers',
    recommendation: 'Do not install. This pattern is used for data theft.'
  },
  {
    pattern: /\bnc\s+-[elvp]|\bnetcat|\bncat|\bsocat\b.*exec/gi,
    severity: 'high',
    category: 'Reverse Shell',
    description: 'Contains patterns commonly used for reverse shell attacks',
    recommendation: 'Do not install. Reverse shells allow remote system access.'
  },

  // High: System modification patterns
  {
    pattern: /\b(chmod\s+777|chmod\s+\+x\s+\/|chown\s+root|setuid|setgid)/gi,
    severity: 'high',
    category: 'Permission Escalation',
    description: 'Modifies file permissions in potentially dangerous ways',
    recommendation: 'Review carefully. Improper permissions can create security vulnerabilities.'
  },
  {
    pattern: /\b(crontab|\/etc\/cron|systemctl\s+enable|launchctl\s+load)/gi,
    severity: 'high',
    category: 'Persistence Mechanism',
    description: 'Attempts to install persistent scheduled tasks or services',
    recommendation: 'Review carefully. This could install backdoors that persist across reboots.'
  },

  // Medium: Suspicious network activity
  {
    pattern: /\b(curl|wget|fetch|http\.get|requests\.get|axios|fetch)\s*\(?\s*['"`]https?:\/\/[^'"`\s]+['"`]/gi,
    severity: 'medium',
    category: 'External Network Request',
    description: 'Makes requests to external URLs',
    recommendation: 'Verify the URLs are legitimate and necessary for the skill functionality.'
  },
  {
    pattern: /\b(\d{1,3}\.){3}\d{1,3}(:\d+)?/g,
    severity: 'medium',
    category: 'Hardcoded IP Address',
    description: 'Contains hardcoded IP addresses which may indicate C2 communication',
    recommendation: 'Verify these IP addresses are legitimate services.'
  },

  // Medium: File system operations
  {
    pattern: /\b(fs\.write|writeFile|write_file|open\s*\([^)]+,\s*['"]w)/gi,
    severity: 'medium',
    category: 'File Write Operations',
    description: 'Writes files to the system',
    recommendation: 'Verify the skill needs to write files and check the locations.'
  },
  {
    pattern: /\/(etc|usr|bin|sbin|var|tmp|root|home)\//gi,
    severity: 'medium',
    category: 'System Path Access',
    description: 'Accesses system directories',
    recommendation: 'Verify the skill needs access to these system paths.'
  },

  // Medium: Prompt injection / jailbreak patterns
  {
    pattern: /\b(ignore\s+(previous|prior|above|all)\s+(instructions?|prompts?|rules?)|disregard\s+(your|all|the)\s+(instructions?|guidelines?|rules?))/gi,
    severity: 'medium',
    category: 'Prompt Injection',
    description: 'Contains patterns that attempt to override AI safety guidelines',
    recommendation: 'This skill may attempt to manipulate AI behavior in unexpected ways.'
  },
  {
    pattern: /\b(you\s+are\s+now|act\s+as\s+if|pretend\s+(you|that)|roleplay\s+as|jailbreak|DAN|bypass\s+(filter|safety|restriction))/gi,
    severity: 'medium',
    category: 'Jailbreak Attempt',
    description: 'Contains patterns commonly used to bypass AI safety measures',
    recommendation: 'This skill may attempt to manipulate AI behavior dangerously.'
  },

  // Low: Potentially suspicious but often legitimate
  {
    pattern: /\bprocess\.env\b|\$ENV\{|\%ENV\%|os\.environ|getenv/gi,
    severity: 'low',
    category: 'Environment Variable Access',
    description: 'Accesses environment variables',
    recommendation: 'Verify the skill only accesses expected environment variables.'
  },
  {
    pattern: /\b(exec|spawn|system|popen|subprocess|child_process|shell_exec)\b/gi,
    severity: 'low',
    category: 'Command Execution',
    description: 'Uses functions that can execute system commands',
    recommendation: 'Review what commands are being executed.'
  },
  {
    pattern: /\b(atob|btoa|Buffer\.from|base64decode|base64encode)\b/gi,
    severity: 'low',
    category: 'Base64 Encoding',
    description: 'Uses base64 encoding which can obscure malicious content',
    recommendation: 'Verify base64 content is legitimate.'
  },

  // Info: Notable patterns
  {
    pattern: /\b(https?:\/\/localhost|127\.0\.0\.1|0\.0\.0\.0)/gi,
    severity: 'info',
    category: 'Localhost Reference',
    description: 'References localhost which may be expected for development skills',
    recommendation: 'Usually harmless but verify it matches skill purpose.'
  }
];

// Known safe patterns to reduce false positives
const SAFE_PATTERNS = [
  /```[\s\S]*?```/g, // Code blocks in documentation (often contain examples)
  /`[^`]+`/g, // Inline code references
  /https?:\/\/(github\.com|npmjs\.com|pypi\.org|docs\.)/gi, // Common safe URLs
];

/**
 * Scan skill content for security issues
 */
export function scanSkillContent(content: string, fileName: string = 'SKILL.md'): SecurityScanResult {
  const issues: SecurityIssue[] = [];
  const lines = content.split('\n');

  // Create a version with code blocks masked to reduce false positives in documentation
  let contentForScanning = content;
  
  // Track code block regions to mark issues as lower severity if in docs
  const codeBlockRanges: Array<{ start: number; end: number }> = [];
  let inCodeBlock = false;
  let codeBlockStart = 0;
  
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockStart = idx;
      } else {
        inCodeBlock = false;
        codeBlockRanges.push({ start: codeBlockStart, end: idx });
      }
    }
  });

  const isInCodeBlock = (lineNum: number): boolean => {
    return codeBlockRanges.some(range => lineNum >= range.start && lineNum <= range.end);
  };

  for (const patternDef of SECURITY_PATTERNS) {
    const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      // Find line number
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;

      // Reduce severity if in code block (likely documentation example)
      let adjustedSeverity = patternDef.severity;
      if (isInCodeBlock(lineNumber - 1)) {
        if (adjustedSeverity === 'critical') adjustedSeverity = 'high';
        else if (adjustedSeverity === 'high') adjustedSeverity = 'medium';
        else if (adjustedSeverity === 'medium') adjustedSeverity = 'low';
      }

      // Skip if it looks like a documentation example
      const lineContent = lines[lineNumber - 1] || '';
      if (lineContent.trim().startsWith('//') || 
          lineContent.trim().startsWith('#') && !lineContent.startsWith('##')) {
        if (adjustedSeverity !== 'critical') {
          adjustedSeverity = 'info';
        }
      }

      issues.push({
        severity: adjustedSeverity,
        category: patternDef.category,
        pattern: patternDef.pattern.source,
        match: match[0].substring(0, 100) + (match[0].length > 100 ? '...' : ''),
        line: lineNumber,
        description: patternDef.description,
        recommendation: patternDef.recommendation
      });
    }
  }

  // Calculate security score
  const score = calculateSecurityScore(issues);
  
  // Determine if safe
  const hasCritical = issues.some(i => i.severity === 'critical');
  const hasMultipleHigh = issues.filter(i => i.severity === 'high').length >= 2;
  const safe = !hasCritical && !hasMultipleHigh && score >= 50;

  // Generate summary
  const summary = generateSummary(issues, score);

  return {
    safe,
    issues,
    score,
    summary
  };
}

/**
 * Calculate a security score based on issues found
 */
function calculateSecurityScore(issues: SecurityIssue[]): number {
  let score = 100;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical':
        score -= 40;
        break;
      case 'high':
        score -= 20;
        break;
      case 'medium':
        score -= 10;
        break;
      case 'low':
        score -= 3;
        break;
      case 'info':
        score -= 1;
        break;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate a human-readable summary
 */
function generateSummary(issues: SecurityIssue[], score: number): string {
  if (issues.length === 0) {
    return '✅ No security issues detected';
  }

  const critical = issues.filter(i => i.severity === 'critical').length;
  const high = issues.filter(i => i.severity === 'high').length;
  const medium = issues.filter(i => i.severity === 'medium').length;
  const low = issues.filter(i => i.severity === 'low').length;

  const parts: string[] = [];
  if (critical > 0) parts.push(`🔴 ${critical} critical`);
  if (high > 0) parts.push(`🟠 ${high} high`);
  if (medium > 0) parts.push(`🟡 ${medium} medium`);
  if (low > 0) parts.push(`🔵 ${low} low`);

  const prefix = score < 50 ? '⛔ BLOCKED:' : score < 70 ? '⚠️ WARNING:' : 'ℹ️ INFO:';
  return `${prefix} ${parts.join(', ')} issue${issues.length === 1 ? '' : 's'} found (Score: ${score}/100)`;
}

/**
 * Format issues for display in VS Code
 */
export function formatIssuesForDisplay(result: SecurityScanResult): string {
  if (result.issues.length === 0) {
    return '# Security Scan Results\n\n✅ **No security issues detected**\n\nThis skill appears safe to install.';
  }

  let md = '# 🛡️ Security Scan Results\n\n';
  md += `**Score:** ${result.score}/100\n\n`;
  md += `**Status:** ${result.safe ? '⚠️ Proceed with caution' : '⛔ Installation blocked'}\n\n`;
  md += '---\n\n';

  const severityOrder: SecuritySeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const severityEmoji: Record<SecuritySeverity, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    info: 'ℹ️'
  };

  for (const severity of severityOrder) {
    const sevIssues = result.issues.filter(i => i.severity === severity);
    if (sevIssues.length === 0) continue;

    md += `## ${severityEmoji[severity]} ${severity.toUpperCase()} (${sevIssues.length})\n\n`;

    for (const issue of sevIssues) {
      md += `### ${issue.category}\n`;
      md += `- **Line ${issue.line}:** \`${issue.match}\`\n`;
      md += `- **Issue:** ${issue.description}\n`;
      md += `- **Recommendation:** ${issue.recommendation}\n\n`;
    }
  }

  if (!result.safe) {
    md += '---\n\n';
    md += '## ⛔ Installation Blocked\n\n';
    md += 'This skill contains security issues that prevent automatic installation.\n\n';
    md += 'If you trust this skill author, you can:\n';
    md += '1. Review the issues above carefully\n';
    md += '2. Use "Force Install (Bypass Security)" if you understand the risks\n';
  }

  return md;
}

/**
 * Get security badge for tree view display
 */
export function getSecurityBadge(score: number): { icon: string; label: string } {
  if (score >= 90) return { icon: '🟢', label: 'Safe' };
  if (score >= 70) return { icon: '🟡', label: 'Caution' };
  if (score >= 50) return { icon: '🟠', label: 'Warning' };
  return { icon: '🔴', label: 'Blocked' };
}
