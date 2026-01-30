/**
 * ClawdHub API Client
 * Loads skills from pre-built JSON file (updated daily by GitHub Action)
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface Skill {
  slug: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  downloads?: number;
  stars?: number;
  tags?: string[];
  category?: string;
  updatedAt?: string;
}

export interface SkillDetail extends Skill {
  content: string; // SKILL.md content
  changelog?: string;
  files?: string[];
}

export interface SearchResult {
  skills: Skill[];
  total: number;
}

interface SkillsData {
  skills: Skill[];
  total: number;
  lastUpdated: string;
  version: string;
}

class ClawdHubAPI {
  private baseUrl: string;
  private dataUrl: string;
  private skillsData: SkillsData | null = null;
  private cacheTimestamp: number = 0;
  private cacheTTL: number = 24 * 60 * 60 * 1000; // 24 hours
  private loading: Promise<SkillsData> | null = null;

  constructor() {
    const config = vscode.workspace.getConfiguration('lobstore');
    this.baseUrl = config.get<string>('registryUrl', 'https://api.github.com/repos/moltbot/skills');
    this.dataUrl = config.get<string>('dataUrl', 'https://raw.githubusercontent.com/your-username/lobstore-skills/main/data/skills.json');
  }

  clearCache(): void {
    this.skillsData = null;
    this.cacheTimestamp = 0;
    this.loading = null;
  }

  /**
   * Load skills from URL with daily refresh, fallback to bundled JSON
   */
  private async loadSkillsData(): Promise<SkillsData> {
    // Return cached data if fresh (less than 24 hours old)
    if (this.skillsData && Date.now() - this.cacheTimestamp < this.cacheTTL) {
      return this.skillsData;
    }

    if (this.loading) {
      return this.loading;
    }

    this.loading = (async () => {
      try {
        // Try fetching from URL first (auto-updates daily)
        console.log(`Fetching skills from: ${this.dataUrl}`);
        const response = await fetch(this.dataUrl, {
          headers: { 'User-Agent': 'Lobstore-Skills-Extension' }
        });
        
        if (response.ok) {
          const data = await response.json() as SkillsData;
          this.skillsData = data;
          this.cacheTimestamp = Date.now();
          console.log(`✅ Fetched ${data.total} skills from URL (last updated: ${data.lastUpdated})`);
          return data;
        }
        
        console.warn(`Failed to fetch from URL (${response.status}), falling back to bundled data`);
      } catch (err) {
        console.warn('Failed to fetch skills from URL, using bundled fallback:', err);
      }

      // Fallback: Load from bundled JSON file
      try {
        // __dirname is <extension>/dist/api/, go up two levels to <extension>/, then to data/
        const dataPath = path.join(__dirname, '..', '..', 'data', 'skills.json');
        
        console.log(`Loading skills from bundled file: ${dataPath}`);
        const content = await fs.readFile(dataPath, 'utf-8');
        this.skillsData = JSON.parse(content) as SkillsData;
        this.cacheTimestamp = Date.now();
        
        console.log(`📦 Loaded ${this.skillsData.total} skills from bundle (last updated: ${this.skillsData.lastUpdated})`);
        return this.skillsData;
      } catch (err) {
        console.error('Failed to load bundled skills.json:', err);
        // Return empty dataset as last resort
        this.skillsData = {
          skills: [],
          total: 0,
          lastUpdated: new Date().toISOString(),
          version: '1.0.0'
        };
        this.cacheTimestamp = Date.now();
        return this.skillsData;
      } finally {
        this.loading = null;
      }
    })();

    return this.loading;
  }

  /**
   * Get all skills (instant load from JSON)
   */
  async getAllSkills(): Promise<Skill[]> {
    const data = await this.loadSkillsData();
    return data.skills;
  }

  /**
   * Format slug to readable name
   */
  private formatName(slug: string): string {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Search skills using simple filtering
   */
  async search(query: string, limit: number = 30): Promise<Skill[]> {
    const allSkills = await this.getAllSkills();
    const lowerQuery = query.toLowerCase();
    
    return allSkills
      .filter(skill => 
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description.toLowerCase().includes(lowerQuery) ||
        skill.slug.toLowerCase().includes(lowerQuery)
      )
      .slice(0, limit);
  }

  /**
   * Get skill details including SKILL.md content
   */
  async getSkillDetail(slug: string): Promise<SkillDetail> {
    // Fetch SKILL.md from GitHub raw content
    const response = await fetch(
      `https://raw.githubusercontent.com/moltbot/skills/main/skills/${slug}/SKILL.md`,
      { headers: { 'User-Agent': 'Lobstore-Skills-Extension' } }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Skill not found: ${slug}`);
      }
      throw new Error(`Failed to fetch skill: ${response.statusText}`);
    }

    const content = await response.text();
    const skillName = slug.split('/')[1];
    
    return {
      slug,
      name: this.formatName(skillName),
      description: `By ${slug.split('/')[0]}`,
      content,
    } as SkillDetail;
  }

  /**
   * Download skill as zip buffer
   * Uses raw.githubusercontent.com to avoid API rate limits
   */
  async downloadSkill(slug: string, version: string = 'latest'): Promise<Buffer> {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    
    // Try to download common skill files directly without listing
    // This avoids API rate limits by using raw content URLs
    const commonFiles = [
      'SKILL.md',
      'README.md',
      'instructions.md',
      '.copilot-instructions.md',
      'examples.md',
      'changelog.md',
      'CHANGELOG.md'
    ];
    
    const baseRawUrl = `https://raw.githubusercontent.com/moltbot/skills/main/skills/${slug}`;
    let filesDownloaded = 0;
    
    for (const fileName of commonFiles) {
      try {
        const fileUrl = `${baseRawUrl}/${fileName}`;
        const response = await fetch(fileUrl, {
          headers: { 'User-Agent': 'Lobstore-Skills-Extension' }
        });
        
        if (response.ok) {
          const content = await response.text();
          zip.addFile(fileName, Buffer.from(content, 'utf-8'));
          filesDownloaded++;
        }
      } catch (err) {
        // Skip missing files
        continue;
      }
    }
    
    if (filesDownloaded === 0) {
      throw new Error('Download failed: No skill files found. The skill may not exist or may have been moved.');
    }
    
    return zip.toBuffer();
  }

  /**
   * Get web URL for a skill
   */
  getSkillUrl(slug: string): string {
    return `https://github.com/moltbot/skills/tree/main/skills/${slug}`;
  }
}

// Singleton
let api: ClawdHubAPI | null = null;

export function getAPI(): ClawdHubAPI {
  if (!api) {
    api = new ClawdHubAPI();
  }
  return api;
}

export function resetAPI(): void {
  api = null;
}
