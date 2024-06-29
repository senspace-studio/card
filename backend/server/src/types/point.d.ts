export type PointCalcResponse = {
  special: {
    amount: bigint;
    points: bigint;
  };
  rare: {
    amount: bigint;
    points: bigint;
  };
  common: {
    amount: bigint;
    points: bigint;
  };
};

export type SpinResult = {
  minter: string;
  ids: number[];
  quantities: number[];
};

export type GameRevealedEventLog = {
  gameId: string;
  maker: string;
  challenger: string;
  winner: string;
  date: number;
  blockNumber: number;
};

export type TransferEventLog = {
  from: string;
  to: string;
  tokenId: number;
  date: number;
  blockNumber: number;
};
