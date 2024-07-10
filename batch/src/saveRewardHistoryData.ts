import 'dotenv/config';
import { API_ENDPOINT, STACK_VARIABLES_CONTRACT_ADDRESS } from './config';
import {
  EventBridgeInput,
  IndividualStackData,
  RewardHistoryData,
} from './type';
import { Address, getContract } from 'viem';
import { getFileFromS3 } from './utils/s3';
import { degenClient, getGameRevealedLogs } from './batch';
import { uploadS3 } from './utils/s3';
import StackVariablesABI from './abi/StackVariables.json';
import { sendErrorNotification } from './utils/ifttt';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const MAX_REWARD_AMOUNT_RATIO = 190;

export const handler = async (event: EventBridgeInput) => {
  try {
    // const historyFile = null;
    const historyFile = await getFileFromS3('reward/history.json');
    const history: RewardHistoryData[] = historyFile || [];

    const endDate = dayjs(event.time)
      .utc()
      .set('hours', 3)
      .startOf('hours')
      .unix();
    const startDate = endDate - 24 * 60 * 60;
    const beforedate = startDate - 24 * 60 * 60;

    const [calcuratedScores, battleLogs] = await Promise.all([
      fetch(
        `${API_ENDPOINT}/points/calcurate-score?end_date_unix=${endDate * 1e3}`,
      ).then((res) => res.json() as unknown as Promise<[Address, number][]>),
      getGameRevealedLogs(beforedate, startDate),
    ]);

    const totalStack = calcuratedScores
      .map((e) => e[1])
      .reduce((a, b) => a + b);
    const maxRewardAmount = battleLogs.length * MAX_REWARD_AMOUNT_RATIO;

    const contract = getContract({
      address: STACK_VARIABLES_CONTRACT_ADDRESS as Address,
      abi: StackVariablesABI,
      client: degenClient,
    });

    const [
      bonusMultiprierBottom,
      bonusMultiprierTop,
      difficultyBottom,
      difficultyTop,
    ] = await Promise.all([
      contract.read.bonusMultiprierBottom().then((res) => Number(res)),
      contract.read.bonusMultiprierTop().then((res) => Number(res)),
      contract.read.difficultyBottom().then((res) => Number(res)),
      contract.read.difficultyTop().then((res) => Number(res)),
    ]);

    const bonusMultiplier = bonusMultiprierTop / bonusMultiprierBottom;
    const difficulty = difficultyTop / difficultyBottom;

    history.push({
      maxRewardAmount,
      difficulty,
      bonusMultiplier,
      totalStack,
      date: `${dayjs(startDate * 1e3)
        .add(1, 'day')
        .format('YYYY-MM-DD')}`,
    });
    await uploadS3(history, `reward/history.json`);
  } catch (error: any) {
    console.error(error);
    await sendErrorNotification('SaveRewardHistoryData', error);
  }
};
