import mysql from 'mysql2/promise';
import { Client } from 'ssh2';

const sshConfig = {
  host: process.env.SSH_HOST,
  port: Number(process.env.SSH_PORT) || 22,
  username: process.env.SSH_USER,
  privateKey: process.env.SSH_KEY,
};

const dbConfig = {
  host: process.env.DB_HOST as string,
  user: process.env.DB_USER as string,
  password: process.env.DB_PASSWORD as string,
  database: process.env.DB_DATABASE as string,
  port: Number(process.env.DB_PORT) || 3306,
};

const connectToDatabase = async () => {
  const sshClient = new Client();

  if (dbConfig.host === undefined) {
    throw new Error('DB_HOST or DB_PORT is not defined');
  }

  return new Promise<mysql.Connection>(async (resolve, reject) => {
    sshClient
      .on('ready', async () => {
        sshClient.forwardOut(
          '127.0.0.1', // ローカルアドレス
          0, // ローカルポート
          dbConfig.host, // リモートのMySQLサーバーのホスト
          dbConfig.port, // リモートのMySQLサーバーのポート
          async (err, stream) => {
            if (err) {
              console.log(err);
              reject(err);
              return;
            }

            try {
              const connection = await mysql.createConnection({
                ...dbConfig,
                stream,
              });
              resolve(connection);
            } catch (error) {
              reject(error);
            }
          },
        );
      })
      .connect(sshConfig);

    sshClient.on('error', (err) => {
      reject(err);
    });
  });
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
  };
};

export const setGameInfo = async (
  id: string,
  address: string,
  userName: string,
  pfp_url: string,
  wager: number,
  createdAt: bigint,
) => {
  const query =
    'INSERT IGNORE INTO game (gameId, address, userName, pfp_url, wager, createdAt) VALUES (?, ?, ?, ?, ?, ?)';
  const connection = await connectToDatabase();
  await connection.execute(query, [
    id,
    address,
    userName,
    pfp_url,
    wager,
    createdAt,
  ]);
  connection.end();
};

export const updateChallenger = async (
  id: string,
  c_address: string,
  c_userName: string,
  c_pfp_url: string,
) => {
  console.log('update query');
  console.log([c_address, c_userName, c_pfp_url, id]);
  const query =
    'UPDATE game SET c_address = ?, c_userName = ?, c_pfp_url = ? WHERE gameId = ?';
  const connection = await connectToDatabase();
  await connection.execute(query, [c_address, c_userName, c_pfp_url, id]);
  connection.end();
};

export const updateResult = async (
  id: string,
  card: number,
  c_card: number,
  winner: string,
) => {
  const query =
    'UPDATE game SET card = ?, c_card = ?, winner = ? WHERE gameId = ?';
  const connection = await connectToDatabase();
  await connection.execute(query, [card, c_card, winner, id]);
  connection.end();
};
