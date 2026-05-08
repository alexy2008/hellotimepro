export function avatarUrl(avatarId: string | undefined | null): string {
  if (!avatarId) return '/static/avatars/neo.svg';
  return `/static/avatars/${avatarId}.svg`;
}
