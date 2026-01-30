const fs = require('fs');
const path = require('path');
const repoPath = '/Users/garrett/Desktop/moltbot-skills-temp/skills';
const skills = [];
const users = fs.readdirSync(repoPath);
console.log('Found', users.length, 'users');
users.forEach(user => {
  try {
    const userPath = path.join(repoPath, user);
    if (fs.statSync(userPath).isDirectory()) {
      fs.readdirSync(userPath).forEach(skill => {
        const md = path.join(userPath, skill, 'SKILL.md');
        if (fs.existsSync(md)) {
          skills.push({
            slug: user + '/' + skill,
            name: skill.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
            description: 'By ' + user,
            category: 'Other',
            author: user
          });
        }
      });
    }
  } catch(e) {}
  if (skills.length % 200 === 0 && skills.length > 0) console.log('Processed', skills.length);
});
fs.writeFileSync('data/skills.json', JSON.stringify({
  skills: skills.sort((a,b) => a.name.localeCompare(b.name)),
  total: skills.length,
  lastUpdated: new Date().toISOString(),
  version: '1.0.0'
}, null, 2));
console.log('Done! Total:', skills.length, 'skills');
