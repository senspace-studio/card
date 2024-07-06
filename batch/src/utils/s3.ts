import { S3, Endpoint } from 'aws-sdk';
import { S3_ENDPOINT, S3_ACCESSKEY, S3_BACKET_NAME, S3_SECRET_ACCESSKEY } from '../config';

const createS3 = () => {
  const s3 = new S3({
    endpoint: new Endpoint(S3_ENDPOINT),
    region: "ap-northeast-1",
    s3ForcePathStyle: true, // MinIO利用時には必要そう。
    accessKeyId: S3_ACCESSKEY,
    secretAccessKey: S3_SECRET_ACCESSKEY,
    signatureVersion: 'v4',
  });
  return s3;
};

export const uploadS3 = async (data: any, key: string) => {
  if (!S3_BACKET_NAME) return;

  const s3 = createS3();

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

  const s3 = createS3();

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
