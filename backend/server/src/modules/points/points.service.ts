import { Injectable } from '@nestjs/common';
import { In, LessThanOrEqual, MoreThan, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEntity } from 'src/entities/event.entity';
import { AccountEntity } from 'src/entities/account.entity';
import { TotalEntity } from 'src/entities/total.entity';
import { LogicEntity } from 'src/entities/logic.entity';
import { BonusAddress } from 'src/constants/BonusAddress';
import { PointCalcResponse } from 'src/types/point';
import { OfficialNFTDataEntity } from 'src/entities/officialnft_data.entity';
import { ADMIN_ADDRESSES } from 'src/constants/Admin';

// DB
// '0','1711116000','1711177200','200','400','800'
// '1','1711177200','1711375200','200','400','800'
// '2','1711375200','1711396800','400','800','1600'
// '3','1711396800','1711436400','400','800','1600'
// '4','1711436400','1711544400','200','400','800'
// '5','1711544400','1711609200','400','800','1600'

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(TotalEntity)
    private readonly totalRepository: Repository<TotalEntity>,
    @InjectRepository(LogicEntity)
    private readonly logicRepository: Repository<LogicEntity>,
    @InjectRepository(OfficialNFTDataEntity)
    private readonly officialNFTDataRepository: Repository<OfficialNFTDataEntity>,
  ) {
    // const eventDates = [
    //   1711116000, // [0] Fri Mar 22 2024 23:00:00 GMT+0900 (Japan Standard Time) 開始時間
    //   1711177200, // [1] Sat Mar 23 2024 16:00:00 GMT+0900 (Japan Standard Time)
    //   1711375200, // [2] Mon Mar 25 2024 23:00:00 GMT+0900 (Japan Standard Time)
    //   1711396800, // [3] Tue Mar 26 2024 05:00:00 GMT+0900 (Japan Standard Time)
    //   1711436400, // [4] Tue Mar 26 2024 16:00:00 GMT+0900 (Japan Standard Time)
    //   1711544400, // [5] Thu Mar 27 2024 22:00:00 GMT+0900 (Japan Standard Time)
    //   1711609200, // [6] Fri Mar 28 2024 16:00:00 GMT+0900 (Japan Standard Time) 終了時間
    // ];
    // for (let i = 0; i < eventDates.length - 1; i++) {
    //   this.logicRepository.save({
    //     id: i,
    //     start: eventDates[0],
    //     end: eventDates[1],
    //     common: 200,
    //     rare: 400,
    //     special: 800,
    //   });
    // }
  }

  async getEventsByMinter(minter: string) {
    const events = await this.eventRepository.find({ where: { minter } });
    return events;
  }

  async getEvents(
    orderBy: 'DESC' | 'ASC',
    page: number,
    pageSize: number,
    exeptAddresses: string[] = [],
  ) {
    const [accounts, total] = await this.accountRepository.findAndCount({
      take: pageSize,
      skip: (page - 1) * pageSize,
      order: { points: orderBy },
      where: { address: Not(In(exeptAddresses)) },
    });

    const [officialNftAccounts] =
      await this.officialNFTDataRepository.findAndCount({
        take: pageSize,
        skip: (page - 1) * pageSize,
        order: { points: orderBy },
        where: { address: Not(In(exeptAddresses)) },
      });

    for (const officialNftAccount of officialNftAccounts) {
      const account = accounts.find(
        (a) => a?.address === officialNftAccount.address,
      );
      if (account) {
        account.points += officialNftAccount.points;
      } else {
        accounts.push(officialNftAccount);
      }
    }

    accounts.sort((a, b) => Number(b.points) - Number(a.points));
    accounts.splice(pageSize);

    return {
      data: accounts,
      total,
      page,
      pageSize,
    };
  }

  async saveEvent(event: Partial<EventEntity>) {
    await this.eventRepository.save(event);
  }

  async eventExists(
    minter: string,
    blockHash: string,
    transactionHash: string,
  ) {
    return await this.eventRepository.exists({
      where: {
        minter,
        blockHash,
        transactionHash,
      },
    });
  }

  async accountExists(address: string) {
    return await this.accountRepository.exists({ where: { address } });
  }

  async getAccount(address: string) {
    const account = await this.accountRepository.findOne({
      where: { address },
    });

    if (!account) return;

    const officialPoint = await this.officialNFTDataRepository.findOne({
      where: { address },
    });
    if (officialPoint) {
      account.points += officialPoint.points;
    }

    return account;
  }

  async updateAccount(address: string, points: number) {
    await this.accountRepository.save({ address, points });
  }

  async getTotal(params?: { includeOfficialNFTs: boolean }) {
    const exists = await this.totalRepository.exists({ where: { id: 0 } });
    if (!exists) {
      await this.totalRepository.save({
        id: 0,
        points: '0',
        events: '0',
        latestBlockNumber: '0',
        isRunning: false,
      });
    }

    const total = await this.totalRepository.findOne({ where: { id: 0 } });

    if (!params?.includeOfficialNFTs) return total;

    // Zora 公式NFTのデータを追加
    const officialNFTMintsTotal =
      await this.officialNFTDataRepository.sum('mints');

    const officialNFTPointsTotal =
      await this.officialNFTDataRepository.sum('points');

    // Adminのポイントを引く
    const adminAccounts = await Promise.all(
      ADMIN_ADDRESSES.map((address) => this.getAccount(address)),
    );
    const adminPoints = adminAccounts
      .filter((aa) => aa)
      .reduce((acc, account) => acc + account.points, 0);
    const adminOfficialNFTs = await this.officialNFTDataRepository.sum(
      'mints',
      {
        address: In(ADMIN_ADDRESSES),
      },
    );

    total.nfts = String(
      Number(total.nfts) + officialNFTMintsTotal - adminOfficialNFTs,
    );

    total.points = String(
      Number(total.points) + officialNFTPointsTotal - adminPoints,
    );

    return total;
  }

  async switchTotalRunning(isRunning: boolean) {
    await this.totalRepository.update({ id: 0 }, { isRunning });
  }

  async updateTotal(id: number, TotalEntity: Partial<TotalEntity>) {
    await this.totalRepository.update(id, TotalEntity);
  }

  async getLogics() {
    return await this.logicRepository.find();
  }

  async getLogicByDate(date: number) {
    return await this.logicRepository.findOne({
      where: {
        start: LessThanOrEqual(date),
        end: MoreThan(date),
      },
    });
  }

  // dateはミリ秒なので注意
  async calc(
    address: string,
    common: bigint,
    rare: bigint,
    special: bigint,
    date: bigint,
  ): Promise<PointCalcResponse> {
    const logic = await this.getLogicByDate(Number(date) / 1e3);
    console.log(Number(date) / 1e3, logic);
    if (!logic) {
      return {
        common: { amount: common, points: 0n },
        rare: { amount: rare, points: 0n },
        special: { amount: special, points: 0n },
      };
    }
    const bonus = logic.bonus && BonusAddress.includes(address.toLowerCase());
    return {
      common: {
        amount: common,
        points: common * BigInt(logic.common * (bonus ? 2 : 1)),
      },
      rare: {
        amount: rare,
        points: rare * BigInt(logic.rare * (bonus ? 2 : 1)),
      },
      special: {
        amount: special,
        points: special * BigInt(logic.special * (bonus ? 2 : 1)),
      },
    };
  }

  async getAccountEvents(address: string) {
    return await this.eventRepository.find({ where: { minter: address } });
  }

  calcHat(ids: number[], quantities: number[]) {
    const base_points = {
      1: 200,
      2: 200,
      3: 200,
      4: 200,
      5: 200,
      6: 200,
      7: 200,
      8: 200,
      9: 200,
      10: 200,
      11: 600,
      12: 600,
      13: 600,
      14: 1800,
    };

    const result = Array(14)
      .fill(0)
      .map((_, index) => {
        const tokenId = index + 1;
        const quantity = quantities[ids.indexOf(tokenId)] || 0;
        const point = base_points[tokenId] * quantity;
        return { tokenId, quantity, point };
      });

    const totalPoint = result.reduce((acc, r) => acc + r.point, 0);

    return { result, totalPoint };
  }
}
