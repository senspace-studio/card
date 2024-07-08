import { S3 } from 'aws-sdk';
import { NODE_ENV, S3_BACKET_NAME } from '../config';
import fs from 'fs';

export const uploadS3 = async (data: any, key: string) => {
  console.log('Saving to S3:', key, '...');

  if (NODE_ENV === 'development') {
    const ext = key.split('.').pop();
    fs.writeFileSync(
      `./.tmp/${new Date().getTime()}.${ext}`,
      JSON.stringify(data, null, 2),
    );
    return;
  }

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
