export interface GitHubProfile {
  id: number
  login: string
  name: string | null
  avatar_url: string
  html_url: string
  bio: string | null
  followers: number
  public_repos: number
}

export interface GitHubRepository {
  id: number
  name: string
  html_url: string
  description: string | null
  fork: boolean
  archived: boolean
  is_template: boolean
  language: string | null
  stargazers_count: number
  forks_count: number
  size: number
  updated_at: string
}

export interface GitHubSystem {
  profile: GitHubProfile
  repositories: GitHubRepository[]
  starSeed: number
}

export function stableSeed(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export function createGitHubSystem(
  profile: GitHubProfile,
  repositories: GitHubRepository[],
): GitHubSystem {
  return {
    profile,
    repositories,
    starSeed: stableSeed(`${profile.id}:${profile.login.toLowerCase()}`),
  }
}
