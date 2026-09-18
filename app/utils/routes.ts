/** Pages a visitor reaches without a session: every auth page, and the MCP consent page (which signs the person in itself). */
export function isPublicPath(path: string): boolean {
  return path.startsWith('/auth/') || path.startsWith('/mcp/')
}
