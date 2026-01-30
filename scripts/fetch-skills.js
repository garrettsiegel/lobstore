/**
 * Fetch all skills from moltbot/skills GitHub repo and package as JSON
 */

const fs = require('fs').promises;
const path = require('path');

const BASE_URL = 'https://api.github.com/repos/moltbot/skills';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Optional: set for 5000 req/hr instead of 60

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
  
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(users.length/batchSize)}...`);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (user) => {
        try {
          const skillFolders = await fetchJSON(user.url);
          return skillFolders
            .filter(item => item.type === 'dir')
            .map(skill => ({
              slug: `${user.name}/${skill.name}`,
              name: formatName(skill.name),
              description: `By ${user.name}`,
              category: guessCategory(skill.name),
            }));
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
    version: '1.0.0'
  };
  
  const outputPath = path.join(__dirname, '..', 'data', 'skills.json');
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`Saved to ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
