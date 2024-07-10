import { IFTTT_WEBHOOK_URL } from '../config';

export const sendErrorNotification = async (name: string, error: Error) => {
  await fetch(
    `${IFTTT_WEBHOOK_URL}?value1=${name}&value2=${encodeURIComponent(
      JSON.stringify(error),
    )}`,
  );
};
