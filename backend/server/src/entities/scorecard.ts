import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'scorecard' })
export class ScorecardEntity {
  @PrimaryGeneratedColumn()
  readonly id: number;

  @Column({ name: 'address' })
  readonly address: string;

  @Column({ name: 'result', type: 'json' })
  readonly result: any;

  @Column()
  readonly date: number;
}
