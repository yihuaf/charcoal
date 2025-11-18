export interface Hunk {
  file: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  preImage: string[]; // Original lines being modified
  postImage: string[]; // New lines
  patch: string; // Raw patch text for this hunk
}

/**
 * Parse unified diff output into structured hunk objects.
 * Expects output from `git diff --cached` or similar.
 */
export function parseDiffIntoHunks(diffOutput: string): Hunk[] {
  const hunks: Hunk[] = [];
  const lines = diffOutput.split('\n');

  let currentFile: string | null = null;
  let currentHunk: Partial<Hunk> | null = null;
  let hunkLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Parse file header: diff --git a/file b/file
    if (line.startsWith('diff --git ')) {
      currentFile = null;
      continue;
    }

    // Parse new file path: +++ b/file
    if (line.startsWith('+++ b/')) {
      currentFile = line.substring(6);
      continue;
    }

    // Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@
    if (line.startsWith('@@')) {
      // Save previous hunk if exists
      if (currentHunk && currentFile) {
        finalizeHunk(
          { hunk: currentHunk, hunkLines, file: currentFile },
          hunks
        );
      }

      // Parse hunk header
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match && currentFile) {
        currentHunk = {
          file: currentFile,
          oldStart: parseInt(match[1], 10),
          oldLines: match[2] ? parseInt(match[2], 10) : 1,
          newStart: parseInt(match[3], 10),
          newLines: match[4] ? parseInt(match[4], 10) : 1,
          preImage: [],
          postImage: [],
        };
        hunkLines = [line];
      }
      continue;
    }

    // Collect hunk content lines
    if (currentHunk) {
      hunkLines.push(line);

      // Parse context, removed, and added lines
      if (line.startsWith('-') && !line.startsWith('---')) {
        // Removed line (part of pre-image)
        currentHunk.preImage!.push(line.substring(1));
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        // Added line (part of post-image)
        currentHunk.postImage!.push(line.substring(1));
      } else if (line.startsWith(' ')) {
        // Context line (in both pre and post)
        const content = line.substring(1);
        currentHunk.preImage!.push(content);
        currentHunk.postImage!.push(content);
      }
    }
  }

  // Finalize last hunk
  if (currentHunk && currentFile) {
    finalizeHunk({ hunk: currentHunk, hunkLines, file: currentFile }, hunks);
  }

  return hunks;
}

function finalizeHunk(
  params: {
    hunk: Partial<Hunk>;
    hunkLines: string[];
    file: string;
  },
  hunks: Hunk[]
): void {
  const { hunk, hunkLines, file } = params;
  if (
    hunk.oldStart !== undefined &&
    hunk.oldLines !== undefined &&
    hunk.newStart !== undefined &&
    hunk.newLines !== undefined &&
    hunk.preImage &&
    hunk.postImage
  ) {
    hunks.push({
      file,
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      preImage: hunk.preImage,
      postImage: hunk.postImage,
      patch: hunkLines.join('\n'),
    });
  }
}
