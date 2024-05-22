export type SpinEvent = {
  minter: Address;
  ids: [bigint, bigint, bigint];
  quantities: [bigint, bigint, bigint];
};
export type SeriesItem = {
  tokenId: bigint;
  rareness: number;
  weight: bigint;
  isActive: boolean;
};
