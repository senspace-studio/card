import { unparse } from 'papaparse'
import fs from 'fs'

const addresses = [
  '0x7b20652910251fdf7d1b57dfc9159e3ca2f12a4f',
  '0x135e79d385f8ab419b9ea7ec07a5144ff526f98b',
  '0x2a54cb5cfaae1ca5a96b039a0889b7dafff1befa',
]

const main = async () => {
  for (const address of addresses) {
    let { items, next_page_params } = await getData(address)
    console.log(`Getting data for ${address}`)
    while (next_page_params !== null) {
      const { items: newItems, next_page_params: newNextPageParams } =
        await getData(
          address,
          next_page_params.block_number,
          next_page_params.index
        )
      items.push(...newItems)
      console.log(newNextPageParams)
      next_page_params = newNextPageParams
      // sleep 1sec
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    const data = items
      .filter(
        (item: any) =>
          item.from.hash === '0x0000000000000000000000000000000000000000'
      )
      .map((item: any) => {
        return {
          contract_address: address,
          minter_address: item.to.hash,
          token_id: item.total.token_id,
          amount: item.total.value,
          timestamp: item.timestamp,
        }
      })

    console.log(
      // total of amount
      data.reduce((acc: number, item: any) => acc + Number(item.amount), 0)
    )

    // parse data to csv and save
    const csv = unparse(data, { header: true })
    fs.writeFileSync(`${address}.csv`, csv)

    console.log(`Saved ${address}.csv`)
  }
}

const getData = async (
  address: string,
  block_number?: number,
  index?: number
) => {
  let apiURL = `https://explorer.zora.energy/api/v2/tokens/${address}/transfers`
  if (block_number && index) {
    apiURL = apiURL + `?block_number=${block_number}&index=${index}`
  }

  const { items, next_page_params } = await fetch(apiURL).then((response) =>
    response.json()
  )

  return { items, next_page_params }
}

main()
