import { zeroAddress } from 'viem';
import {
  getGameRevealedLogs,
  getInvivationTransferLogs,
  TransferEventLog,
} from './batch';
import { getFileFromS3, uploadS3 } from './utils/s3';

export const handler = async () => {
  try {
    const lastFile = await getFileFromS3('calcInvitationBattles/result.json');
    const lastInvitations: TransferEventLog[] = lastFile
      ? lastFile.invivations
      : [];

    const currentUnixTime = Math.floor(new Date().getTime() / 1e3);

    const startInvivationDateUnix =
      currentUnixTime - 14 * 24 * 60 * 60 < 1718722800
        ? Math.floor(new Date('2024-06-14').getTime() / 1e3)
        : currentUnixTime - 14 * 24 * 60 * 60;
    const startGameDateUnix = currentUnixTime - 3 * 24 * 60 * 60;

    const [invitationLogs, gameLogs] = await Promise.all([
      getInvivationTransferLogs(
        startInvivationDateUnix,
        currentUnixTime,
        lastInvitations,
      ),
      getGameRevealedLogs(startGameDateUnix, currentUnixTime),
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
            gameLog.maker.toLowerCase() === invitee ||
            gameLog.challenger.toLowerCase() === invitee,
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
        updatedAt: currentUnixTime,
      },
      'calcInvitationBattles/result.json',
    );
  } catch (error) {
    // ToDo: webhook
  }
};
