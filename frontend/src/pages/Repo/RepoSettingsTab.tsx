import { useEffect, useState } from 'react';
import type { TabBaseProps } from './types';
import type { Collaborator } from '../../types';
import {
  fetchCollaborators, fetchProtectedCh,
  addCollaborator, removeCollaborator,
  toggleProtection, deleteRepo,
} from '../../api';
import { Shield, Lock, Unlock, User, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

const RepoSettingsTab = ({
  owner, name, channels, userRole, navigate,
}: TabBaseProps) => {
  const [currCollab, setCurrCollab] = useState<Collaborator[]>([]);
  const [currProtectedCh, setCurrProtectedCh] = useState<string[]>([]);
  const [newCollab, setNewCollab] = useState('');
  const [newCollabRole, setNewCollabRole] = useState('developer');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchCollaborators(owner, name).then(setCurrCollab),
      fetchProtectedCh(owner, name).then(setCurrProtectedCh),
    ]).catch(console.error);
  }, []);

  const handleToggleProtection = async (channel: string) => {
    try {
      await toggleProtection(owner, name, channel);
      setCurrProtectedCh(prev =>
        prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
      );
    } catch { alert('Failed to toggle protection'); }
  };

  return (
    <div className="space-y-8 max-w-3xl animate-in fade-in duration-300">

      {/* Collaborators */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">Permissions</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repository Collaborators</CardTitle>
            <CardDescription>Grant users access to push or manage this repository.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Username to invite..."
                  value={newCollab}
                  onChange={e => setNewCollab(e.target.value)}
                  className="max-w-xs"
                />
                <select
                  className="h-9 bg-background border rounded-md  px-3 text-sm focus:ring-1 focus:ring-primary "
                  value={newCollabRole}
                  onChange={e => setNewCollabRole(e.target.value)}
                >
                  <option value="developer">Developer</option>
                  <option value="maintainer">Maintainer</option>
                </select>
                <Button
                  disabled={!newCollab}
                  onClick={() => {
                    addCollaborator(owner, name, newCollab.trim(), newCollabRole)
                      .then(res => {
                        if (res.error) { alert('Failed: ' + res.error); return; }
                        setCurrCollab(prev => [
                          ...prev.filter(c => c.username !== newCollab.trim()),
                          { username: newCollab.trim(), role: newCollabRole },
                        ]);
                        setNewCollab('');
                      })
                      .catch(err => alert('Error: ' + (err as Error).message));
                  }}
                >
                  Add User
                </Button>
              </div>
              <div className="border border-border/50 rounded-sm divide-y divide-border/50">
                {currCollab?.map(c => (
                  <div key={c.username} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 shrink-0 rounded-md  flex items-center justify-center bg-primary/10 text-primary">
                        <User className="w-4 h-4 " />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{c.username}</div>
                        <div className="text-xs text-muted-foreground capitalize">{c.role}</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        removeCollaborator(owner, name, c.username)
                          .then(res => {
                            if (res.error) alert('Failed: ' + res.error);
                            else setCurrCollab(prev => prev.filter(co => co.username !== c.username));
                          })
                          .catch(err => alert('Error: ' + (err as Error).message));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                {(!currCollab || currCollab.length === 0) && (
                  <div className="p-4 text-center text-sm text-muted-foreground">No collaborators added yet.</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Branch Protection */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Lock className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">Branch Protection</h2>
        </div>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Protected Channels</CardTitle>
            <CardDescription>
              Protecting a channel prevents non-maintainers from pushing directly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border border-border/50 rounded-sm divide-y divide-border/50">
              {channels.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                <div key={c.name} className="flex items-center justify-between p-4 transition-colors hover:bg-accent/5">
                  <div className="flex items-center gap-3">
                    {currProtectedCh?.includes(c.name)
                      ? <Lock className="w-4 h-4 text-primary" />
                      : <Unlock className="w-4 h-4 text-muted-foreground" />
                    }
                    <div>
                      <div className="font-mono text-sm font-bold">{c.name}</div>
                      {c.isCurrent && <span className="text-[10px] text-primary uppercase font-bold">Current</span>}
                    </div>
                  </div>
                  <Button
                    variant={currProtectedCh?.includes(c.name) ? 'destructive' : 'outline'}
                    size="sm" className="h-8"
                    onClick={() => handleToggleProtection(c.name)}
                  >
                    {currProtectedCh?.includes(c.name) ? 'Unprotect' : 'Protect'}
                  </Button>
                </div>
              ))}
              {channels.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">No channels found.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Danger Zone */}
      {userRole === 'owner' && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-xl font-bold">Danger Zone</h2>
          </div>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Delete this project</CardTitle>
              <CardDescription>Once you delete a project, there is no going back.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-4">
              <Input
                placeholder={`Type "${name}" to confirm`}
                className="max-w-xs border-destructive/20 focus-visible:ring-destructive"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
              />
              <Button
                variant="destructive"
                disabled={deleteConfirm !== name || deleteLoading}
                onClick={() => { setDeleteLoading(true); deleteRepo(owner, name).then(() => navigate('/')); }}
              >
                {deleteLoading ? 'Deleting...' : 'Delete Repository'}
              </Button>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
};

export default RepoSettingsTab;
