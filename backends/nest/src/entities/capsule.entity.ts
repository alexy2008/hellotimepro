import { Column, Entity, Index, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { primaryUuidColumn, timestampColumn, uuidColumn } from '../database/column-helpers';
import { User } from './user.entity';

@Entity('capsules')
@Index('capsules_code_uk', ['code'], { unique: true })
@Index('capsules_owner_created_ix', ['ownerId', 'createdAt'])
export class Capsule {
  @PrimaryColumn(primaryUuidColumn())
  id: string;

  @Column({ name: 'owner_id', ...uuidColumn() })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ type: 'varchar', length: 8 })
  code: string;

  @Column({ type: 'varchar', length: 60 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'open_at', ...timestampColumn() })
  openAt: Date;

  @Column({ name: 'in_plaza', type: 'boolean', default: true })
  inPlaza: boolean;

  @Column({ name: 'favorite_count', type: 'integer', default: 0 })
  favoriteCount: number;

  @Column({ name: 'created_at', ...timestampColumn() })
  createdAt: Date;

  @Column({ name: 'updated_at', ...timestampColumn() })
  updatedAt: Date;
}
