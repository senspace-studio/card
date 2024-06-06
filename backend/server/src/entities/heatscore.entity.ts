import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  // UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'heat_score' })
export class HeatScoreEntity {
  @PrimaryGeneratedColumn()
  readonly id: number;

  @PrimaryColumn()
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  score: number;

  @Column({ type: 'datetime' })
  date: Date;

  @CreateDateColumn()
  readonly createdAt: Date;
}
