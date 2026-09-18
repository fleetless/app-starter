/** Pages a visitor reaches without a session: every auth page, and the MCP consent page (which signs the person in itself). */
export function isPublicPath(path: string): boolean {
  return path.startsWith('/auth/') || path.startsWith('/mcp/')
}

/**
 * Where a `?next=` may send someone: a path inside this app, or the robot
 * list. A second leading separator of either kind (`//host`, `/\host`, and
 * the same padded with whitespace, which the parser drops) reads as external
 * to the router, which throws instead of navigating — inside a click handler
 * that makes a successful sign-in look like it did nothing at all.
 */
export function safeNext(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || /^\/\s*[/\\]/.test(raw)) return '/robots'
  return raw
}
