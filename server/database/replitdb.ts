import * as fs from 'fs/promises';
import * as path from 'path';
import { storage } from '../storage';

export interface ECodeDBData {
  projectId: number;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class ECodeDB {
  private dbPath: string;
  private cache: Map<number, ECodeDBData> = new Map();

  constructor() {
    this.dbPath = path.join(process.cwd(), '.replitdb');
    this.initializeDB();
  }

  private async initializeDB() {
    try {
      await fs.mkdir(this.dbPath, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize ECodeDB directory:', error);
    }
  }

  async get(projectId: number, key: string): Promise<any> {
    const db = await this.getProjectDB(projectId);
    return db.data[key];
  }

  async set(projectId: number, key: string, value: any): Promise<void> {
    const db = await this.getProjectDB(projectId);
    db.data[key] = value;
    db.updatedAt = new Date();
    await this.saveProjectDB(projectId, db);
  }

  async delete(projectId: number, key: string): Promise<boolean> {
    const db = await this.getProjectDB(projectId);
    if (key in db.data) {
      delete db.data[key];
      db.updatedAt = new Date();
      await this.saveProjectDB(projectId, db);
      return true;
    }
    return false;
  }

  async keys(projectId: number, prefix?: string): Promise<string[]> {
    const db = await this.getProjectDB(projectId);
    const allKeys = Object.keys(db.data);
    
    if (prefix) {
      return allKeys.filter(key => key.startsWith(prefix));
    }
    
    return allKeys;
  }

  async clear(projectId: number): Promise<void> {
    const db = await this.getProjectDB(projectId);
    db.data = {};
    db.updatedAt = new Date();
    await this.saveProjectDB(projectId, db);
  }

  async size(projectId: number): Promise<number> {
    const db = await this.getProjectDB(projectId);
    return Object.keys(db.data).length;
  }

  async export(projectId: number): Promise<string> {
    const db = await this.getProjectDB(projectId);
    return JSON.stringify(db.data, null, 2);
  }

  async import(projectId: number, jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      const db = await this.getProjectDB(projectId);
      db.data = data;
      db.updatedAt = new Date();
      await this.saveProjectDB(projectId, db);
    } catch (error) {
      throw new Error('Invalid JSON data');
    }
  }

  async getStats(projectId: number): Promise<{
    size: number;
    keyCount: number;
    createdAt: Date;
    updatedAt: Date;
    sizeInBytes: number;
  }> {
    const db = await this.getProjectDB(projectId);
    const jsonStr = JSON.stringify(db.data);
    const sizeInBytes = new TextEncoder().encode(jsonStr).length;

    return {
      size: Object.keys(db.data).length,
      keyCount: Object.keys(db.data).length,
      createdAt: db.createdAt,
      updatedAt: db.updatedAt,
      sizeInBytes
    };
  }

  async search(projectId: number, query: string): Promise<Array<{ key: string; value: any }>> {
    const db = await this.getProjectDB(projectId);
    const results: Array<{ key: string; value: any }> = [];
    
    const lowerQuery = query.toLowerCase();
    
    for (const [key, value] of Object.entries(db.data)) {
      if (
        key.toLowerCase().includes(lowerQuery) ||
        JSON.stringify(value).toLowerCase().includes(lowerQuery)
      ) {
        results.push({ key, value });
      }
    }
    
    return results;
  }

  private async getProjectDB(projectId: number): Promise<ECodeDBData> {
    // Check cache first
    if (this.cache.has(projectId)) {
      return this.cache.get(projectId)!;
    }

    // Try to load from disk
    const dbFile = path.join(this.dbPath, `project-${projectId}.json`);
    
    try {
      const data = await fs.readFile(dbFile, 'utf-8');
      const db = JSON.parse(data);
      db.createdAt = new Date(db.createdAt);
      db.updatedAt = new Date(db.updatedAt);
      this.cache.set(projectId, db);
      return db;
    } catch (error) {
      // Create new DB if doesn't exist
      const newDB: ECodeDBData = {
        projectId,
        data: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.cache.set(projectId, newDB);
      await this.saveProjectDB(projectId, newDB);
      return newDB;
    }
  }

  private async saveProjectDB(projectId: number, db: ECodeDBData): Promise<void> {
    const dbFile = path.join(this.dbPath, `project-${projectId}.json`);
    await fs.writeFile(dbFile, JSON.stringify(db, null, 2));
    this.cache.set(projectId, db);
  }

  async deleteProjectDB(projectId: number): Promise<void> {
    const dbFile = path.join(this.dbPath, `project-${projectId}.json`);
    
    try {
      await fs.unlink(dbFile);
      this.cache.delete(projectId);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }
}

export const replitDB = new ECodeDB();