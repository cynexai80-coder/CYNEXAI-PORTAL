import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Plus, CheckCircle2, Hash, Settings, FolderOpen, Inbox, LayoutDashboard, ChevronDown, ChevronRight, MoreHorizontal, X } from 'lucide-react';
import { Project } from '../../../lib/api/projects';
import { getCurrentUser } from '../../../lib/auth';
import { CynexLogo } from '../../ui/CynexLogo';

interface TaskAppSidebarProps {
  currentView: string;
  onViewChange: (view: string, projectId?: string) => void;
  projects: Project[];
  onNewProject: () => void;
}

export function TaskAppSidebar({ currentView, onViewChange, projects, onNewProject }: TaskAppSidebarProps) {
  const [projectsOpen, setProjectsOpen] = useState(true);

  const getButtonClass = (isActive: boolean) => 
    `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive 
        ? 'bg-erp-primary/10 text-erp-primary font-bold' 
        : 'text-erp-text/70 hover:bg-erp-surface hover:text-erp-text'
    }`;

  return (
    <div className="w-64 h-full bg-erp-background border-r-2 border-erp-border flex flex-col flex-shrink-0 animate-in slide-in-from-left duration-200 no-watermark">
      <div className="p-4 border-b border-erp-border">
        <CynexLogo size="md" badge="Task Center" />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        
        {/* Core Views */}
        <div className="space-y-1">
          <button 
            onClick={() => onViewChange('my-tasks')}
            className={getButtonClass(currentView === 'my-tasks')}
          >
            <CheckCircle2 className="w-4 h-4" />
            My Tasks
          </button>
          
          <button 
            onClick={() => onViewChange('delegated')}
            className={getButtonClass(currentView === 'delegated')}
          >
            <FolderOpen className="w-4 h-4" />
            Assigned by Me
          </button>
          <button 
            onClick={() => onViewChange('all-tasks')}
            className={getButtonClass(currentView === 'all-tasks')}
          >
            <Hash className="w-4 h-4" />
            Team Tasks
          </button>
        </div>

        {/* Projects */}
        <div>
          <div 
            className="flex items-center justify-between px-3 py-2 text-xs font-bold text-erp-text/50 uppercase tracking-wider cursor-pointer hover:text-erp-text transition-colors group"
            onClick={() => setProjectsOpen(!projectsOpen)}
          >
            <div className="flex items-center gap-1">
              {projectsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Projects
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onNewProject();
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-erp-surface rounded transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          
          {projectsOpen && (
            <div className="mt-1 space-y-0.5">
              {projects.length === 0 ? (
                <div className="px-3 py-3 text-xs text-erp-text/40 text-center font-medium border border-dashed border-erp-border/50 rounded-lg mx-3">
                  No projects yet
                </div>
              ) : (
                projects.map((project) => {
                  const isActive = currentView === `project_${project.id}`;
                  return (
                    <button
                      key={project.id}
                      onClick={() => onViewChange(`project_${project.id}`, project.id)}
                      className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive 
                          ? 'bg-erp-primary/10 text-erp-text font-bold' 
                          : 'text-erp-text/70 hover:bg-erp-surface hover:text-erp-text'
                      }`}
                    >
                      <div 
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0 shadow-sm" 
                        style={{ backgroundColor: project.color || '#94a3b8' }} 
                      />
                      <span className="truncate flex-1 text-left">{project.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
