// Matches scratch.mit.edu/projects/<id> (with or without a trailing slash,
// /editor, or /embed) so a teacher can paste whatever URL is in their
// browser's address bar, not a specially-formatted link.
export function extractScratchProjectId(url: string): string | null {
  const m = url.match(/scratch\.mit\.edu\/projects\/(\d+)/);
  return m ? m[1] : null;
}

// Scratch's own CDN serves a real project thumbnail at this fixed URL for
// every public project — same "no key, no upload needed" pattern as the
// YouTube thumbnail helper.
export function scratchThumbnailUrl(projectId: string): string {
  return `https://cdn2.scratch.mit.edu/get_image/project/${projectId}_480x360.png`;
}

// Scratch's own officially-supported embed path — runs the project inline
// in an iframe, same as embedding it on any other website.
export function scratchEmbedUrl(projectId: string): string {
  return `https://scratch.mit.edu/projects/${projectId}/embed`;
}
