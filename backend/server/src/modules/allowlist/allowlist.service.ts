import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AllowlistEntity } from 'src/entities/allowlist.entity';
import { In, Repository } from 'typeorm';

@Injectable()
export class AllowlistService {
  constructor(
    @InjectRepository(AllowlistEntity)
    private readonly allowlistRepository: Repository<AllowlistEntity>,
  ) {}

  async existAllowlist(fid: number) {
    return await this.allowlistRepository.exists({
      where: {
        fid,
      },
    });
  }

  async findByAddress(address: string) {
    return await this.allowlistRepository.find({
      where: {
        address,
      },
    });
  }

  async isPending() {
    return await this.allowlistRepository.exists({
      where: {
        status: 'pending',
      },
    });
  }

  async findClaimedList() {
    return await this.allowlistRepository.find({
      where: {
        status: 'claimed',
      },
    });
  }

  async updateBatchStatus(
    ids: number[],
    status: 'claimed' | 'pending' | 'minted' | 'failed',
  ) {
    return await this.allowlistRepository.update({ id: In(ids) }, { status });
  }

  async addAllowlist(address: string, fid: number) {
    return await this.allowlistRepository.save({ address, fid });
  }

  async allowlistCount() {
    return await this.allowlistRepository.count();
  }

  async claim(address: string, tokenId: number, id: number) {
    return await this.allowlistRepository.update(
      { address, id },
      { tokenId, status: 'claimed' },
    );
  }
}
