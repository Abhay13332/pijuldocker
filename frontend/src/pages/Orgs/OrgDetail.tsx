import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchOrgRepos, fetchOrgMembers, addOrgMember, removeOrgMember, updateMemberRole, updateMemberPermissions, fetchOrgs } from '../../api';
import { OrgMember, PaginatedRepos, Organization } from '../../types';
import { 
  Building, Users, Book, Shield, Loader2, Plus, Trash2, 
  Lock, Globe, Github, Eye, Edit2, Trash, UserPlus, UserMinus, 
  Settings, Key, GitBranch, Check
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import Layout from '../../components/Layout';

// Permission definitions
interface Permission {
  id: string;
  name: string;
  description: string;
  icon: any;
  defaultValue: {
    member: boolean;
    admin: boolean;
    owner: boolean;
  };
}

const permissions: Permission[] = [
  {
    id: 'view_repos',
    name: 'View Repositories',
    description: 'Can view all organization repositories',
    icon: Eye,
    defaultValue: { member: true, admin: true, owner: true }
  },
  {
    id: 'create_repos',
    name: 'Create Repositories',
    description: 'Can create new repositories',
    icon: Plus,
    defaultValue: { member: false, admin: true, owner: true }
  },
  {
    id: 'edit_repos',
    name: 'Edit Repositories',
    description: 'Can edit repository settings and content',
    icon: Edit2,
    defaultValue: { member: false, admin: true, owner: true }
  },
  {
    id: 'delete_repos',
    name: 'Delete Repositories',
    description: 'Can delete repositories',
    icon: Trash,
    defaultValue: { member: false, admin: true, owner: true }
  },
  {
    id: 'view_members',
    name: 'View Members',
    description: 'Can view organization members list',
    icon: Users,
    defaultValue: { member: true, admin: true, owner: true }
  },
  {
    id: 'add_members',
    name: 'Add Members',
    description: 'Can invite/add new members to organization',
    icon: UserPlus,
    defaultValue: { member: false, admin: true, owner: true }
  },
  {
    id: 'remove_members',
    name: 'Remove Members',
    description: 'Can remove members from organization',
    icon: UserMinus,
    defaultValue: { member: false, admin: true, owner: true }
  },
  {
    id: 'manage_roles',
    name: 'Manage Roles',
    description: 'Can change member roles and permissions',
    icon: Key,
    defaultValue: { member: false, admin: true, owner: true }
  },
  {
    id: 'manage_settings',
    name: 'Manage Settings',
    description: 'Can change organization settings',
    icon: Settings,
    defaultValue: { member: false, admin: true, owner: true }
  },
  {
    id: 'create_branches',
    name: 'Create Branches',
    description: 'Can create and manage branches',
    icon: GitBranch,
    defaultValue: { member: true, admin: true, owner: true }
  }
];

export default function OrgDetail() {
  const { orgName } = useParams<{ orgName: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'repos' | 'members' | 'permissions' | 'settings'>('repos');
  const [expandedPermissions, setExpandedPermissions] = useState<string[]>([]);

  // Org State
  const [org, setOrg] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

  // Repos state
  const [reposData, setReposData] = useState<PaginatedRepos | null>(null);
  const [reposLoading, setReposLoading] = useState(false);

  // Members state
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  
  // Add member state
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'member' | 'admin' | 'owner'>('member');
  const [addingMember, setAddingMember] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permission state
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [customPermissions, setCustomPermissions] = useState<Record<string, string[]>>({});
  const [updatingPermissions, setUpdatingPermissions] = useState(false);

  const currentUser = localStorage.getItem('username');
  const myRole = members.find(m => m.username === currentUser)?.role || 'member';
  const canManage = myRole === 'owner' || myRole === 'admin';

  useEffect(() => {
    if (!orgName) return;
    setReposLoading(true);
    fetchOrgRepos(orgName, 1, 20)
      .then(setReposData)
      .catch(console.error)
      .finally(() => setReposLoading(false));

    loadMembers();
    loadOrgDetails();
  }, [orgName]);

  const loadOrgDetails = () => {
    if (!orgName) return;
    setOrgLoading(true);
    fetchOrgs()
      .then(res => {
        const found = res.orgs?.find(o => o.name === orgName);
        if (found) {
          // Retrieve connected state from local storage or fallback to API and synchronize
          const localSync = localStorage.getItem(`orgSync-${orgName}`);
          if (localSync !== null) {
            found.isGithubSynced = localSync === 'true';
          } else {
            const connectedState = !!found.isGithubSynced;
            localStorage.setItem(`orgSync-${orgName}`, String(connectedState));
            found.isGithubSynced = connectedState;
          }
          setOrg(found);
        }
      })
      .catch(console.error)
      .finally(() => setOrgLoading(false));
  };

  const handleConnectGitHub = () => {
    localStorage.setItem(`orgSync-${orgName}`, 'true');
    const gitUrl = import.meta.env.VITE_GITURL || 'https://github.com/login/oauth/authorize?client_id=dummy';
    const separator = gitUrl.includes('?') ? '&' : '?';
    window.location.href = `${gitUrl}${separator}state=org-${orgName}`;
  };

  const handleDisconnectGitHub = () => {
    localStorage.setItem(`orgSync-${orgName}`, 'false');
    if (org) {
      setOrg({ ...org, isGithubSynced: false });
    }
  };

  const loadMembers = () => {
    if (!orgName) return;
    setMembersLoading(true);
    fetchOrgMembers(orgName)
      .then(res => {
        setMembers(res.members || []);
        // Initialize custom permissions
        const perms: Record<string, string[]> = {};
        res.members?.forEach((member: OrgMember) => {
          perms[member.username] = member.customPermissions || [];
        });
        setCustomPermissions(perms);
      })
      .catch(console.error)
      .finally(() => setMembersLoading(false));
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !newMemberName.trim()) return;
    setAddingMember(true);
    setError(null);
    try {
      const res = await addOrgMember(orgName, newMemberName.trim(), newMemberRole);
      if (res.error) {
        setError(res.error);
      } else {
        setNewMemberName('');
        loadMembers();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (username: string) => {
    if (!orgName || !confirm(`Remove ${username} from ${orgName}?`)) return;
    try {
      const res = await removeOrgMember(orgName, username);
      if (!res.error) loadMembers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateMemberRole = async (username: string, newRole: string) => {
    if (!orgName) return;
    try {
      const res = await updateMemberRole(orgName, username, newRole);
      if (!res.error) loadMembers();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePermission = (username: string, permissionId: string) => {
    setCustomPermissions(prev => {
      const userPerms = prev[username] || [];
      const newPerms = userPerms.includes(permissionId)
        ? userPerms.filter(p => p !== permissionId)
        : [...userPerms, permissionId];
      return { ...prev, [username]: newPerms };
    });
  };

  const savePermissions = async (username: string) => {
    if (!orgName) return;
    setUpdatingPermissions(true);
    try {
      await updateMemberPermissions(orgName, username, customPermissions[username] || []);
      alert(`Permissions saved for ${username}`);
      setSelectedMember(null);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingPermissions(false);
    }
  };



  const toggleExpand = (permissionId: string) => {
    setExpandedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  if (!orgName) return null;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4 border-b pb-6">
          <div className="w-16 h-16 bg-primary/10 flex items-center justify-center rounded-xl border border-primary/20">
            <Building className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{orgName}</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Shield className="w-4 h-4" /> 
              Your role: <span className="font-semibold uppercase text-xs">{myRole}</span>
            </p>
          </div>
        </div>

        <div className="flex border-b">
          <button
            className={`px-4 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'repos' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('repos')}
          >
            <Book className="w-4 h-4" /> Repositories
          </button>
          <button
            className={`px-4 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'members' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('members')}
          >
            <Users className="w-4 h-4" /> Members
          </button>
          {(myRole === 'owner' || myRole === 'admin') && (
            <>
              <button
                className={`px-4 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'permissions' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab('permissions')}
              >
                <Key className="w-4 h-4" /> Permissions
              </button>
              <button
                className={`px-4 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab('settings')}
              >
                <Settings className="w-4 h-4" /> Settings
              </button>
            </>
          )}
        </div>

        {activeTab === 'repos' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Organization Repositories</h2>
              <Button size="sm" onClick={() => navigate('/new')} className="gap-2">
                <Plus className="w-4 h-4" /> New Repository
              </Button>
            </div>
            
            {reposLoading ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : !reposData || reposData.repositories.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed rounded-xl">
                <Book className="w-12 h-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                <h3 className="text-lg font-semibold">No repositories</h3>
                <p className="text-muted-foreground mt-1 mb-4">This organization doesn't have any repositories yet.</p>
                <Button variant="outline" onClick={() => navigate('/new')}>Create one now</Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {reposData.repositories.map(repo => (
                  <Link key={repo.id} to={`/repos/${orgName}/${repo.name}`}>
                    <Card className="hover:border-primary/50 transition-colors group cursor-pointer overflow-hidden">
                      <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary/80 group-hover:text-primary group-hover:bg-primary/20 transition-all shrink-0">
                            <Book className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                <span className="text-muted-foreground font-normal">{orgName}/</span>{repo.name}
                              </span>
                              {repo.isPrivate ? (
                                <Lock className="w-3 h-3 text-muted-foreground/60" />
                              ) : (
                                <Globe className="w-3 h-3 text-muted-foreground/60" />
                              )}
                              {repo.isGithubSynced && (
                                <Github className="w-3.5 h-3.5 text-primary/80" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <span>Created {new Date(repo.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <div className="text-xs text-muted-foreground">Last updated</div>
                            <div className="text-xs font-medium">2 days ago</div>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Members</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                {membersLoading ? (
                  <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : members.length === 0 ? (
                  <div className="text-center py-10 border rounded-xl">No members found.</div>
                ) : (
                  <div className="border rounded-xl divide-y bg-card">
                    {members.map(member => (
                      <div key={member.username} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-lg">
                            {member.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold">{member.username}</div>
                            <div className="text-xs text-muted-foreground">Joined {new Date(member.joinedAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {canManage && member.username !== currentUser && (
                            <select
                              className="text-xs border rounded px-2 py-1 bg-background"
                              value={member.role}
                              onChange={(e) => handleUpdateMemberRole(member.username, e.target.value)}
                              disabled={myRole !== 'owner' && member.role === 'owner'}
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                              {myRole === 'owner' && <option value="owner">Owner</option>}
                            </select>
                          )}
                          {member.role === 'owner' && (
                            <Badge variant="default" className="bg-primary/10 text-primary">Owner</Badge>
                          )}
                          {member.role === 'admin' && (
                            <Badge variant="secondary">Admin</Badge>
                          )}
                          {member.role === 'member' && (
                            <Badge variant="outline">Member</Badge>
                          )}
                          {canManage && member.username !== currentUser && (
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleRemoveMember(member.username)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canManage && (
                <div className="md:col-span-1">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Add Member</CardTitle>
                      <CardDescription>Invite someone to this organization</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleAddMember} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium">Username</label>
                          <Input 
                            placeholder="e.g. alice" 
                            value={newMemberName} 
                            onChange={e => setNewMemberName(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium">Role</label>
                          <select 
                            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={newMemberRole}
                            onChange={e => setNewMemberRole(e.target.value as 'member' | 'admin' | 'owner')}
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            {myRole === 'owner' && <option value="owner">Owner</option>}
                          </select>
                        </div>
                        
                        {error && <div className="text-xs text-destructive">{error}</div>}
                        
                        <Button type="submit" className="w-full" size="sm" disabled={!newMemberName.trim() || addingMember}>
                          {addingMember ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                          Add User
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'permissions' && (myRole === 'owner' || myRole === 'admin') && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  Permission Policies
                </CardTitle>
                <CardDescription>
                  Define what each role can do within the organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Role headers */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg font-semibold text-sm">
                    <div>Permission</div>
                    <div className="text-center">Member</div>
                    <div className="text-center">Admin</div>
                    <div className="text-center">Owner</div>
                  </div>

                  {/* Permission list */}
                  {permissions.map(permission => {
                    const PermissionIcon = permission.icon;
                    const isExpanded = expandedPermissions.includes(permission.id);
                    
                    return (
                      <div key={permission.id} className="border rounded-lg overflow-hidden">
                        <div 
                          className="p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => toggleExpand(permission.id)}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <PermissionIcon className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <div className="font-semibold text-sm">{permission.name}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{permission.description}</div>
                              </div>
                            </div>
                            <div className="text-center">
                              {permission.defaultValue.member ? (
                                <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">✓ Allowed</Badge>
                              ) : (
                                <Badge variant="destructive" className="bg-destructive/10">✗ Not allowed</Badge>
                              )}
                            </div>
                            <div className="text-center">
                              {permission.defaultValue.admin ? (
                                <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">✓ Allowed</Badge>
                              ) : (
                                <Badge variant="destructive" className="bg-destructive/10">✗ Not allowed</Badge>
                              )}
                            </div>
                            <div className="text-center">
                              {permission.defaultValue.owner ? (
                                <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">✓ Allowed</Badge>
                              ) : (
                                <Badge variant="destructive" className="bg-destructive/10">✗ Not allowed</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="p-4 border-t bg-muted/20">
                            <div className="text-xs text-muted-foreground space-y-2">
                              <p className="font-medium">Description:</p>
                              <p>{permission.description}</p>
                              <p className="font-medium mt-2">Applies to:</p>
                              <ul className="list-disc list-inside space-y-1">
                                <li>Members: {permission.defaultValue.member ? 'Can perform this action' : 'Cannot perform this action'}</li>
                                <li>Admins: {permission.defaultValue.admin ? 'Can perform this action' : 'Cannot perform this action'}</li>
                                <li>Owners: {permission.defaultValue.owner ? 'Can perform this action' : 'Cannot perform this action'}</li>
                              </ul>
                              {!permission.defaultValue.member && permission.id === 'create_repos' && (
                                <div className="mt-2 p-2 bg-amber-500/10 rounded text-amber-600 dark:text-amber-400">
                                  💡 Members can be granted this permission individually through custom permissions
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Custom Permissions Section for Members */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  Custom Member Permissions
                </CardTitle>
                <CardDescription>
                  Grant additional permissions to specific members beyond their default role
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {members.filter(m => m.role === 'member').length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No member users to configure custom permissions for
                    </div>
                  ) : (
                    members.filter(m => m.role === 'member').map(member => (
                      <div key={member.username} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-bold">
                              {member.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold">{member.username}</div>
                              <div className="text-xs text-muted-foreground">Member</div>
                            </div>
                          </div>
                          {selectedMember?.username === member.username ? (
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => setSelectedMember(null)}
                              >
                                Cancel
                              </Button>
                              <Button 
                                size="sm" 
                                onClick={() => savePermissions(member.username)}
                                disabled={updatingPermissions}
                              >
                                {updatingPermissions ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => setSelectedMember(member)}
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              Configure Permissions
                            </Button>
                          )}
                        </div>
                        
                        {selectedMember?.username === member.username && (
                          <div className="border-t pt-4 mt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {permissions.filter(p => !p.defaultValue.member).map(permission => {
                                const PermissionIcon = permission.icon;
                                const isGranted = customPermissions[member.username]?.includes(permission.id) || false;
                                
                                return (
                                  <div 
                                    key={permission.id}
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
                                    onClick={() => togglePermission(member.username, permission.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <PermissionIcon className="w-4 h-4 text-muted-foreground" />
                                      <div>
                                        <div className="text-sm font-medium">{permission.name}</div>
                                        <div className="text-xs text-muted-foreground">{permission.description}</div>
                                      </div>
                                    </div>
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                      isGranted ? 'bg-primary border-primary' : 'border-muted-foreground'
                                    }`}>
                                      {isGranted && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-4 p-3 bg-primary/5 rounded-lg text-xs text-muted-foreground">
                              <p>⚠️ Custom permissions override the default member restrictions. These grants are specific to this member only.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'settings' && (myRole === 'owner' || myRole === 'admin') && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {orgLoading ? (
              <Card className="border-border/50 p-12 flex justify-center items-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </Card>
            ) : (
              <>
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5 text-primary" />
                      Organization Settings
                    </CardTitle>
                    <CardDescription>
                      Configure metadata, integrations, and connection properties for {orgName}.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className={`border-border/50 transition-all duration-300 ${org?.isGithubSynced ? 'border-emerald-500/20 bg-emerald-500/5' : 'bg-gradient-to-br from-background via-background to-accent/5'}`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center relative shrink-0 ${org?.isGithubSynced ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                          <Github className={`w-6 h-6 ${org?.isGithubSynced ? 'animate-pulse' : ''}`} />
                          {org?.isGithubSynced && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-background flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg">GitHub Sync Integration</CardTitle>
                          <CardDescription>
                            {org?.isGithubSynced ? `Connected to GitHub mirrors` : 'Establish mirror linking for the entire organization'}
                          </CardDescription>
                        </div>
                      </div>
                      {org?.isGithubSynced && (
                        <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-2xs font-bold uppercase rounded-full">
                          Synced
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Connecting {orgName} to GitHub enables automated mirror repository creation, 1-to-1 sync of branches, continuous integration hooks, and pull request forwarding from the cluster to external developers.
                    </p>

                    {org?.isGithubSynced ? (
                      <div className="bg-background/40 backdrop-blur-sm rounded-xl p-4 border border-border/30 text-xs space-y-2 text-muted-foreground leading-relaxed">
                        <p className="font-semibold text-foreground">Integration Capabilities Enabled:</p>
                        <ul className="list-disc list-inside space-y-1.5 ml-1">
                          <li>Automatic mirroring for all repositories inside <strong>{orgName}</strong></li>
                          <li>1:1 Sync mapping between Pijul channels and GitHub branches</li>
                          <li>Pull request discussions automatically synchronized across mirrors</li>
                        </ul>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3 pt-2">
                        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-border/30 bg-muted/20">
                          <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-semibold">1:1 Org Mapping</h4>
                            <p className="text-2xs text-muted-foreground mt-0.5">Strictly binds this organization to a single GitHub organization.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-border/30 bg-muted/20">
                          <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-semibold">Admin Scopes Only</h4>
                            <p className="text-2xs text-muted-foreground mt-0.5">Authorization is scoped cleanly only to manage repositories.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="bg-muted/30 border-t p-4 flex justify-end">
                    {org?.isGithubSynced ? (
                      <Button 
                        variant="ghost" 
                        onClick={handleDisconnectGitHub} 
                        className="h-9 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                      >
                        Disconnect GitHub Link
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleConnectGitHub} 
                        className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-white font-medium shadow-md shadow-black/10 dark:shadow-white/5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 h-9 px-4 text-xs gap-2"
                      >
                        <Github className="w-4 h-4" /> Link GitHub Organization
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}