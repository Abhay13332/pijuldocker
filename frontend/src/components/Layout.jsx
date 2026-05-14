import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutGrid, 
  Book, 
  Settings, 
  LogOut, 
  User, 
  Box, 
  GitBranch, 
  FileCode, 
  History,
  GitFork,
  Star,
  ChevronRight,
  Menu,
  Search,
  Bell
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from './ui/dropdown-menu';

const SidebarItem = ({ icon: Icon, label, to, active }) => (
  <Link 
    to={to} 
    className={cn(
      "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
      active 
        ? "bg-accent text-accent-foreground" 
        : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
    )}
  >
    <Icon className="w-4 h-4" />
    {label}
  </Link>
);

const Layout = ({ children, repoName, owner }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const username = localStorage.getItem('username');
  // Build the /owner/name base for all repo-scoped URLs
  const repoBase = owner && repoName ? `${owner}/${repoName}` : repoName;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col shrink-0">
        <div className="h-14 flex items-center px-6 border-b">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary">
            <Box className="w-6 h-6 text-primary" />
            <span>PijulServ</span>
          </Link>
        </div>
        
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <SidebarItem 
            icon={LayoutGrid} 
            label="Dashboard" 
            to="/" 
            active={location.pathname === '/'} 
          />
          <SidebarItem 
            icon={Book} 
            label="Guide" 
            to="/guide" 
            active={location.pathname === '/guide'} 
          />
          
          {repoBase && (
            <div className="pt-4 pb-2">
              <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Project
              </div>
              <SidebarItem 
                icon={Book} 
                label="Overview" 
                to={`/repos/${repoBase}`} 
                active={location.pathname === `/repos/${repoBase}`} 
              />
              <SidebarItem 
                icon={FileCode} 
                label="Repository" 
                to={`/repos/${repoBase}/files`} 
                active={location.pathname.startsWith(`/repos/${repoBase}/files`)} 
              />
              <SidebarItem 
                icon={History} 
                label="Commits" 
                to={`/repos/${repoBase}/patches`} 
                active={location.pathname.startsWith(`/repos/${repoBase}/patches`)} 
              />
              <SidebarItem 
                icon={Settings} 
                label="Settings" 
                to={`/repos/${repoBase}/settings`} 
                active={location.pathname.startsWith(`/repos/${repoBase}/settings`)} 
              />
            </div>
          )}
        </nav>

        <div className="p-4 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 px-2">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                  {username?.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{username}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b flex items-center justify-between px-6 shrink-0 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {owner && (
              <>
                <Link to="/" className="hover:text-primary transition-colors">{owner}</Link>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
            <span className="font-semibold text-primary">{repoName || 'Dashboard'}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search..."
                className="pl-9 h-9 w-64 rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <Button variant="ghost" size="icon">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Page Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
