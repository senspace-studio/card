import { ethers } from 'hardhat'
import { Gasha__factory } from '../../typechain-types'
import failedList from './failedList.json'

const main = async () => {
  let startBlock = 12508500
  const currentBlockNumber = await ethers.provider.getBlockNumber()

  const unit = 100
  const list = [...failedList]
  while (startBlock < currentBlockNumber) {
    const endBlock = startBlock + unit
    console.log(`${startBlock} < ${endBlock}`)
    const events = await ethers.provider.getLogs({
      address: '0x96E9215696733f7AD091A3D2437dAf892eF296C8',
      topics: [],
      fromBlock: startBlock,
      toBlock: endBlock,
    })

    // parse log data with ether.js
    for (const event of events) {
      try {
        const log = Gasha__factory.createInterface().parseLog({
          data: event.data,
          topics: event.topics,
        })
        if (log?.name === 'Spin') {
          const address = log.args[0]
          // if list includes address remove from list, each item type is {address: string, id: number}
          const index = list.findIndex((item) => item.address === address)
          if (index !== -1) {
            list.splice(index, 1)
          }
        }
      } catch (error) {
        continue
      }
    }

    startBlock += unit
    // sleep 2 sec
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  console.log(list)
}

main()
