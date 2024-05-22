import { parseEther } from 'ethers'
import { ethers } from 'hardhat'

const main = async () => {
  const to = '0x3F134398b2758777694Bb13CEB24B28F1700a9e3'
  const Gasha = await ethers.getContractAt(
    'Gasha',
    '0x96E9215696733f7AD091A3D2437dAf892eF296C8'
  )

  const activeTokens = await Gasha.activeSeriesItems()

  const dropList: any = { '1': 0, '2': 0, '3': 0 }

  // 30 times
  for (let i = 0; i < 30; i++) {
    const totalWeight = activeTokens.reduce(
      (acc, item) => acc + Number(item.weight),
      0
    )
    let randomNumber = Math.random() * totalWeight

    let tokenId!: string
    for (const item of activeTokens) {
      randomNumber -= Number(item.weight)
      if (randomNumber <= 0) {
        tokenId = String(item.tokenId)
        break
      }
    }
    dropList[tokenId]++
  }

  Gasha.dropByOwner(
    to,
    [1, 2, 3],
    [dropList['1'], dropList['2'], dropList['3']],
    {
      value: parseEther(String(0.000777 * 30)),
    }
  )
}

main()
