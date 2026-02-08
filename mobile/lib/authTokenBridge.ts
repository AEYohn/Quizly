/**
 * Module-level token getter so API client can get tokens outside React components.
 * AuthProvider sets the getter on mount; API functions call getAuthToken().
 */

type TokenGetter = () => Promise<string | null>;

let _tokenGetter: TokenGetter | null = null;

export function setTokenGetter(fn: TokenGetter) {
  _tokenGetter = fn;
}

export async function getAuthToken(): Promise<string | null> {
  if (!_tokenGetter) return null;
  try {
    return await _tokenGetter();
  } catch {
    return null;
  }
}
