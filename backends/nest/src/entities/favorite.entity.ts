import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { primaryUuidColumn, timestampColumn, uuidColumn } from '../database/column-helpers';
import { Capsule } from './capsule.entity';
import { User } from './user.entity';

@Entity('favorites')
@Index('favorites_user_created_ix', ['userId', 'createdAt'])
@Index('favorites_capsule_ix', ['capsuleId'])
export class Favorite {
  @PrimaryColumn({ name: 'user_id', ...primaryUuidColumn() })
  userId: string;

  @PrimaryColumn({ name: 'capsule_id', ...primaryUuidColumn() })
  capsuleId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Capsule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'capsule_id' })
  capsule: Capsule;

  @Column({ name: 'created_at', ...timestampColumn() })
  createdAt: Date;
}
