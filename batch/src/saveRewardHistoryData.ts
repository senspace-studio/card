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
  // const historyFile = null;
  const historyFile = await getFileFromS3('reward_history/history.json');
  const history: RewardHistoryData[] = historyFile || [];

  const startdate = Math.floor(Date.UTC(year, month - 1, day - 1, 3) / 1e3);
  const enddate = startdate + (24 * 60 * 60);
  const beforedate = startdate - (24 * 60 * 60);
  const [calcuratedScores, battleLogs] = await Promise.all([
    fetch(`${API_ENDPOINT}/points/calcurate-score?end_date_unix=${enddate * 1e3}`)
      .then(res => res.json() as unknown as Promise<[Address, number][]>),
    getGameRevealedLogs(beforedate, startdate)
  ]);
  const totalStack = calcuratedScores.map((e) => e[1]).reduce((a, b) => a + b);
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
  history.push({
    maxRewardAmount,
    difficulty,
    bonusMultiplier,
    totalStack,
    date: `${year}/${`00${month}`.slice(-2)}/${`00${day}`.slice(-2)}`,
  });
  // console.log(history);
  // ToDo: ファイル名変更
  await uploadS3(
    history,
    `reward_history/history.json`,
  );
}
// handler(2024, 6, 25);