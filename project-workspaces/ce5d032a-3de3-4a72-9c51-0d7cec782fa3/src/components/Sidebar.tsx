import React, { useState } from 'react';
import { LayoutDashboard, BarChart, PieChart, LineChart, Table, Settings, Users, ChevronLast, ChevronFirst } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface SidebarItemProps {
  icon: React.ReactNode;
  text: string;
  to: string;
  active: boolean;
  expanded: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, text, to, active, expanded }) => {
  return (
    <NavLink
      to={to}
      className={`
        relative flex items-center py-2 px-3 my-1
        font-medium rounded-md cursor-pointer
        transition-colors group
        ${
          active
            ? "bg-gradient-to-tr from-violet-500 to-indigo-600 text-white"
            : "hover:bg-slate-800 text-slate-300"
        }
      `}
    >
      {icon}
      <span
        className={`overflow-hidden transition-all ${expanded ? "w-52 ml-3" : "w-0"}`}
      >
        {text}
      </span>
      {!expanded && (
        <div
          className={`
            absolute left-full rounded-md px-6 py-2 ml-6
            bg-indigo-100 text-indigo-800 text-sm
            invisible opacity-20 -translate-x-3 transition-all
            group-hover:visible group-hover:opacity-100 group-hover:translate-x-0
          `}
        >
          {text}
        </div>
      )}
    </NavLink>
  );
};

const Sidebar: React.FC = () => {
  const [expanded, setExpanded] = useState(true);
  const currentPath = window.location.pathname; // For active state in demo

  return (
    <aside className="h-screen">
      <nav className="h-full flex flex-col bg-slate-900 border-r border-slate-800 shadow-sm">
        <div className="p-4 pb-2 flex justify-between items-center">
          <img
            src="https://img.logoipsum.com/243.svg"
            className={`overflow-hidden transition-all ${expanded ? "w-32" : "w-0"}`}
            alt="Logo"
          />
          <button
            onClick={() => setExpanded((curr) => !curr)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
          >
            {expanded ? <ChevronFirst /> : <ChevronLast />}
          </button>
        </div>

        <ul className="flex-1 px-3 mt-4">
          <SidebarItem icon={<LayoutDashboard />} text="Dashboard" to="/" active={currentPath === '/'} expanded={expanded} />
          <SidebarItem icon={<BarChart />} text="Sales Analytics" to="/sales" active={currentPath === '/sales'} expanded={expanded} />
          <SidebarItem icon={<LineChart />} text="Marketing Campaigns" to="/marketing" active={currentPath === '/marketing'} expanded={expanded} />
          <SidebarItem icon={<PieChart />} text="User Engagement" to="/engagement" active={currentPath === '/engagement'} expanded={expanded} />
          <SidebarItem icon={<Table />} text="Raw Data" to="/data" active={currentPath === '/data'} expanded={expanded} />
        </ul>

        <div className="border-t border-slate-800 flex p-3">
          <div className="flex justify-between items-center overflow-hidden transition-all w-full">
            <ul className="flex-1">
              <SidebarItem icon={<Users />} text="Users" to="/users" active={currentPath === '/users'} expanded={expanded} />
              <SidebarItem icon={<Settings />} text="Settings" to="/settings" active={currentPath === '/settings'} expanded={expanded} />
            </ul>
          </div>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
