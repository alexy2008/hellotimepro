import { EntityManager } from 'typeorm';
import { Capsule } from '../entities/capsule.entity';
import { capsuleLookupIds } from './capsule-rules';

export function findLockedCapsule(manager: EntityManager, capsuleId: string, field = 'capsuleId') {
  const sqlite = manager.connection.options.type === 'better-sqlite3';
  const ids = capsuleLookupIds(capsuleId, sqlite, field);
  const query = manager.getRepository(Capsule).createQueryBuilder('c').where('c.id IN (:...ids)', { ids });
  if (!sqlite) query.setLock('pessimistic_write');
  return query.getOne();
}
