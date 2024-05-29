export type EventLog = {
  type: 'event-log';
  data: {
    chainId: number;
    contractAddress: string;
    blockNumber: number;
    transactionHash: string;
    topics: string[];
    data: string;
    eventName: string;
    decodedLog: any;
    timestamp: number;
    transactionIndex: number;
    logIndex: number;
  };
};

export type TransactionReceipt = {
  type: 'transaction-receipt';
  data: {
    chainId: number;
    blockNumber: number;
    contractAddress: string;
    transactionHash: string;
    blockHash: string;
    timestamp: number;
    data: string;
    value: string;
    to: string;
    from: string;
    transactionIndex: number;
    gasUsed: string;
    effectiveGasPrice: string;
    status: number;
  };
};
