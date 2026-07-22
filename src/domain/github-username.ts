const GITHUB_USERNAME_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i

export function validateGitHubUsername(username: string): string | null {
  if (!username.trim()) return 'Escribe un nombre de usuario de GitHub.'

  if (!GITHUB_USERNAME_PATTERN.test(username)) {
    return 'El nombre solo puede contener letras, números y guiones simples, sin empezar ni terminar con guion.'
  }

  return null
}
