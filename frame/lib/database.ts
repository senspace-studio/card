import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST as string,
  user: process.env.DB_USER as string,
  password: process.env.DB_PASSWORD as string,
  database: process.env.DB_DATABASE as string,
  port: Number(process.env.DB_PORT) || 3306,
};

const connectToDatabase = async () => {
  if (dbConfig.host === undefined) {
    throw new Error('DB_HOST or DB_PORT is not defined');
  }

  return mysql.createConnection(dbConfig);
};

export const getGameInfoByGameId = async (id: string) => {
  const query = 'SELECT * FROM game WHERE gameId = ?';

  const connection = await connectToDatabase();

  const [rows] = (await connection.execute(query, [
    id,
  ])) as mysql.RowDataPacket[][];
  await connection.end();

  if (rows.length === 0) {
    return null; // データが見つからなかった場合
  }

  const {
    address,
    userName,
    pfp_url,
    wager,
    c_address,
    c_userName,
    c_pfp_url,
    card,
    c_card,
    winner,
    numOfCards,
    sumOfCards,
  } = rows[0];

  return {
    address,
    userName,
    pfp_url,
    wager,
    c_address,
    c_userName,
    c_pfp_url,
    card,
    c_card,
    winner,
    numOfCards,
    sumOfCards,
  };
};

export const setGameInfo = async (
  id: string,
  address: string,
  userName: string,
  pfp_url: string,
  wager: number,
  createdAt: bigint,
  numOfCards: number,
  sumOfCards: number,
) => {
  const query =
    'INSERT IGNORE INTO game (gameId, address, userName, pfp_url, wager,createdAt, numOfCards, sumOfCards ) VALUES (?, ?, ?, ?, ?,FROM_UNIXTIME(?), ?, ?)';
  const connection = await connectToDatabase();
  await connection.execute(query, [
    id,
    address,
    userName,
    pfp_url,
    wager,
    createdAt,
    numOfCards,
    sumOfCards,
  ]);
  connection.end();
};

export const updateChallenger = async (
  id: string,
  c_address: string,
  c_userName: string,
  c_pfp_url: string,
) => {
  const query =
    'UPDATE game SET c_address = ?, c_userName = ?, c_pfp_url = ? WHERE gameId = ?';
  const connection = await connectToDatabase();
  await connection.execute(query, [c_address, c_userName, c_pfp_url, id]);
  connection.end();
};

export const updateResult = async (
  id: string,
  card: number[],
  c_card: number[],
  winner: string,
) => {
  const query =
    'UPDATE game SET card = ?, c_card = ?, winner = ? WHERE gameId = ?';

  // 配列をJSON文字列に変換
  const cardJson = JSON.stringify(card);
  const c_cardJson = JSON.stringify(c_card);

  const connection = await connectToDatabase();

  try {
    await connection.execute(query, [cardJson, c_cardJson, winner, id]);
  } catch (error) {
    console.error('Error updating result:', error);
    throw error;
  } finally {
    await connection.end();
  }
};
