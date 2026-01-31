/**
 * Fetch all skills from moltbot/skills GitHub repo and package as JSON
 * Enhanced to extract AgentSkills frontmatter metadata
 */

const fs = require('fs').promises;
const path = require('path');

const BASE_URL = 'https://api.github.com/repos/moltbot/skills';
const RAW_URL = 'https://raw.githubusercontent.com/moltbot/skills/main/skills';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const HEADERS = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'Lobstore-Skills-Sync',
  ...(GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {})
};

async function fetchJSON(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Lobstore-Skills-Sync' } });
  if (!response.ok) return null;
  return response.text();
}

/**
 * Parse SKILL.md frontmatter (AgentSkills standard)
 */
function parseFrontmatter(content) {
  if (!content) return {};
  
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const fm = match[1];
  const metadata = {};

  const nameMatch = fm.match(/^name:\s*['"]?(.+?)['"]?\s*$/m);
  if (nameMatch) metadata.name = nameMatch[1];

  const descMatch = fm.match(/^description:\s*['"]?(.+?)['"]?\s*$/m);
  if (descMatch) metadata.description = descMatch[1];

  const compatMatch = fm.match(/^compatibility:\s*['"]?(.+?)['"]?\s*$/m);
  if (compatMatch) metadata.compatibility = compatMatch[1];

  const licenseMatch = fm.match(/^license:\s*['"]?(.+?)['"]?\s*$/m);
  if (licenseMatch) metadata.license = licenseMatch[1];

  const versionMatch = fm.match(/^version:\s*['"]?(.+?)['"]?\s*$/m);
  if (versionMatch) metadata.version = versionMatch[1];

  // Parse allowed-tools as array
  const toolsMatch = fm.match(/^allowed-tools:\s*(.+)$/m);
  if (toolsMatch) metadata.allowedTools = toolsMatch[1].split(/\s+/);

  // Parse metadata block for custom fields
  const metaBlockMatch = fm.match(/^metadata:\s*\n((?:  .+\n?)+)/m);
  if (metaBlockMatch) {
    const lines = metaBlockMatch[1].split('\n');
    for (const line of lines) {
      const kvMatch = line.match(/^\s{2}(\w+):\s*['"]?(.+?)['"]?\s*$/);
      if (kvMatch) {
        metadata[kvMatch[1]] = kvMatch[2];
      }
    }
  }

  return metadata;
}

/**
 * Detect required CLI tools from SKILL.md content
 */
function detectRequiredBins(content) {
  if (!content) return [];
  
  const bins = new Set();
  const lower = content.toLowerCase();
  
  const toolPatterns = [
    { pattern: /\b(git)\b/i, tool: 'git' },
    { pattern: /\b(docker|dockerfile)\b/i, tool: 'docker' },
    { pattern: /\b(kubectl|kubernetes|k8s)\b/i, tool: 'kubectl' },
    { pattern: /\b(terraform)\b/i, tool: 'terraform' },
    { pattern: /\b(npm|node)\b/i, tool: 'node' },
    { pattern: /\b(python|pip)\b/i, tool: 'python' },
    { pattern: /\b(jq)\b/i, tool: 'jq' },
    { pattern: /\b(curl)\b/i, tool: 'curl' },
    { pattern: /\b(aws)\s+(cli|s3|ec2)/i, tool: 'aws' },
    { pattern: /\b(gcloud)\b/i, tool: 'gcloud' },
    { pattern: /\b(az)\s+(login|webapp|vm)/i, tool: 'az' },
  ];
  
  for (const { pattern, tool } of toolPatterns) {
    if (pattern.test(content)) bins.add(tool);
  }
  
  return Array.from(bins);
}

/**
 * Detect required environment variables from SKILL.md content
 */
function detectRequiredEnv(content) {
  if (!content) return [];
  
  const envVars = new Set();
  
  // Match common env var patterns
  const matches = content.matchAll(/\$\{?([A-Z][A-Z0-9_]+)\}?/g);
  for (const match of matches) {
    const varName = match[1];
    // Filter to likely API keys and tokens
    if (varName.includes('KEY') || varName.includes('TOKEN') || 
        varName.includes('SECRET') || varName.includes('API')) {
      envVars.add(varName);
    }
  }
  
  return Array.from(envVars);
}

/**
 * Detect platform support from SKILL.md content
 */
function detectPlatforms(content) {
  if (!content) return ['macos', 'windows', 'linux'];
  
  const lower = content.toLowerCase();
  const platforms = [];
  
  if (lower.includes('macos') || lower.includes('mac os') || lower.includes('darwin')) {
    platforms.push('macos');
  }
  if (lower.includes('windows') || lower.includes('win32') || lower.includes('powershell')) {
    platforms.push('windows');
  }
  if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian')) {
    platforms.push('linux');
  }
  
  return platforms.length > 0 ? platforms : ['macos', 'windows', 'linux'];
}

/**
 * Detect integration type from skill name/content
 */
function detectIntegration(slug, content) {
  const lower = (slug + ' ' + (content || '')).toLowerCase();
  
  const integrations = [
    { pattern: /telegram/i, type: 'telegram' },
    { pattern: /discord/i, type: 'discord' },
    { pattern: /slack/i, type: 'slack' },
    { pattern: /twitter|x\.com/i, type: 'twitter' },
    { pattern: /github/i, type: 'github' },
    { pattern: /jira/i, type: 'jira' },
    { pattern: /notion/i, type: 'notion' },
    { pattern: /linear/i, type: 'linear' },
    { pattern: /stripe/i, type: 'stripe' },
    { pattern: /openai/i, type: 'openai' },
    { pattern: /anthropic|claude/i, type: 'anthropic' },
  ];
  
  for (const { pattern, type } of integrations) {
    if (pattern.test(lower)) return type;
  }
  
  return undefined;
}

function formatName(slug) {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function guessCategory(slug) {
  const lower = slug.toLowerCase();
  
  // AI & ML
  if (lower.includes('ai') || lower.includes('ml') || lower.includes('gpt') || lower.includes('llm') || lower.includes('openai') || lower.includes('claude')) return 'AI & ML';
  
  // Frontend
  if (lower.includes('react') || lower.includes('vue') || lower.includes('angular') || lower.includes('svelte') || lower.includes('frontend') || lower.includes('ui') || lower.includes('nextjs')) return 'Frontend';
  
  // Backend
  if (lower.includes('api') || lower.includes('backend') || lower.includes('server') || lower.includes('express') || lower.includes('fastapi') || lower.includes('django')) return 'Backend';
  
  // DevOps & Infrastructure
  if (lower.includes('kubernetes') || lower.includes('k8s') || lower.includes('docker') || lower.includes('devops') || lower.includes('terraform') || lower.includes('aws') || lower.includes('azure') || lower.includes('cloud')) return 'DevOps';
  
  // Testing & QA
  if (lower.includes('test') || lower.includes('qa') || lower.includes('jest') || lower.includes('cypress') || lower.includes('playwright')) return 'Testing';
  
  // Security
  if (lower.includes('security') || lower.includes('auth') || lower.includes('oauth') || lower.includes('jwt') || lower.includes('encrypt')) return 'Security';
  
  // Data & Analytics
  if (lower.includes('data') || lower.includes('analytics') || lower.includes('sql') || lower.includes('database') || lower.includes('postgres') || lower.includes('mongo')) return 'Data';
  
  // Blockchain & Web3
  if (lower.includes('solana') || lower.includes('eth') || lower.includes('web3') || lower.includes('crypto') || lower.includes('blockchain') || lower.includes('nft')) return 'Web3';
  
  // Payment & Finance
  if (lower.includes('payment') || lower.includes('stripe') || lower.includes('pay') || lower.includes('billing') || lower.includes('invoice')) return 'Payments';
  
  // Social & Media
  if (lower.includes('twitter') || lower.includes('facebook') || lower.includes('instagram') || lower.includes('tiktok') || lower.includes('youtube') || lower.includes('social') || lower.includes('spotify') || lower.includes('apple-media')) return 'Social & Media';
  
  // Productivity
  if (lower.includes('todo') || lower.includes('task') || lower.includes('calendar') || lower.includes('note') || lower.includes('notion') || lower.includes('productivity')) return 'Productivity';
  
  return 'Other';
}

async function main() {
  console.log('Fetching user directories...');
  if (GITHUB_TOKEN) {
    console.log('✅ Using authenticated requests (5000 req/hr)');
  } else {
    console.log('⚠️  Using unauthenticated requests (60 req/hr) - set GITHUB_TOKEN env var for more');
  }
  const userFolders = await fetchJSON(`${BASE_URL}/contents/skills`);
  const users = userFolders.filter(item => item.type === 'dir');
  
  console.log(`Found ${users.length} users`);
  
  const skills = [];
  const batchSize = 10;
  const fetchMetadata = process.env.FETCH_METADATA === 'true';
  
  if (fetchMetadata) {
    console.log('📦 Enhanced mode: fetching SKILL.md metadata (slower but richer data)');
  }
  
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(users.length/batchSize)}...`);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (user) => {
        try {
          const skillFolders = await fetchJSON(user.url);
          const userSkills = [];
          
          for (const skill of skillFolders.filter(item => item.type === 'dir')) {
            const slug = `${user.name}/${skill.name}`;
            let metadata = {};
            let content = null;
            
            // Optionally fetch SKILL.md for enhanced metadata
            if (fetchMetadata) {
              content = await fetchText(`${RAW_URL}/${slug}/SKILL.md`);
              if (content) {
                metadata = parseFrontmatter(content);
              }
            }
            
            const skillData = {
              slug,
              name: metadata.name || formatName(skill.name),
              description: metadata.description || `By ${user.name}`,
              category: guessCategory(skill.name),
              author: user.name,
            };
            
            // Add enhanced metadata if available
            if (metadata.version) skillData.version = metadata.version;
            if (metadata.compatibility) skillData.compatibility = metadata.compatibility;
            if (metadata.license) skillData.license = metadata.license;
            
            // Detect dependencies from content
            if (content) {
              const bins = detectRequiredBins(content);
              if (bins.length > 0) skillData.requiredBins = bins;
              
              const envVars = detectRequiredEnv(content);
              if (envVars.length > 0) skillData.requiredEnv = envVars;
              
              const platforms = detectPlatforms(content);
              if (platforms.length < 3) skillData.platforms = platforms;
              
              const integration = detectIntegration(slug, content);
              if (integration) skillData.integration = integration;
            }
            
            userSkills.push(skillData);
          }
          
          return userSkills;
        } catch (err) {
          console.warn(`Error fetching skills for ${user.name}:`, err.message);
          return [];
        }
      })
    );
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        skills.push(...result.value);
      }
    }
    
    if (i + batchSize < users.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`\nTotal skills found: ${skills.length}`);
  
  const output = {
    skills,
    total: skills.length,
    lastUpdated: new Date().toISOString(),
    version: '1.1.0'
  };
  
  const outputPath = path.join(__dirname, '..', 'data', 'skills.json');
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`Saved to ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
