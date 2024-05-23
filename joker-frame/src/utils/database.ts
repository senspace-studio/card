import mysql from "mysql2/promise";
import { Client } from "ssh2";

import { getEncodedUrl } from "./getEncodedUrl";

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
    throw new Error("DB_HOST or DB_PORT is not defined");
  }

  return new Promise<mysql.Connection>(async (resolve, reject) => {
    sshClient
      .on("ready", async () => {
        sshClient.forwardOut(
          "127.0.0.1", // ローカルアドレス
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
          }
        );
      })
      .connect(sshConfig);

    sshClient.on("error", (err) => {
      reject(err);
    });
  });
};

export const getEncodedImageUrlFromHash = async (hash: string) => {
  const query = "SELECT image FROM image WHERE hash = ?";

  const connection = await connectToDatabase();

  const [rows, fields] = (await connection.execute(query, [
    hash,
  ])) as mysql.RowDataPacket[][];
  await connection.end();
  const imageUrl = rows[0]?.image;
  const encodedImageUrl = getEncodedUrl(imageUrl!);

  return encodedImageUrl;
};

export const setHashAndImageUrl = async (hash: string, imageUrl: string) => {
  const query = "INSERT IGNORE INTO image (hash, image) VALUES (?, ?)";
  const connection = await connectToDatabase();
  await connection.execute(query, [hash, imageUrl]);
  connection.end();
};
