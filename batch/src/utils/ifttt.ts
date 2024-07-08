export const sendErrorNotification = async (error: Error) => {
  await fetch(
    `https://maker.ifttt.com/trigger/Data_Flow_BatchError/with/key/dqfQO2K2rgvDK2Cq6pwo03?value1=SaveBattleLogs&value2=${encodeURIComponent(
      JSON.stringify(error),
    )}`,
  );
};
