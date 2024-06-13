import {
  Entity,
  Column,
  PrimaryColumn,
  // UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'war' })
export class WarEntity {
  @PrimaryColumn()
  readonly seed: string;

  @Column({ nullable: true })
  game_id: string;

  @Column({ nullable: false })
  signature: string;

  @Column({ nullable: false })
  maker: string;

  @Column({ nullable: false })
  maker_token_id: string;

  @Column({ nullable: true })
  challenger: string;

  @Column({ nullable: true })
  cast_hash_made: string;

  @Column({ nullable: true })
  cast_hash_challenged: string;

  @Column({ nullable: true })
  cast_hash_revealed: string;

  @Column({ nullable: false })
  created: string;
}
