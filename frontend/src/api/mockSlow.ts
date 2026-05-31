/**
 * mockSlow.ts — Drop-in replacement for src/api/index.ts
 *
 * Identical to mock.ts but every call sleeps for 2 s first,
 * letting you verify loading spinners, skeleton screens, etc.
 *
 * To use: change the import in any tab file from
 *   import { ... } from '../../api';
 * to
 *   import { ... } from '../../api/mockSlow';
 */
import * as instant from './mock';

const sleep = (ms = 2000) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Wrap every exported function with a 2 s delay
export const login             = async (...a: Parameters<typeof instant.login>)             => { await sleep(); return instant.login(...a); };
export const register          = async (...a: Parameters<typeof instant.register>)          => { await sleep(); return instant.register(...a); };
export const logout            =        instant.logout;   // sync — no sleep needed

export const fetchProfile           = async (...a: Parameters<typeof instant.fetchProfile>)           => { await sleep(); return instant.fetchProfile(...a); };
export const addSshKey              = async (...a: Parameters<typeof instant.addSshKey>)              => { await sleep(); return instant.addSshKey(...a); };
export const deleteSshKey           = async (...a: Parameters<typeof instant.deleteSshKey>)           => { await sleep(); return instant.deleteSshKey(...a); };

export const fetchRepos             = async (...a: Parameters<typeof instant.fetchRepos>)             => { await sleep(); return instant.fetchRepos(...a); };
export const fetchPersonalRepos     = async (...a: Parameters<typeof instant.fetchPersonalRepos>)     => { await sleep(); return instant.fetchPersonalRepos(...a); };
export const fetchCollabRepos       = async (...a: Parameters<typeof instant.fetchCollabRepos>)       => { await sleep(); return instant.fetchCollabRepos(...a); };
export const fetchPublicRepos       = async (...a: Parameters<typeof instant.fetchPublicRepos>)       => { await sleep(); return instant.fetchPublicRepos(...a); };
export const searchRepos            = async (...a: Parameters<typeof instant.searchRepos>)            => { await sleep(); return instant.searchRepos(...a); };
export const fetchRepoMeta          = async (...a: Parameters<typeof instant.fetchRepoMeta>)          => { await sleep(); return instant.fetchRepoMeta(...a); };
export const createRepo             = async (...a: Parameters<typeof instant.createRepo>)             => { await sleep(); return instant.createRepo(...a); };
export const fetchGitRepos          = async (...a: Parameters<typeof instant.fetchGitRepos>)          => { await sleep(); return instant.fetchGitRepos(...a); };
export const deleteRepo             = async (...a: Parameters<typeof instant.deleteRepo>)             => { await sleep(); return instant.deleteRepo(...a); };
export const forkRepo               = async (...a: Parameters<typeof instant.forkRepo>)               => { await sleep(); return instant.forkRepo(...a); };

export const fetchRepoLog           = async (...a: Parameters<typeof instant.fetchRepoLog>)           => { await sleep(); return instant.fetchRepoLog(...a); };
export const fetchRepoTree          = async (...a: Parameters<typeof instant.fetchRepoTree>)          => { await sleep(); return instant.fetchRepoTree(...a); };
export const fetchFileContent       = async (...a: Parameters<typeof instant.fetchFileContent>)       => { await sleep(); return instant.fetchFileContent(...a); };
export const fetchPatchDetail       = async (...a: Parameters<typeof instant.fetchPatchDetail>)       => { await sleep(); return instant.fetchPatchDetail(...a); };

export const fetchChannels          = async (...a: Parameters<typeof instant.fetchChannels>)          => { await sleep(); return instant.fetchChannels(...a); };
export const switchChannel          = async (...a: Parameters<typeof instant.switchChannel>)          => { await sleep(); return instant.switchChannel(...a); };

export const fetchRepoGitInfo       = async (...a: Parameters<typeof instant.fetchRepoGitInfo>)       => { await sleep(); return instant.fetchRepoGitInfo(...a); };
export const fetchStandardChannels   = async (...a: Parameters<typeof instant.fetchStandardChannels>)   => { await sleep(); return instant.fetchStandardChannels(...a); };
export const fetchGitRemoteBranches  = async (...a: Parameters<typeof instant.fetchGitRemoteBranches>)  => { await sleep(); return instant.fetchGitRemoteBranches(...a); };
export const syncChannelToGit       = async (...a: Parameters<typeof instant.syncChannelToGit>)       => { await sleep(); return instant.syncChannelToGit(...a); };
export const addStandardChannel     = async (...a: Parameters<typeof instant.addStandardChannel>)     => { await sleep(); return instant.addStandardChannel(...a); };
export const removeStandardChannel  = async (...a: Parameters<typeof instant.removeStandardChannel>)  => { await sleep(); return instant.removeStandardChannel(...a); };
export const fetchSyncHistory       = async (...a: Parameters<typeof instant.fetchSyncHistory>)       => { await sleep(); return instant.fetchSyncHistory(...a); };

export const fetchCollaborators     = async (...a: Parameters<typeof instant.fetchCollaborators>)     => { await sleep(); return instant.fetchCollaborators(...a); };
export const addCollaborator        = async (...a: Parameters<typeof instant.addCollaborator>)        => { await sleep(); return instant.addCollaborator(...a); };
export const removeCollaborator     = async (...a: Parameters<typeof instant.removeCollaborator>)     => { await sleep(); return instant.removeCollaborator(...a); };

export const fetchDiscussions       = async (...a: Parameters<typeof instant.fetchDiscussions>)       => { await sleep(); return instant.fetchDiscussions(...a); };
export const fetchDiscussion        = async (...a: Parameters<typeof instant.fetchDiscussion>)        => { await sleep(); return instant.fetchDiscussion(...a); };
export const createDiscussion       = async (...a: Parameters<typeof instant.createDiscussion>)       => { await sleep(); return instant.createDiscussion(...a); };
export const addComment             = async (...a: Parameters<typeof instant.addComment>)             => { await sleep(); return instant.addComment(...a); };
export const mergeDiscussion        = async (...a: Parameters<typeof instant.mergeDiscussion>)        => { await sleep(); return instant.mergeDiscussion(...a); };
export const closeDiscussion        = async (...a: Parameters<typeof instant.closeDiscussion>)        => { await sleep(); return instant.closeDiscussion(...a); };
export const deleteDiscussion       = async (...a: Parameters<typeof instant.deleteDiscussion>)       => { await sleep(); return instant.deleteDiscussion(...a); };
export const getMergeConflicts      = async (...a: Parameters<typeof instant.getMergeConflicts>)      => { await sleep(); return instant.getMergeConflicts(...a); };

export const fetchProtectedCh       = async (...a: Parameters<typeof instant.fetchProtectedCh>)       => { await sleep(); return instant.fetchProtectedCh(...a); };
export const toggleProtection       = async (...a: Parameters<typeof instant.toggleProtection>)       => { await sleep(); return instant.toggleProtection(...a); };

export const fetchOrgs              = async (...a: Parameters<typeof instant.fetchOrgs>)              => { await sleep(); return instant.fetchOrgs(...a); };
export const fetchOrgRepos          = async (...a: Parameters<typeof instant.fetchOrgRepos>)          => { await sleep(); return instant.fetchOrgRepos(...a); };
export const createOrg              = async (...a: Parameters<typeof instant.createOrg>)              => { await sleep(); return instant.createOrg(...a); };
export const fetchOrgMembers        = async (...a: Parameters<typeof instant.fetchOrgMembers>)        => { await sleep(); return instant.fetchOrgMembers(...a); };
export const addOrgMember           = async (...a: Parameters<typeof instant.addOrgMember>)           => { await sleep(); return instant.addOrgMember(...a); };
export const updateMemberRole       = async (...a: Parameters<typeof instant.updateMemberRole>)       => { await sleep(); return instant.updateMemberRole(...a); };
export const updateMemberPermissions = async (...a: Parameters<typeof instant.updateMemberPermissions>) => { await sleep(); return instant.updateMemberPermissions(...a); };
export const removeOrgMember        = async (...a: Parameters<typeof instant.removeOrgMember>)        => { await sleep(); return instant.removeOrgMember(...a); };
export const checkOrgNameAvailability = async (...a: Parameters<typeof instant.checkOrgNameAvailability>) => { await sleep(); return instant.checkOrgNameAvailability(...a); };
