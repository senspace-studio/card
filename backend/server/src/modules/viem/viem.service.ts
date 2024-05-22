import { Injectable } from '@nestjs/common';
import {
  ADMIN_PRIVATE_KEY,
  BLOCKCHAIN_API,
  CHAIN_ID,
  ERC1155_ADDRESS,
  GASHA_ADDRESS,
  UNIT_PRICE,
  WIH_ADDRESS,
} from 'src/utils/env';
import {
  http,
  createPublicClient,
  Chain,
  Address,
  getContract,
  createWalletClient,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base, hardhat, mainnet, degen } from 'viem/chains';
import { Gasha, GashaABI } from 'src/constants/Gasha';
import { SeriesItem } from 'src/types/contract';
import { ZoraCreator1155ABI } from 'src/constants/ZoraCreator1155Impl';
import { ERC1155ABI } from 'src/constants/ERC1155';
import { HatABI } from 'src/constants/HatABI';

@Injectable()
export class ViemService {
  private get chain() {
    switch (CHAIN_ID) {
      case 31337:
        return hardhat;
      case 84532:
        return baseSepolia;
      case 8453:
        return base;
      case 666666666:
        return degen;
      default:
        return hardhat;
    }
  }

  private get client() {
    return createPublicClient({
      chain: { ...this.chain, fees: { baseFeeMultiplier: 1.25 } } as Chain,
      transport: http(BLOCKCHAIN_API),
    });
  }

  private get walletClient() {
    return createWalletClient({
      chain: this.chain as Chain,
      transport: http(BLOCKCHAIN_API),
    });
  }

  private get adminAccount() {
    return privateKeyToAccount(ADMIN_PRIVATE_KEY as Address);
  }

  private get ensResolverClient() {
    return createPublicClient({
      chain: mainnet,
      transport: http(),
    });
  }

  async getLatestBlockNumber() {
    return await this.client.getBlockNumber();
  }

  async getSpinEvents(fromBlock: bigint, toBlock: bigint) {
    const events = await this.client.getContractEvents({
      address: GASHA_ADDRESS as Address,
      abi: Gasha.abi,
      eventName: 'Spin',
      fromBlock: fromBlock,
      toBlock: toBlock,
    });
    return events;
  }

  async getSeriesItems() {
    const res = await this.client.readContract({
      address: GASHA_ADDRESS as Address,
      abi: GashaABI,
      functionName: 'seriesItems',
    });

    return res as SeriesItem[];
  }

  async balanceOf(address: Address) {
    const res = await this.client.readContract({
      address: ERC1155_ADDRESS as Address,
      abi: ZoraCreator1155ABI,
      functionName: 'balanceOfBatch',
      args: [
        Array(6)
          .fill('')
          .map((a) => address),
        [1n, 2n, 3n, 4n, 5n, 6n],
      ],
    });

    return res;
  }

  async getBlockTimestampByBlockHash(blockHash: Address) {
    const block = await this.client.getBlock({ blockHash });
    return block.timestamp;
  }

  async getBlockTimestampByBlockNumber(blockNumber: bigint) {
    const block = await this.client.getBlock({ blockNumber });
    return block.timestamp;
  }

  async getContractTransactionReceipt(hash: Address) {
    const tx = await this.client.getTransactionReceipt({ hash });
    return tx;
  }

  async getContractEvent(
    eventName: string,
    fromBlock: bigint,
    toBlock: bigint,
  ) {
    const events = await this.client.getContractEvents({
      address: GASHA_ADDRESS as Address,
      abi: Gasha.abi,
      eventName,
      fromBlock: fromBlock,
      toBlock: toBlock,
    });
    return events;
  }

  async lookupENS(ens: string) {
    try {
      const resolvedAddress = await this.ensResolverClient.getEnsAddress({
        name: ens,
      });

      return resolvedAddress;
    } catch (error) {
      throw new Error('Invalid address');
    }
  }

  async dropByAdmin(address: Address, tokenId: number) {
    try {
      const { request } = await this.client.simulateContract({
        address: GASHA_ADDRESS as Address,
        abi: GashaABI,
        account: this.adminAccount,
        functionName: 'dropByOwner',
        args: [address, [BigInt(tokenId)], [BigInt(1)]],
        value: parseEther(UNIT_PRICE),
      });

      await this.walletClient.writeContract(request);
    } catch (error) {
      throw error;
    }
  }

  async balanceOfAll(address: Address, numOfToken: number) {
    const ids = Array(numOfToken)
      .fill('')
      .map((_, i) => i + 1);

    const res = await this.client.readContract({
      address: ERC1155_ADDRESS as Address,
      abi: ERC1155ABI,
      functionName: 'balanceOfBatch',
      args: [Array(numOfToken).fill(address), ids.map((id) => BigInt(id))],
    });

    return { balanceOfAll: res.map((n) => Number(n)), ids };
  }

  async balanceOfERC404NFT(address: Address) {
    const res = await this.client.readContract({
      address: WIH_ADDRESS as Address,
      abi: HatABI,
      functionName: 'erc721BalanceOf',
      args: [address],
    });

    return res;
  }
}
