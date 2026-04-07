import { useLocation } from "wouter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Sidebar = () => {
  const [location, navigate] = useLocation();

  const items = [
    { icon: "ri-code-s-slash-line", tooltip: "Editor", route: location.includes("/project/") ? location : "/" },
    { icon: "ri-terminal-box-line", tooltip: "Terminal", route: "#" },
    { icon: "ri-git-branch-line", tooltip: "Version Control", route: "#" },
    { icon: "ri-file-list-line", tooltip: "Files", route: "#", active: true },
    { icon: "ri-search-line", tooltip: "Search", route: "#" },
  ];

  return (
    <div className="w-16 h-full bg-dark-800 flex flex-col items-center py-4 border-r border-dark-600">
      <div className="mb-6">
        <div 
          className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-white font-bold cursor-pointer"
          onClick={() => navigate("/")}
        >
          P
        </div>
      </div>
      
      <div className="flex flex-col space-y-6 items-center">
        <TooltipProvider delayDuration={300}>
          {items.map((item, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <button 
                  className={`text-white opacity-80 hover:opacity-100 w-10 h-10 flex items-center justify-center rounded ${item.active ? 'bg-dark-700' : 'hover:bg-dark-700'}`}
                  onClick={() => item.route !== "#" && navigate(item.route)}
                >
                  <i className={`${item.icon} text-xl`}></i>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{item.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
      
      <div className="mt-auto">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-white opacity-80 hover:opacity-100 w-10 h-10 flex items-center justify-center rounded hover:bg-dark-700">
                <i className="ri-settings-4-line text-xl"></i>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <div className="mt-4 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-medium text-sm">
          JS
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
