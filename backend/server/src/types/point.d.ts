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
