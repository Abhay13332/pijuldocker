import { Code, Info } from "lucide-react";

export default function ConflictsBox({ conflicts, source, target }) {
  // Dynamic conflict descriptions based on conflict data
  const getConflictDescription = (conflict) => {
    const fileName = conflict.path || "this file";
    const conflictType = conflict.conflictType;
    
    const descriptions = {
      'Name': `"${fileName}" exists in both source and target branches but has different content`,
      'ZombieFile': `"${fileName}" exists in one branch but was deleted in the other`,
      'MultipleNames': `"${fileName}" has been renamed differently in source and target branches`,
      'Zombie': `"${fileName}" was modified in one branch but deleted in the other`,
      'Cyclic': `Circular dependency detected involving "${fileName}"`,
      'Order': `Change ordering conflict in "${fileName}" - operations cannot be automatically resolved`
    };
    
    // Add more context if content differences exist
    if (conflict.contentA && conflict.contentB && conflictType === 'Name') {
      return `"${fileName}" has conflicting changes between ${source || 'source'} and ${target || 'target'}`;
    }
    
    return descriptions[conflictType] || `Conflict in "${fileName}" between source and target branches`;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
        <Code className="w-3 h-3" /> conflicts ({conflicts?.length || 0})
      </h3>
      <div className="space-y-4">
        {conflicts?.map((conflict, idx) => (
          <div key={idx} className="border border-border/50 rounded-none overflow-hidden shadow-sm bg-background">
            <div className="bg-muted/30 px-4 py-2.5 border-b border-border/50">
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-3 flex-wrap flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded ${
                      conflict.conflictType === 'Name' ? 'bg-purple-500/10 text-purple-500' :
                      conflict.conflictType === 'ZombieFile' ? 'bg-red-500/10 text-red-500' :
                      conflict.conflictType === 'MultipleNames' ? 'bg-yellow-500/10 text-yellow-500' :
                      conflict.conflictType === 'Zombie' ? 'bg-orange-500/10 text-orange-500' :
                      conflict.conflictType === 'Cyclic' ? 'bg-pink-500/10 text-pink-500' :
                      conflict.conflictType === 'Order' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-primary/10 text-primary'
                    }`}>
                      {conflict.conflictType}
                    </span>
                    <div className="group relative">
                      <Info className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                      <div className="absolute left-0 top-6 z-10 hidden group-hover:block w-72 p-2.5 bg-popover border border-border rounded-md shadow-lg">
                        <p className="text-[10px] leading-relaxed text-foreground/80">
                          {getConflictDescription(conflict)}
                        </p>
                        {(conflict.contentA || conflict.contentB) && (
                          <div className="mt-1.5 pt-1.5 border-t border-border/50 text-[9px] text-muted-foreground/60">
                            Content differs between versions
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-medium text-foreground/80">
                    {conflict.path}
                  </span>
                </div>
                {conflict.line && (
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                    Line {conflict.line}
                  </span>
                )}
              </div>
            </div>
            
            {/* Source/Target Headers - Grey styling */}
            {(conflict.contentA && conflict.contentB) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-b border-border/50 bg-muted/5">
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border/50">
                  Source {source && <span className="font-mono text-[9px] text-muted-foreground/60 ml-1">({source})</span>}
                </div>
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Target {target && <span className="font-mono text-[9px] text-muted-foreground/60 ml-1">({target})</span>}
                </div>
              </div>
            )}
            
            <div className="p-0 font-mono text-xs overflow-x-auto">
              {/* Two-way conflict view (Source vs Target) */}
              {conflict.contentA && conflict.contentB && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border/5">
                  <div className="p-3 bg-red-500/5">
                    <pre className="whitespace-pre-wrap text-red-500/80">{conflict.contentA}</pre>
                  </div>
                  <div className="p-3 bg-green-500/5">
                    <pre className="whitespace-pre-wrap text-green-500/80">{conflict.contentB}</pre>
                  </div>
                </div>
              )}

              {/* Single content view - only show if content exists and no A/B conflict */}
              {conflict.content && !conflict.contentA && !conflict.contentB && (
                <div className="p-3 bg-muted/10 border-b border-border/5">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground/50 mb-1">Content</div>
                  <pre className="whitespace-pre-wrap text-foreground/80">{conflict.content}</pre>
                </div>
              )}

              {/* Changes list */}
              {conflict.changes && conflict.changes.length > 0 && (
                <div className="divide-y divide-border/5">
                  <div className="px-3 py-2 bg-muted/5 border-b border-border/5">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground/50">Change Hashes ({conflict.changes.length})</div>
                  </div>
                  {conflict.changes.map((changeHash, cIdx) => (
                    <div key={cIdx} className="px-3 py-2 text-[11px] font-mono text-foreground/70 hover:bg-accent/5 break-all">
                      {changeHash}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!conflict.content && !conflict.contentA && !conflict.contentB && (!conflict.changes || conflict.changes.length === 0) && (
                <div className="p-6 text-center">
                  <p className="text-muted-foreground text-xs italic">No additional details available for this conflict.</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}