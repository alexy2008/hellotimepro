import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { primaryUuidColumn, timestampColumn, uuidColumn } from '../database/column-helpers';
import { User } from './user.entity';

@Entity('refresh_tokens')
@Index('refresh_tokens_hash_uk', ['tokenHash'], { unique: true })
@Index('refresh_tokens_user_ix', ['userId'])
@Index('refresh_tokens_family_ix', ['familyId'])
@Index('refresh_tokens_expires_ix', ['expiresAt'])
export class RefreshToken {
  @PrimaryColumn(primaryUuidColumn())
  id: string;

  @Column({ name: 'user_id', ...uuidColumn() })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'token_hash', type: 'varchar', length: 100 })
  tokenHash: string;

  @Column({ name: 'family_id', ...uuidColumn() })
  familyId: string;

  @Column({ name: 'expires_at', ...timestampColumn() })
  expiresAt: Date;

  @Column({ name: 'created_at', ...timestampColumn() })
  createdAt: Date;

  @Column({ name: 'revoked_at', ...timestampColumn(true) })
  revokedAt: Date | null;
}
