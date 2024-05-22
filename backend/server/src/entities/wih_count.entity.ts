import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'wih_count' })
export class WIHCountEntity {
  @PrimaryColumn()
  readonly address: string;

  @Column()
  count: number;
}
