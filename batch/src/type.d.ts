import { Address } from 'viem';

// Battle Data　(日付ごとに別ファイル)
export type BattleData = {
  gameId: string;
  maker: `0x${string}`;
  challenger: Address;
  winner: Address;
  loser: Address;
  isDraw: boolean;
  createdBlockNumber: number;
  createdAt: string; // '2024-07-03T18:45:30.123Z'
};

// InvitationTransfer Data (日付ごとに別ファイル)
export type InvitationTransferData = {
  inviter: Address;
  invitee: Address;
  tokenId: number;
  createdBlockNumber: number;
  createdAt: string; // '2024-07-03T15:30:00Z'
};

// Individual Stack Data (日付ごとに別ファイル)
export type IndividualStackData = {
  date: string; // '2024/07/03'
  algorithm: string; // 'HC-01'
  data: {
    address: Address;
    score: number;
  }[];
};

// Reward History Data (一つのファイル)
export type RewardHistoryData = {
  maxRewardAmount: number;
  difficulty: number;
  bonusMultiplier: number;
  totalStack: number;
  date: string; // '2024/07/03'
};

export type EventBridgeInput = {
  time: string;
};
