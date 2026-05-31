import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchOrgs } from '../../api';
import { Organization } from '../../types';
import { 
  Building, 
  Plus, 
  Loader2, 
  Users, 
  GitFork, 
  Calendar,
  Shield,
  Crown,
  UserCog,
  Search,
  Filter,
  ChevronRight,
  ArrowRight,
  Star,
  Activity,
  Clock,
  Globe,
  Lock
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../../components/ui/dropdown-menu';
import Layout from '../../components/Layout';

interface OrgCardProps {
  org: Organization;
}

const OrgCard = ({ org }: OrgCardProps) => {
  const getRoleIcon = () => {
    switch (org.role) {
      case 'owner':
        return <Crown className="w-3 h-3" />;
      case 'admin':
        return <Shield className="w-3 h-3" />;
      case 'member':
        return <UserCog className="w-3 h-3" />;
      default:
        return <Users className="w-3 h-3" />;
    }
  };

  const getRoleColor = () => {
    switch (org.role) {
      case 'owner':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'admin':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
  };

  return (
    <Link to={`/orgs/${org.name}`}>
      <Card className="hover:border-primary/50 transition-all duration-300 group cursor-pointer overflow-hidden hover:shadow-lg">
        <CardHeader className="p-0">
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                  <Building className="w-6 h-6" />
                </div>
                {org.isGithubSynced && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                    <Globe className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors text-lg">
                    {org.name}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${getRoleColor()}`}>
                    {getRoleIcon()}
                    {org.role}
                  </span>
                  {org.isPrivate ? (
                    <Lock className="w-3.5 h-3.5 text-muted-foreground/60" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-muted-foreground/60" />
                  )}
                </div>
                
                {org.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {org.description}
                  </p>
                )}
                
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Created {new Date(org.createdAt).toLocaleDateString(undefined, { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}</span>
                  </div>
                  {org.repoCount !== undefined && (
                    <div className="flex items-center gap-1">
                      <GitFork className="w-3 h-3" />
                      <span>{org.repoCount} repositories</span>
                    </div>
                  )}
                  {org.memberCount !== undefined && (
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{org.memberCount} members</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 ml-auto sm:ml-0">
              {org.lastActive && (
                <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
                  <Activity className="w-3 h-3 text-primary" />
                  <span>Active {new Date(org.lastActive).toLocaleDateString()}</span>
                </div>
              )}
              <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </div>
          
          {/* Stats Bar */}
          <div className="border-t bg-muted/30 px-4 py-2 flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <Star className="w-3 h-3 text-amber-500" />
              <span className="text-muted-foreground">Total stars: {org.totalStars || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <GitFork className="w-3 h-3 text-blue-500" />
              <span className="text-muted-foreground">Forks: {org.totalForks || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-emerald-500" />
              <span className="text-muted-foreground">Updated {org.updatedAt ? new Date(org.updatedAt).toLocaleDateString() : 'recently'}</span>
            </div>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
};

export default function OrgsList() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [filteredOrgs, setFilteredOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [page] = useState(1);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'admin' | 'member'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    fetchOrgs(page, 20)
      .then(res => {
        const orgsData = (res.orgs || []).map(org => {
          const localSync = localStorage.getItem(`orgSync-${org.name}`);
          if (localSync !== null) {
            org.isGithubSynced = localSync === 'true';
          } else {
            localStorage.setItem(`orgSync-${org.name}`, String(!!org.isGithubSynced));
          }
          return org;
        });
        setOrgs(orgsData);
        setFilteredOrgs(orgsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    setSearching(true);
    const timeout = setTimeout(() => {
      let filtered = orgs;
      
      // Apply search filter
      if (search) {
        filtered = filtered.filter(org => 
          org.name.toLowerCase().includes(search.toLowerCase()) ||
          org.description?.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      // Apply role filter
      if (roleFilter !== 'all') {
        filtered = filtered.filter(org => org.role === roleFilter);
      }
      
      setFilteredOrgs(filtered);
      setSearching(false);
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [search, roleFilter, orgs]);

  const stats = {
    total: orgs.length,
    owner: orgs.filter(o => o.role === 'owner').length,
    admin: orgs.filter(o => o.role === 'admin').length,
    member: orgs.filter(o => o.role === 'member').length,
    totalRepos: orgs.reduce((sum, org) => sum + (org.repoCount || 0), 0),
    totalMembers: orgs.reduce((sum, org) => sum + (org.memberCount || 0), 0),
  };

  return (
    <Layout>
      <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Organizations
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your organizations, collaborate with teams, and oversee repositories.
            </p>
          </div>
          <Button 
            onClick={() => navigate('/orgs/new')} 
            className="gap-2 shadow-lg hover:shadow-xl transition-all"
            size="lg"
          >
            <Plus className="w-4 h-4" /> 
            New Organization
          </Button>
        </div>

        {/* Stats Cards */}
        {!loading && orgs.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Organizations</p>
                </div>
                <Building className="w-8 h-8 text-primary/40" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.totalRepos}</p>
                  <p className="text-xs text-muted-foreground">Total Repositories</p>
                </div>
                <GitFork className="w-8 h-8 text-muted-foreground/30" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.totalMembers}</p>
                  <p className="text-xs text-muted-foreground">Team Members</p>
                </div>
                <Users className="w-8 h-8 text-muted-foreground/30" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.owner}</p>
                  <p className="text-xs text-muted-foreground">Owned Organizations</p>
                </div>
                <Crown className="w-8 h-8 text-amber-500/30" />
              </div>
            </Card>
          </div>
        )}

        {/* Filters & Search */}
        {!loading && orgs.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search organizations by name or description..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searching && (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin absolute right-3 top-2.5" />
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" /> 
                  {roleFilter === 'all' ? 'All Roles' : 
                   roleFilter === 'owner' ? 'Owner' : 
                   roleFilter === 'admin' ? 'Admin' : 'Member'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRoleFilter('all')}>
                  All Roles ({stats.total})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRoleFilter('owner')}>
                  <Crown className="w-3 h-3 mr-2 text-amber-500" /> 
                  Owner ({stats.owner})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRoleFilter('admin')}>
                  <Shield className="w-3 h-3 mr-2 text-blue-500" /> 
                  Admin ({stats.admin})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRoleFilter('member')}>
                  <UserCog className="w-3 h-3 mr-2 text-emerald-500" /> 
                  Member ({stats.member})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading your organizations...</p>
          </div>
        ) : filteredOrgs.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20 border-2 border-dashed rounded-xl">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mb-6">
              <Building className="w-10 h-10 text-primary/60" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No organizations yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Create an organization to group related repositories, manage team access, and collaborate more effectively.
            </p>
            <Button 
              variant="default" 
              onClick={() => navigate('/orgs/new')}
              className="gap-2"
              size="lg"
            >
              <Plus className="w-4 h-4" />
              Create Your First Organization
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        ) : (
          /* Organizations List */
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">
                Showing {filteredOrgs.length} of {orgs.length} organizations
              </p>
              {search && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSearch('')}
                  className="text-xs"
                >
                  Clear search
                </Button>
              )}
            </div>
            <div className="grid gap-4">
              {filteredOrgs.map(org => (
                <OrgCard key={org.name} org={org} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}