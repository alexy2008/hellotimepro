import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { primaryUuidColumn, timestampColumn, uuidColumn } from '../database/column-helpers';

@Entity('users')
@Index('users_email_uk', ['email'], { unique: true })
@Index('users_nickname_uk', ['nickname'], { unique: true })
export class User {
  @PrimaryColumn(primaryUuidColumn())
  id: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 100 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20 })
  nickname: string;

  @Column({ name: 'avatar_id', type: 'varchar', length: 20 })
  avatarId: string;

  @Column({ name: 'created_at', ...timestampColumn() })
  createdAt: Date;

  @Column({ name: 'updated_at', ...timestampColumn() })
  updatedAt: Date;
}
