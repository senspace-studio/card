import { Injectable } from '@nestjs/common';
import { In, LessThanOrEqual, MoreThan, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AccountEntity } from 'src/entities/account.entity';
import { TotalEntity } from 'src/entities/total.entity';
import { BonusAddress } from 'src/constants/BonusAddress';
import { PointCalcResponse } from 'src/types/point';
import { ADMIN_ADDRESSES } from 'src/constants/Admin';

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(TotalEntity)
    private readonly totalRepository: Repository<TotalEntity>,
  ) {}

  async getEventsByMinter(minter: string) {}

  async accountExists(address: string) {
    return await this.accountRepository.exists({ where: { address } });
  }

  async updateAccount(address: string, points: number) {
    await this.accountRepository.save({ address, points });
  }

  async switchTotalRunning(isRunning: boolean) {
    await this.totalRepository.update({ id: 0 }, { isRunning });
  }

  async updateTotal(id: number, TotalEntity: Partial<TotalEntity>) {
    await this.totalRepository.update(id, TotalEntity);
  }
}
