import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  // UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'allowlist' })
export class AllowlistEntity {
  @PrimaryGeneratedColumn()
  readonly id: number;

  @Column({ nullable: true })
  readonly fid: number;

  @Column()
  readonly address: string;

  @Column({ nullable: true })
  readonly tokenId: number;

  @Column({ nullable: true })
  readonly status: 'claimed' | 'pending' | 'minted' | 'failed';

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    precision: 0,
  })
  readonly createdAt: Date;
}
