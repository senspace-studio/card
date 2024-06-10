import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  // UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'stream_smart_account' })
export class StreamSmartAccountEntity {
  @PrimaryGeneratedColumn()
  readonly id: number;

  @PrimaryColumn()
  address: string;

  @Column()
  stream_start: number;

  @Column()
  stream_end: number;

  @CreateDateColumn()
  readonly createdAt: Date;
}
