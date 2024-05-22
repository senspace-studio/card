import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'total' })
export class TotalEntity {
  @PrimaryColumn()
  readonly id: number;

  @Column()
  points: string;

  @Column()
  events: string;

  @Column()
  nfts: string;

  @Column({ name: 'latest_block_number' })
  latestBlockNumber: string;

  @Column({ name: 'is_running', default: false })
  isRunning: boolean;
}
