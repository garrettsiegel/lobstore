/**
 * ClawdHub API Client
 * Fetches skills from the ClawdHub registry
 */

import * as vscode from 'vscode';

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

class ClawdHubAPI {
  private baseUrl: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const config = vscode.workspace.getConfiguration('lobstore');
    this.baseUrl = config.get<string>('registryUrl', 'https://clawdhub.com');
  }

  private async fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }

    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get all skills (for browsing)
   */
  async getAllSkills(): Promise<Skill[]> {
    return this.fetchWithCache('all-skills', async () => {
      try {
        const response = await fetch(`${this.baseUrl}/api/skills?limit=200`, {
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch skills: ${response.statusText}`);
        }

        const data = await response.json();
        return data.skills || data || [];
      } catch (error) {
        console.error('ClawdHub API error:', error);
        throw error;
      }
    });
  }

  /**
   * Search skills using vector search
   */
  async search(query: string, limit: number = 30): Promise<Skill[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/skills/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query, limit }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.skills || data || [];
    } catch (error) {
      console.error('ClawdHub search error:', error);
      throw error;
    }
  }

  /**
   * Get skill details including SKILL.md content
   */
  async getSkillDetail(slug: string): Promise<SkillDetail> {
    return this.fetchWithCache(`skill-${slug}`, async () => {
      const response = await fetch(`${this.baseUrl}/api/skills/${encodeURIComponent(slug)}`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Skill not found: ${slug}`);
        }
        throw new Error(`Failed to fetch skill: ${response.statusText}`);
      }

      return await response.json();
    });
  }

  /**
   * Download skill as zip buffer
   */
  async downloadSkill(slug: string, version: string = 'latest'): Promise<Buffer> {
    const url = `${this.baseUrl}/api/skills/${encodeURIComponent(slug)}/download?version=${encodeURIComponent(version)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get web URL for a skill
   */
  getSkillUrl(slug: string): string {
    return `${this.baseUrl}/skills/${slug}`;
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
