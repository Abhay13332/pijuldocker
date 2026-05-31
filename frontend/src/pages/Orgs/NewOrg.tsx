import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrg, checkOrgNameAvailability } from '../../api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { 
  Building, 
  ArrowLeft, 
  Loader2, 
  Globe, 
  Users, 
  Link as LinkIcon,
  Image,
  X,
  AlertCircle,
  Check,
  Eye,
  Mail,
  MapPin,
  Twitter,
  Github,
  Sparkles,
  Shield,
  UserCog,
  Lock
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../../components/ui/card';

import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import Layout from '../../components/Layout';

interface FormData {
  name: string;
  displayName: string;
  description: string;
  website: string;
  location: string;
  email: string;
  twitter: string;
  github: string;
  visibility: 'public' | 'private';
  defaultMemberRole: 'member' | 'admin';
  allowMembersToCreateRepos: boolean;
}

export default function NewOrg() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    displayName: '',
    description: '',
    website: '',
    location: '',
    email: '',
    twitter: '',
    github: '',
    visibility: 'public',
    defaultMemberRole: 'member',
    allowMembersToCreateRepos: true,
  });
  
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get base URL dynamically from window.location
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      const { protocol, hostname, port } = window.location;
      const baseUrl = port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
      return baseUrl;
    }
    return 'https://your-domain.com';
  };

  const handleNameChange = async (value: string) => {
    const formatted = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData({ ...formData, name: formatted });
    
    if (formatted.length >= 3) {
      setCheckingName(true);
      try {
        const result = await checkOrgNameAvailability(formatted);
        setNameAvailable(result.available);
      } catch {
        setNameAvailable(false);
      } finally {
        setCheckingName(false);
      }
    } else {
      setNameAvailable(null);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Avatar size should be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      setAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const removeAvatar = () => {
    setAvatar(null);
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Organization name is required');
      return false;
    }
    if (formData.name.length < 3) {
      setError('Organization name must be at least 3 characters');
      return false;
    }
    if (formData.name.length > 40) {
      setError('Organization name must be less than 40 characters');
      return false;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.website && !/^https?:\/\//.test(formData.website)) {
      setError('Website URL should start with http:// or https://');
      return false;
    }
    return true;
  };

  // Convert form data to JSON object
  const formDataToJSON = () => {
    const jsonObject: any = {
      name: formData.name,
      displayName: formData.displayName,
      description: formData.description,
      website: formData.website,
      location: formData.location,
      email: formData.email,
      twitter: formData.twitter,
      github: formData.github,
      visibility: formData.visibility,
      defaultMemberRole: formData.defaultMemberRole,
      allowMembersToCreateRepos: formData.allowMembersToCreateRepos,
    };

    // If avatar exists, convert to base64 or handle separately
    if (avatar) {
      // Option 1: Send as base64 string
      const reader = new FileReader();
      reader.onloadend = () => {
        jsonObject.avatar = reader.result;
      };
      reader.readAsDataURL(avatar);
      
      // Option 2: Keep as File object (will be handled by FormData)
      // For FormData approach, we keep avatar as File
    }

    return jsonObject;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const jsonData = formDataToJSON();
      const res = await createOrg(jsonData);
      
      if (res.error) {
        setError(res.error);
        setSuccess(null);
      } else {
        setSuccess('Organization created successfully!');
        setTimeout(() => {
          navigate(`/orgs/${res.name}`);
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create organization');
      setSuccess(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container max-w-5xl mx-auto px-4 py-8 md:py-12">
          {/* Header Section */}
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/orgs')}
              className="mb-6 -ml-2 hover:bg-primary/10 transition-all duration-300 group"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> 
              Back to Organizations
            </Button>
            
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
                <Sparkles className="w-4 h-4" />
                <span>Create New Organization</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent mb-3">
                Bring Your Team Together
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto md:mx-0">
                Create an organization to manage repositories, collaborate with teams, and control access permissions.
              </p>
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 text-sm text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2 fade-in duration-300">
              <Check className="w-5 h-5" />
              <span className="font-medium">{success}</span>
            </div>
          )}

          {/* Main Form Card */}
          <Card className="border-0 shadow-xl bg-card/50 backdrop-blur-sm">
            <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-transparent">
              <CardTitle className="text-2xl flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Building className="w-6 h-6 text-primary" />
                </div>
                Organization Configuration
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Fill in the details below to set up your organization workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              <form onSubmit={handleCreate} className="space-y-8">
                {/* Two Column Layout for Basic Info */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column - Avatar & Basic Info */}
                  <div className="space-y-6">
                    {/* Avatar Upload */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Image className="w-4 h-4 text-primary" />
                        Organization Avatar
                      </Label>
                      <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-muted/30 rounded-xl border-2 border-dashed border-muted-foreground/20">
                        <div className="relative group">
                          {avatarPreview ? (
                            <div className="relative">
                              <img 
                                src={avatarPreview} 
                                alt="Avatar preview" 
                                className="w-28 h-28 rounded-2xl object-cover border-2 border-primary/30 shadow-lg"
                              />
                              <button
                                type="button"
                                onClick={removeAvatar}
                                className="absolute -top-2 -right-2 p-1.5 bg-destructive text-white rounded-full hover:bg-destructive/90 transition-all transform hover:scale-110 shadow-lg"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center border-2 border-dashed border-primary/40 shadow-inner">
                              <Building className="w-12 h-12 text-primary/60" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="gap-2 w-full sm:w-auto"
                          >
                            <Image className="w-4 h-4" />
                            Choose Avatar
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="hidden"
                          />
                          <p className="text-xs text-muted-foreground mt-3">
                            SVG, PNG, or JPG (max. 5MB). Recommended: 128x128px
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Display Name */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Building className="w-4 h-4 text-primary" />
                        Display Name
                      </Label>
                      <Input
                        value={formData.displayName}
                        onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                        placeholder="ACME Corporation"
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        Your organization's display name (e.g., "ACME Corp" instead of "acme-corp")
                      </p>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Description</Label>
                      <Textarea
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Tell us what your organization is about..."
                        rows={4}
                        className="resize-none"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Brief description of your organization</span>
                        <span className={formData.description.length > 400 ? 'text-destructive' : ''}>
                          {formData.description.length}/500
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - URL & Visibility */}
                  <div className="space-y-6">
                    {/* Organization URL */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Globe className="w-4 h-4 text-primary" />
                        Organization URL <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <Input
                          value={formData.name}
                          onChange={e => handleNameChange(e.target.value)}
                          placeholder="acme-corp"
                          className="pl-9 h-11"
                          required
                        />
                        {checkingName && (
                          <Loader2 className="absolute right-3 top-2.5 w-5 h-5 animate-spin text-muted-foreground" />
                        )}
                        {nameAvailable === true && !checkingName && formData.name && (
                          <Check className="absolute right-3 top-2.5 w-5 h-5 text-emerald-500" />
                        )}
                        {nameAvailable === false && !checkingName && formData.name && (
                          <X className="absolute right-3 top-2.5 w-5 h-5 text-destructive" />
                        )}
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <code className="text-xs text-muted-foreground break-all">
                          {getBaseUrl()}/{formData.name || 'organization-name'}
                        </code>
                      </div>
                      <p className="text-xs text-muted-foreground space-y-1">
                        <span>✓ Lowercase letters, numbers, and hyphens only</span><br />
                        <span>✓ 3-40 characters</span><br />
                        <span className="text-amber-600 dark:text-amber-400">⚠️ URL cannot be changed after creation</span>
                      </p>
                    </div>

                    {/* Visibility */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Eye className="w-4 h-4 text-primary" />
                        Visibility
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div 
                          className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            formData.visibility === 'public' 
                              ? 'border-primary bg-primary/5 shadow-md' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setFormData({ ...formData, visibility: 'public' })}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded-lg ${
                              formData.visibility === 'public' ? 'bg-primary/20' : 'bg-muted'
                            }`}>
                              <Globe className={`w-4 h-4 ${
                                formData.visibility === 'public' ? 'text-primary' : 'text-muted-foreground'
                              }`} />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-sm">Public</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Visible to everyone on the platform
                              </div>
                            </div>
                          </div>
                          {formData.visibility === 'public' && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4 text-primary" />
                            </div>
                          )}
                        </div>

                        <div 
                          className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            formData.visibility === 'private' 
                              ? 'border-primary bg-primary/5 shadow-md' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setFormData({ ...formData, visibility: 'private' })}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded-lg ${
                              formData.visibility === 'private' ? 'bg-primary/20' : 'bg-muted'
                            }`}>
                              <Lock className={`w-4 h-4 ${
                                formData.visibility === 'private' ? 'text-primary' : 'text-muted-foreground'
                              }`} />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-sm">Private</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Only visible to organization members
                              </div>
                            </div>
                          </div>
                          {formData.visibility === 'private' && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4 text-primary" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile & Links Section */}
                <div className="pt-6 border-t">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <LinkIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Profile & Links</h3>
                      <p className="text-sm text-muted-foreground">Optional information to help others discover your organization</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        Location
                      </Label>
                      <Input
                        value={formData.location}
                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                        placeholder="San Francisco, CA"
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        Contact Email
                      </Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="contact@acme.com"
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <LinkIcon className="w-4 h-4 text-muted-foreground" />
                        Website
                      </Label>
                      <Input
                        value={formData.website}
                        onChange={e => setFormData({ ...formData, website: e.target.value })}
                        placeholder="https://acme.com"
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Twitter className="w-4 h-4 text-sky-500" />
                        Twitter
                      </Label>
                      <Input
                        value={formData.twitter}
                        onChange={e => setFormData({ ...formData, twitter: e.target.value })}
                        placeholder="https://twitter.com/acme"
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Github className="w-4 h-4" />
                        GitHub
                      </Label>
                      <Input
                        value={formData.github}
                        onChange={e => setFormData({ ...formData, github: e.target.value })}
                        placeholder="https://github.com/acme"
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>

                {/* Permissions Section */}
                <div className="pt-6 border-t">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Permissions & Access</h3>
                      <p className="text-sm text-muted-foreground">Control member permissions and organization settings</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Default Member Role */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">Default Member Role</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div 
                          className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            formData.defaultMemberRole === 'member' 
                              ? 'border-primary bg-primary/5 shadow-md' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setFormData({ ...formData, defaultMemberRole: 'member' })}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded-lg ${
                              formData.defaultMemberRole === 'member' ? 'bg-primary/20' : 'bg-muted'
                            }`}>
                              <Users className={`w-4 h-4 ${
                                formData.defaultMemberRole === 'member' ? 'text-primary' : 'text-muted-foreground'
                              }`} />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-sm">Member</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Can view repositories, create issues, and submit pull requests
                              </div>
                            </div>
                          </div>
                          {formData.defaultMemberRole === 'member' && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4 text-primary" />
                            </div>
                          )}
                        </div>

                        <div 
                          className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            formData.defaultMemberRole === 'admin' 
                              ? 'border-primary bg-primary/5 shadow-md' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setFormData({ ...formData, defaultMemberRole: 'admin' })}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded-lg ${
                              formData.defaultMemberRole === 'admin' ? 'bg-primary/20' : 'bg-muted'
                            }`}>
                              <UserCog className={`w-4 h-4 ${
                                formData.defaultMemberRole === 'admin' ? 'text-primary' : 'text-muted-foreground'
                              }`} />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-sm">Admin</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Full access to all organization settings and member management
                              </div>
                            </div>
                          </div>
                          {formData.defaultMemberRole === 'admin' && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4 text-primary" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Member Permissions */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold">Allow members to create repositories</Label>
                        <p className="text-xs text-muted-foreground">
                          When enabled, members can create new repositories within the organization
                        </p>
                      </div>
                      <Switch
                        checked={formData.allowMembersToCreateRepos}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, allowMembersToCreateRepos: checked })
                        }
                      />
                    </div>

                    {/* Info Alert */}
                    <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Permission Settings Note</p>
                          <p className="text-xs text-muted-foreground">
                            These settings can be adjusted later in the organization settings page. 
                            Organization admins can override these permissions for specific members.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="p-4 text-sm text-destructive border border-destructive/20 bg-destructive/10 rounded-xl flex items-start gap-2 animate-in slide-in-from-top-2 fade-in duration-300">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span className="font-medium">{error}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate('/orgs')}
                    className="h-11 px-6 order-2 sm:order-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!formData.name.trim() || loading || nameAvailable === false}
                    className="h-11 px-8 gap-2 order-1 sm:order-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating Organization...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Create Organization
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}