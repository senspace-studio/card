import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'officialnft_data' })
export class OfficialNFTDataEntity {
  @PrimaryColumn()
  address: string;

  @Column()
  points: number;

  @Column()
  mints: number;
}
