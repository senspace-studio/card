/* eslint-disable @typescript-eslint/no-var-requires */
const { http, createPublicClient, getContract } = require('viem');
// const { zoraSepolia } = require('viem/chains');
const { baseSepolia } = require('viem/chains');
const nft = require('./ZoraCreator1155Impl.json');
const gasha = require('./Gasha.json');

const BLOCKCHAIN_API =
  process.env.BLOCKCHAIN_API ||
  'https://base-sepolia.g.alchemy.com/v2/5kVob7zDOtjcG4NjjhECSAFH15_LVZsk';
const ERC1155_ADDRESS =
  process.env.ERC1155_ADDRESS || '0x29108d08E04F8B89e970cB4Adb8c72d8C57e67EB';
const GASHA_ADDRESS =
  process.env.GASHA_ADDRESS || '0x550710763F44094c2F5E1b756521620a6004959c';

// const nftAddress = '0xDD3b3b34FcB47d761B1aac2358E7703Aa8CD3b92';
// const gashaAddress = '0x1994176e3Ce8ff95ceE85a22D575728838619a17';

const nftAddress = ERC1155_ADDRESS;
const gashaAddress = GASHA_ADDRESS;

const abi = gasha.abi;
const address = gashaAddress;

const main = async () => {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(BLOCKCHAIN_API),
  });
  const contract = getContract({
    address,
    abi,
    client,
  });
  const res = await contract.read.seriesItems();
  console.log(res);
  // const events = await client.getContractEvents({
  //   address,
  //   abi,
  //   fromBlock: 7373900n,
  //   toBlock: 7374000n,
  // });

  // // console.dir(events);
  // for (const event of events) {
  //   const { eventName, args, blockNumber, transactionHash } = event;
  //   console.log({ eventName, args, blockNumber, transactionHash });
  //   const block = await client.getBlock({ blockNumber });
  //   console.log(block);
  //   console.log(block.timestamp);
  //   console.log(new Date(Number(block.timestamp) * 1e3));
  // }
};

main();
