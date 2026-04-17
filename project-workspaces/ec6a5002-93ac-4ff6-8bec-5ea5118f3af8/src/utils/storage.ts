import { Project } from '../types';

const STORAGE_KEY = 'flowsprint_data';

export function loadProjects(): Project[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Project[];
  } catch (err) {
    console.error('Failed to parse data', err);
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}