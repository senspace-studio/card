import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'logic' })
export class LogicEntity {
  @PrimaryColumn()
  readonly id: number;

  @Column()
  common: number;

  @Column()
  rare: number;

  @Column()
  special: number;

  // ミリ秒ではなく、10桁（同値は範囲に含む）
  @Column()
  start: number;

  // ミリ秒ではなく、10桁（同値は範囲に含まない）
  @Column()
  end: number;

  @Column()
  bonus: boolean;
}
