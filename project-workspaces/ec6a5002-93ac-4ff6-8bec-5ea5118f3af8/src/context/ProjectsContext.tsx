import React, { createContext, useContext, useEffect, useState } from 'react';
import { Project } from '../types';
import { loadProjects, saveProjects } from '../utils/storage';
import { v4 as uuid } from 'uuid';

interface ProjectsContextValue {
  projects: Project[];
  current?: Project;
  setCurrent: (id: string) => void;
  addProject: (name: string, description?: string) => void;
  updateProject: (project: Project) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | undefined>(undefined);

export const useProjects = () => {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be inside provider');
  return ctx;
};

export const ProjectsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setCurrentId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  const setCurrent = (id: string) => setCurrentId(id);

  const addProject = (name: string, description?: string) => {
    const newProject: Project = {
      id: uuid(),
      name,
      description,
      tasks: [],
      sprints: [],
      members: [],
    };
    setProjects((prev) => [...prev, newProject]);
  };

  const updateProject = (project: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)));
  };

  const current = projects.find((p) => p.id === currentId) ?? projects[0];

  return (
    <ProjectsContext.Provider value={{ projects, current, setCurrent, addProject, updateProject }}>
      {children}
    </ProjectsContext.Provider>
  );
};