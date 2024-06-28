import { S3 } from 'aws-sdk';
import { S3_BACKET_NAME } from '../config';

export const uploadS3 = async (data: any, key: string) => {
  if (!S3_BACKET_NAME) return;

  const s3 = new S3();

  const params = {
    Bucket: S3_BACKET_NAME,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  };

  try {
    await s3.putObject(params).promise();
  } catch (error) {
    console.error(error);
  }
};

export const getFileFromS3 = async (key: string) => {
  if (!S3_BACKET_NAME) return;

  const s3 = new S3();

  const params = {
    Bucket: S3_BACKET_NAME,
    Key: key,
  };

  try {
    const result = await s3.getObject(params).promise();
    return JSON.parse(result.Body?.toString() || '');
  } catch (error) {
    console.error(error);
    return null;
  }
};
