# Implementation Plan: `gt absorb` Command

## Overview
Implement a `gt absorb` command that automatically amends staged changes to the relevant commits in the current stack, similar to `git absorb` but integrated with Charcoal's stack management.

## Command Specification

### Command Interface
```
gt absorb [options]
```

### Options
- `-d, --dry-run`: Print which commits hunks would be absorbed into without applying
- `-f, --force`: Skip confirmation prompt and apply immediately
- `-a, --all`: Stage all unstaged changes before absorbing (excludes untracked files)
- `-p, --patch`: Interactively pick hunks to stage before absorbing

### Aliases
- `ab`

### Description
"Amend staged changes to the relevant commits in the current stack. Relevance is calculated by checking the changes in each commit downstack from the current commit, and finding the first commit that each staged hunk (consecutive lines of changes) can be applied to deterministically. If there is no clear commit to absorb a hunk into, it will not be absorbed. Prompts for confirmation before amending the commits, and restacks the branches upstack of the current branch."

## Architecture

### File Structure
```
src/
├── commands/
│   └── absorb.ts                    # CLI command definition
├── actions/
│   └── absorb.ts                    # Core absorb logic
└── lib/
    └── utils/
        ├── diff_parser.ts           # Parse git diff output into hunks
        └── blame_matcher.ts         # Match hunks to commits using git blame
test/
└── commands/
    └── absorb.test.ts               # Integration tests
```

## Implementation Details

### Phase 1: Command Setup (`src/commands/absorb.ts`)

**Responsibilities:**
- Define yargs command structure
- Parse CLI arguments
- Call absorb action with options
- Handle errors and display results

**Key Components:**
```typescript
export const command = 'absorb';
export const aliases = ['ab'];
export const description = '...';
export const builder = {
  'dry-run': { type: 'boolean', alias: 'd', default: false },
  force: { type: 'boolean', alias: 'f', default: false },
  all: { type: 'boolean', alias: 'a', default: false },
  patch: { type: 'boolean', alias: 'p', default: false },
};
export const handler = async (argv) => {
  return graphite(argv, async (context) =>
    absorbAction({ ... }, context)
  );
};
```

### Phase 2: Core Action (`src/actions/absorb.ts`)

**Algorithm Steps:**

1. **Pre-flight checks**
   - Verify not in rebase state
   - Verify current branch is tracked
   - Verify there are staged changes (or stage them with --all/--patch)

2. **Get staged hunks**
   ```typescript
   const stagedDiff = context.engine.getDiff({ cached: true });
   const hunks = parseDiffIntoHunks(stagedDiff);
   ```

3. **Get downstack commits**
   ```typescript
   const downstackBranches = context.engine.getRelativeStack(
     context.engine.currentBranchPrecondition,
     SCOPE.DOWNSTACK_EXCLUSIVE
   );
   const commits = getCommitsFromBranches(downstackBranches);
   ```

4. **Match hunks to commits**
   ```typescript
   const hunkToCommitMap = new Map<Commit, Hunk[]>();
   for (const hunk of hunks) {
     const targetCommit = findTargetCommit(hunk, commits, context);
     if (targetCommit) {
       hunkToCommitMap.get(targetCommit).push(hunk);
     } else {
       unmatchedHunks.push(hunk);
     }
   }
   ```

5. **Display preview and confirm** (unless --force)
   ```typescript
   displayAbsorbPlan(hunkToCommitMap, unmatchedHunks);
   if (!opts.force && !opts.dryRun) {
     const confirmed = await promptForConfirmation();
     if (!confirmed) return;
   }
   ```

6. **Apply fixups** (if not --dry-run)
   ```typescript
   for (const [commit, hunks] of hunkToCommitMap) {
     // Stash current index
     context.engine.stashIndex();
     
     // Apply only these hunks to index
     applyHunksToIndex(hunks, context);
     
     // Create fixup commit
     context.engine.commit({
       message: `fixup! ${commit.subject}`,
       noVerify: true,
     });
     
     // Restore index
     context.engine.stashPop();
   }
   ```

7. **Autosquash rebase**
   ```typescript
   // Get base commit (trunk or first downstack commit)
   const baseCommit = getTrunkCommit(context);
   
   // Run interactive rebase with autosquash
   context.engine.rebaseInteractive({
     onto: baseCommit,
     autosquash: true,
   });
   ```

8. **Restack upstack branches**
   ```typescript
   restackBranches(
     context.engine.getRelativeStack(
       context.engine.currentBranchPrecondition,
       SCOPE.UPSTACK_EXCLUSIVE
     ),
     context
   );
   ```

### Phase 3: Helper Utilities

#### `src/lib/utils/diff_parser.ts`
**Purpose:** Parse `git diff --cached` output into structured hunk objects

```typescript
export interface Hunk {
  file: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  preImage: string[];  // Original lines being modified
  postImage: string[]; // New lines
  patch: string;       // Raw patch text
}

export function parseDiffIntoHunks(diffOutput: string): Hunk[] {
  // Parse unified diff format
  // Extract file paths, line numbers, and content
}
```

#### `src/lib/utils/blame_matcher.ts`
**Purpose:** Use git blame to find which commit last touched the lines being modified

```typescript
export function findTargetCommit(
  hunk: Hunk,
  commits: Commit[],
  context: TContext
): Commit | null {
  // Run git blame on the pre-image lines
  // Find the most recent commit in our downstack that touched these lines
  // Return null if no clear match (ambiguous or not in downstack)
  
  const blameOutput = context.engine.runGitCommand([
    'blame',
    '--porcelain',
    '-L', `${hunk.oldStart},${hunk.oldStart + hunk.oldLines - 1}`,
    'HEAD',
    '--',
    hunk.file
  ]);
  
  const blamedCommits = parseBlameOutput(blameOutput);
  
  // Find the most recent commit in our downstack
  for (const commit of commits.reverse()) {
    if (blamedCommits.includes(commit.sha)) {
      return commit;
    }
  }
  
  return null;
}
```

### Phase 4: Engine Extensions

**Add to `src/lib/engine/git_engine.ts` (if needed):**

```typescript
// Get staged diff
getDiff(opts: { cached?: boolean; files?: string[] }): string;

// Stash operations
stashIndex(): void;
stashPop(): void;

// Interactive rebase with autosquash
rebaseInteractive(opts: { onto: string; autosquash: boolean }): void;

// Apply patch
applyPatch(patch: string, opts?: { cached?: boolean }): void;
```

## Testing Strategy

### Unit Tests
1. **Hunk parsing**
   - Parse simple diff with single hunk
   - Parse diff with multiple files and hunks
   - Handle edge cases (new files, deleted files, binary files)

2. **Blame matching**
   - Match hunk to single commit
   - Handle ambiguous matches (multiple commits touched same lines)
   - Handle no match (lines not in downstack)

### Integration Tests (`test/commands/absorb.test.ts`)

```typescript
describe('absorb', () => {
  it('Can absorb a simple change into a single commit', () => {
    // Create branch with commit A
    scene.repo.createChange('a', 'file.txt');
    scene.repo.runCliCommand(['create', 'a', '-m', 'a']);
    
    // Modify the same line
    scene.repo.createChange('a-fixed', 'file.txt');
    scene.repo.runGitCommand(['add', 'file.txt']);
    
    // Absorb should amend commit A
    scene.repo.runCliCommand(['absorb', '--force']);
    
    // Verify commit A now has the fixed content
    expectCommitContent(scene.repo, 'HEAD', 'file.txt', 'a-fixed');
  });
  
  it('Can absorb changes into multiple commits', () => {
    // Create stack: A -> B
    scene.repo.createChange('a', 'file1.txt');
    scene.repo.runCliCommand(['create', 'a', '-m', 'a']);
    
    scene.repo.createChange('b', 'file2.txt');
    scene.repo.runCliCommand(['create', 'b', '-m', 'b']);
    
    // Modify both files
    scene.repo.createChange('a-fixed', 'file1.txt');
    scene.repo.createChange('b-fixed', 'file2.txt');
    scene.repo.runGitCommand(['add', '.']);
    
    // Absorb should amend both commits
    scene.repo.runCliCommand(['absorb', '--force']);
    
    // Verify both commits have fixed content
    expectCommitContent(scene.repo, 'HEAD~1', 'file1.txt', 'a-fixed');
    expectCommitContent(scene.repo, 'HEAD', 'file2.txt', 'b-fixed');
  });
  
  it('Handles --dry-run without modifying commits', () => {
    // Setup
    scene.repo.createChange('a', 'file.txt');
    scene.repo.runCliCommand(['create', 'a', '-m', 'a']);
    scene.repo.createChange('a-fixed', 'file.txt');
    scene.repo.runGitCommand(['add', 'file.txt']);
    
    // Dry run
    const output = scene.repo.runCliCommandAndGetOutput(['absorb', '--dry-run']);
    
    // Verify output shows plan but commit unchanged
    expect(output).to.include('Would absorb into commit');
    expectCommitContent(scene.repo, 'HEAD', 'file.txt', 'a');
  });
  
  it('Handles --all flag to stage changes', () => {
    scene.repo.createChange('a', 'file.txt');
    scene.repo.runCliCommand(['create', 'a', '-m', 'a']);
    scene.repo.createChange('a-fixed', 'file.txt');
    // Don't stage
    
    scene.repo.runCliCommand(['absorb', '--all', '--force']);
    
    expectCommitContent(scene.repo, 'HEAD', 'file.txt', 'a-fixed');
  });
  
  it('Restacks upstack branches after absorb', () => {
    // Create stack: A -> B -> C
    scene.repo.createChange('a', 'file.txt');
    scene.repo.runCliCommand(['create', 'a', '-m', 'a']);
    
    scene.repo.createChange('b', 'file.txt');
    scene.repo.runCliCommand(['create', 'b', '-m', 'b']);
    
    scene.repo.createChange('c', 'file.txt');
    scene.repo.runCliCommand(['create', 'c', '-m', 'c']);
    
    // Go back to B and modify A's content
    scene.repo.checkoutBranch('b');
    scene.repo.createChange('a-fixed', 'file.txt');
    scene.repo.runGitCommand(['add', 'file.txt']);
    
    scene.repo.runCliCommand(['absorb', '--force']);
    
    // Verify C is restacked on top of updated B
    scene.repo.checkoutBranch('c');
    expectCommits(scene.repo, 'c, b, a');
  });
});
```

## Error Handling

1. **No staged changes**: Error message prompting to stage changes or use --all
2. **Rebase in progress**: Block command with clear error
3. **No matching commits**: Warn about unmatched hunks, proceed with matched ones
4. **Merge conflicts during rebase**: Use existing continue mechanism
5. **Not on tracked branch**: Error with suggestion to run `gt track`

## User Experience

### Success Output
```
Analyzing staged changes...
Found 3 hunks to absorb:

  file1.txt (lines 10-15) → commit abc123 "Add feature X"
  file2.txt (lines 5-8)   → commit def456 "Fix bug Y"
  file1.txt (lines 20-22) → commit abc123 "Add feature X"

Unmatched hunks (will remain staged):
  file3.txt (lines 1-5) - no clear target commit

Absorb these changes? (y/n): y

✓ Created fixup commits
✓ Rebased and squashed fixups
✓ Restacked 2 upstack branches

Successfully absorbed changes into 2 commits.
```

### Dry Run Output
```
Would absorb 3 hunks into 2 commits:

  abc123 "Add feature X"
    • file1.txt (lines 10-15)
    • file1.txt (lines 20-22)
  
  def456 "Fix bug Y"
    • file2.txt (lines 5-8)

Unmatched hunks:
  • file3.txt (lines 1-5)

Run without --dry-run to apply.
```

## Implementation Phases

### Phase 1: MVP (Core Functionality)
- Basic command structure
- Simple hunk matching (single file, single commit)
- Manual confirmation
- Basic tests

### Phase 2: Enhanced Matching
- Multi-file support
- Multi-commit matching
- Ambiguity detection
- Unmatched hunk handling

### Phase 3: Polish
- --dry-run preview
- --force flag
- --all and --patch flags
- Rich output formatting
- Comprehensive error handling

### Phase 4: Integration
- Restack integration
- Continue mechanism for conflicts
- Telemetry and analytics
- Documentation

## Dependencies

### Existing Charcoal Infrastructure
- `context.engine`: Git operations
- `restackBranches()`: Restack after modifications
- `SCOPE`: Stack traversal
- `graphite()`: Command runner
- Error types: `PreconditionsFailedError`, `BlockedDuringRebaseError`

### New Git Commands Needed
- `git diff --cached --unified=0` (get minimal hunks)
- `git blame --porcelain` (find commit for lines)
- `git apply --cached` (apply specific hunks)
- `git rebase -i --autosquash` (squash fixups)
- `git stash` (save/restore index)

## Risks and Mitigations

1. **Complex diff parsing**: Use well-tested diff parsing library or git's porcelain output
2. **Ambiguous blame results**: Be conservative - skip ambiguous hunks
3. **Rebase conflicts**: Leverage existing continue mechanism
4. **Performance with large diffs**: Process hunks in batches, show progress
5. **Edge cases (binary files, renames)**: Detect and skip with clear warnings

## Success Criteria

- [ ] Command runs without errors on simple cases
- [ ] Correctly matches hunks to commits using git blame
- [ ] Creates fixup commits and squashes them
- [ ] Restacks upstack branches
- [ ] Handles --dry-run, --force, --all, --patch flags
- [ ] Provides clear output and error messages
- [ ] All tests pass
- [ ] No regressions in existing commands
