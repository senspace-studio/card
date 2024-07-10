import 'dotenv/config';
import { API_ENDPOINT, STACK_ALGORITHM } from './config';
import { EventBridgeInput, IndividualStackData } from './type';
import { Address } from 'viem';
import { uploadS3 } from './utils/s3';
import { sendErrorNotification } from './utils/ifttt';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export const handler = async (event: EventBridgeInput) => {
  try {
    const endDate = dayjs(event.time)
      .utc()
      .set('hours', 3)
      .startOf('hours')
      .unix();
    const startDate = endDate - 24 * 60 * 60;
    const res = await fetch(
      `${API_ENDPOINT}/points/calcurate-score?end_date_unix=${endDate * 1e3}`,
    );
    const resData = (await res.json()) as [Address, number][];
    const algorithm = STACK_ALGORITHM;
    const data: IndividualStackData = {
      date: `${dayjs(startDate * 1e3)
        .add(1, 'day')
        .format('YYYY-MM-DD')}`,
      algorithm, // 'HC-01'
      data: [],
    };

    for (const [address, score] of resData) {
      data.data.push({ address, score });
    }

    await uploadS3(
      { data, startDate, endDate },
      `individualStack/${dayjs(startDate * 1e3)
        .add(1, 'day')
        .format('YYYY-MM-DD')}.json`,
    );
  } catch (error: any) {
    console.error(error);
    await sendErrorNotification('SaveIndividualStackData', error);
  }
};
