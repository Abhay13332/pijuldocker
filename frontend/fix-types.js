const fs = require('fs');

let file = fs.readFileSync('src/pages/RepoDetail.tsx', 'utf8');

// Replace useState([]) with useState<any[]>([])
file = file.replace(/useState\(\[\]\)/g, 'useState<any[]>([])');
// Replace useState(null) with useState<any>(null)
file = file.replace(/useState\(null\)/g, 'useState<any>(null)');

// Parameter fixes:
// newTab
file = file.replace(/handleTabChange = \(newTab\)/g, 'handleTabChange = (newTab: string)');
// channel
file = file.replace(/handleSwitchChannel = async \(channel\)/g, 'handleSwitchChannel = async (channel: string)');
// id
file = file.replace(/handleRemoveCollaborator = async \(id\)/g, 'handleRemoveCollaborator = async (id: string)');
// prId
file = file.replace(/handleViewPR = async \(prId\)/g, 'handleViewPR = async (prId: string)');
file = file.replace(/handleMergePR = async \(prId\)/g, 'handleMergePR = async (prId: string)');
file = file.replace(/handleClosePR = async \(prId\)/g, 'handleClosePR = async (prId: string)');
file = file.replace(/handleDeletePR = async \(prId\)/g, 'handleDeletePR = async (prId: string)');

// Other implicit any (e) for events
file = file.replace(/onChange=\{\(e\) =>/g, 'onChange={(e: any) =>');
file = file.replace(/onSubmit=\{\(e\) =>/g, 'onSubmit={(e: any) =>');
file = file.replace(/onCopy=\{\(e\) =>/g, 'onCopy={(e: any) =>');

// Fix mapping over channels
file = file.replace(/channels\.map\(c =>/g, 'channels.map((c: any) =>');
file = file.replace(/setChannels\(prev => prev\.map\(c =>/g, 'setChannels((prev: any[]) => prev.map((c: any) =>');

// For other functions like prev =>
file = file.replace(/prev =>/g, '(prev: any) =>');
// Let's restrict prev => if we can, actually (prev: any) is fine.
// Wait, the prev => replace above might hit things we don't want, let's skip it and just replace known instances.

fs.writeFileSync('src/pages/RepoDetail.tsx', file);
