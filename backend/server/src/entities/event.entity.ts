import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'event' })
export class EventEntity {
  @PrimaryGeneratedColumn()
  readonly id: number;

  @Column({ name: 'transaction_hash' })
  transactionHash: string;

  @Column({ name: 'block_hash' })
  blockHash: string;

  @Index()
  @Column()
  minter: string;

  @Column()
  common: string;

  @Column()
  rare: string;

  @Column()
  special: string;

  @Column()
  timestamp: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    precision: 0,
  })
  readonly createdAt: Date;
}
