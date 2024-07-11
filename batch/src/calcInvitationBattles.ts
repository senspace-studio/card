import dayjs from 'dayjs';
import {
  getGameRevealedLogs,
  getInvivationTransferLogs,
  TransferEventLog,
} from './batch';
import { EventBridgeInput } from './type';
import { getFileFromS3, uploadS3 } from './utils/s3';
import { sendErrorNotification } from './utils/ifttt';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export const handler = async (event: EventBridgeInput) => {
  try {
    const endDate = dayjs(event.time)
      .utc()
      .set('hours', 3)
      .startOf('hours')
      .unix();
    const startInvivationDateUnix = endDate - 14 * 24 * 60 * 60;
    const startGameDateUnix = endDate - 3 * 24 * 60 * 60;

    const lastFile = await getFileFromS3(
      `calcInvitationBattles/${dayjs(event.time)
        .subtract(1, 'day')
        .format('YYYY-MM-DD')}.json`,
    );
    const lastInvitations: TransferEventLog[] = lastFile
      ? lastFile.invivations
      : [];

    const [invitationLogs, gameLogs] = await Promise.all([
      getInvivationTransferLogs(
        startInvivationDateUnix,
        endDate,
        lastInvitations,
      ),
      getGameRevealedLogs(startGameDateUnix, endDate),
    ]);

    const uniquePlayers = new Set<string>();
    invitationLogs.forEach((eventLog) => {
      uniquePlayers.add(eventLog.from);
    });

    const playerBattles = new Map<string, number>();

    for (const player of uniquePlayers) {
      const playerEvents = invitationLogs.filter(
        (eventLog) => eventLog.from.toLowerCase() === player.toLowerCase(),
      );

      const playerBattle = playerEvents.reduce((acc, eventLog) => {
        const invitee = eventLog.to.toLowerCase();

        if (player.toLowerCase() === invitee.toLowerCase()) {
          return acc;
        }

        const playCount = gameLogs.filter(
          (gameLog) =>
            gameLog.data.maker.toLowerCase() === invitee ||
            gameLog.data.challenger.toLowerCase() === invitee,
        ).length;

        return acc + playCount;
      }, 0);

      playerBattles.set(player.toLowerCase(), playerBattle);
    }

    await uploadS3(
      {
        invivations: invitationLogs,
        battles: Array.from(playerBattles).map(([address, battles]) => ({
          address,
          battles,
        })),
        updatedAt: endDate,
      },
      `calcInvitationBattles/${dayjs(event.time).format('YYYY-MM-DD')}.json`,
    );
  } catch (error: any) {
    console.error(error);
    await sendErrorNotification('calcInvitationBattles', error);
  }
};
