import 'dotenv/config';
import { API_ENDPOINT, STACK_VARIABLES_CONTRACT_ADDRESS } from "./config";
import { IndividualStackData, RewardHistoryData } from './type';
import { Address, getContract } from 'viem';
import { getFileFromS3 } from './utils/s3';
import { degenClient, getGameRevealedLogs } from './batch';
import { uploadS3 } from './utils/s3';
import StackVariablesABI from './abi/StackVariables.json';

const MAX_REWARD_AMOUNT_RATIO = 190;

export const handler = async (year: number, month: number, day: number) => {
  const historyFile = await getFileFromS3('reward_history/history.json');
  const history: RewardHistoryData[] = historyFile || [];

  const startdate = Math.floor(Date.UTC(year, month - 1, day - 1, 3) / 1e3);
  const enddate = startdate + (24 * 60 * 60);
  const beforedate = startdate - (24 * 60 * 60);
  const res = await fetch(
    `${API_ENDPOINT}/points/calcurate-score?end_date_unix=${enddate * 1e3}`
  );
  const resData = (await res.json()) as [Address, number][];
  console.log(resData);
  const totalStack = resData.map((e) => e[1]).reduce((a, b) => a + b);
  const battleLogs = await getGameRevealedLogs(beforedate, startdate);
  console.log(battleLogs);
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
    contract.read.bonusMultiprierBottom()
      .then((res) => Number(res)),
    contract.read.bonusMultiprierTop()
      .then((res) => Number(res)),
    contract.read.difficultyBottom()
      .then((res) => Number(res)),
    contract.read.difficultyTop()
      .then((res) => Number(res)),
  ]);
  const bonusMultiplier = bonusMultiprierTop / bonusMultiprierBottom
  const difficulty = difficultyTop / difficultyBottom;
  console.log({
    maxRewardAmount,
    difficulty,
    bonusMultiplier,
    totalStack,
    date: `${year}/${`00${month + 1}`.slice(-2)}/${`00${day}`.slice(-2)}`,
  });
  history.push({
    maxRewardAmount,
    difficulty,
    bonusMultiplier,
    totalStack,
    date: `${year}/${`00${month + 1}`.slice(-2)}/${`00${day}`.slice(-2)}`,
  });
  // ToDo: ファイル名変更
  await uploadS3(
    history,
    `reward_history/history.json`,
  );
}
// handler(2024, 6, 25);