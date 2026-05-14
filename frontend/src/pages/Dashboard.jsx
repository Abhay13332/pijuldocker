import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRepos } from '../api';
import { 
  Book, 
  Lock, 
  Globe, 
  User, 
  GitBranch, 
  Compass, 
  Plus, 
  Search,
  Filter,
  Terminal
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';

const RepoCard = ({ repo }) => (
  <Card className="hover:border-primary/50 transition-colors group cursor-pointer overflow-hidden">
    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary/80 group-hover:text-primary group-hover:bg-primary/20 transition-all">
          <Book className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Link 
              to={`/repos/${repo.owner}/${repo.name}`} 
              className="font-semibold text-foreground hover:text-primary transition-colors"
            >
              <span className="text-muted-foreground font-normal">{repo.owner}/</span>{repo.name}
            </Link>
            <div className={`px-2 py-0.5 text-2xs font-bold uppercase rounded-full border ${
              repo.isPrivate 
                ? 'bg-muted text-muted-foreground border-border' 
                : 'bg-primary/5 text-muted-foreground border-border/50 group-hover:border-primary/30 group-hover:text-primary/80 transition-colors'
            }`}>
              {repo.isPrivate ? 'Private' : 'Public'}
            </div>
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
);

const Dashboard = () => {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    fetchRepos().then(data => {
      setRepos(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const filteredRepos = repos.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.owner.toLowerCase().includes(search.toLowerCase())
  );

  const myRepos = filteredRepos.filter(r => r.owner === currentUsername);
  const publicRepos = filteredRepos.filter(r => !r.isPrivate && r.owner !== currentUsername);

  if (loading) return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <GitBranch className="w-8 h-8 mb-4 opacity-20 animate-pulse" />
        <p>Fetching repositories...</p>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Projects</h1>
            <p className="text-muted-foreground mt-1">
              Manage your version control repositories and collaborations.
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link to="/new">
              <Plus className="w-4 h-4 mr-2" /> New Project
            </Link>
          </Button>
        </div>



        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filter by name or owner..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" /> All Projects
          </Button>
        </div>

        {/* Project Lists */}
        <div className="space-y-12">
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> My Projects
                <span className="bg-accent text-accent-foreground text-2xs px-2 py-0.5 rounded-full">
                  {myRepos.length}
                </span>
              </h2>
            </div>
            {myRepos.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-xl border-accent/20 text-muted-foreground">
                No personal projects found.
              </div>
            ) : (
              <div className="grid gap-3">
                {myRepos.map(repo => <RepoCard key={repo.name} repo={repo} />)}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Compass className="w-4 h-4 text-primary" /> Explore
                <span className="bg-accent text-accent-foreground text-2xs px-2 py-0.5 rounded-full">
                  {publicRepos.length}
                </span>
              </h2>
            </div>
            {publicRepos.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-xl border-accent/20 text-muted-foreground">
                No public projects to discover.
              </div>
            ) : (
              <div className="grid gap-3">
                {publicRepos.map(repo => <RepoCard key={repo.name} repo={repo} />)}
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
