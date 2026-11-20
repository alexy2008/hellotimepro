import { validationError } from '../common/api.exception';

export function validateOpenAt(value: string, now: Date): Date {
  const openAt = new Date(value);
  if (!Number.isFinite(openAt.getTime())) throw validationError('openAt 格式无效', 'openAt');
  if (openAt.getTime() <= now.getTime() + 60_000) {
    throw validationError('开启时间必须在当前时间 60 秒后', 'openAt');
  }
  const limit = new Date(now);
  limit.setUTCFullYear(now.getUTCFullYear() + 10);
  if (limit.getUTCMonth() !== now.getUTCMonth()) limit.setUTCDate(0);
  if (openAt > limit) throw validationError('开启时间不能超过当前时间 10 年', 'openAt');
  return openAt;
}

export const CAPSULE_ID = /^(?:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9a-f]{32})$/i;

export function canonicalCapsuleId(storedId: string): string {
  return storedId
    .toLowerCase()
    .replace(/^([a-f0-9]{8})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{12})$/, '$1-$2-$3-$4-$5');
}

export function capsuleLookupIds(capsuleId: string, sqlite: boolean, field = 'capsuleId'): string[] {
  if (!CAPSULE_ID.test(capsuleId)) throw validationError('必须提供合法的胶囊 UUID', field);
  const id = canonicalCapsuleId(capsuleId);
  return sqlite ? [id, id.replace(/-/g, '')] : [id];
}
