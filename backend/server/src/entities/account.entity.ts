import {
  Entity,
  Column,
  PrimaryColumn,
  // UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'account' })
export class AccountEntity {
  @PrimaryColumn()
  readonly address: string;

  @Column()
  points: number;
}
