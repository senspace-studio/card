import * as os from 'os';
import * as __cluster__ from 'cluster';
import { Cluster } from 'cluster';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './modules/app.module';

const cluster = __cluster__ as unknown as Cluster;
const numCPUs = os.cpus().length > 8 ? 8 : os.cpus().length;

const logger = new Logger(cluster.isPrimary ? 'Primary' : 'Worker');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
  });
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  await app.listen(process.env.PORT || 3000);
}
// bootstrap();
const primaryProcess = () => {
  logger.log(`Primary server started on ${process.pid} cpu len: ${numCPUs}`);
  // workerが落ちたときのために、cron処理を行うworkerのidを格納
  const cronWorker = { id: 0 };
  for (let i = 0; i < numCPUs; i++) {
    logger.log(`cluster fork: ${i}`);
    if (i === 0) {
      // cron処理を行うworkerは環境変数を追加
      const worker = cluster.fork({ RUN_CRON: 'true' });
      // idを格納
      cronWorker.id = worker.id;
    } else {
      cluster.fork();
    }
  }
  cluster.on('exit', (worker, code, signal) => {
    logger.warn(
      `[${worker.id}] Worker died : [PID ${worker.process.pid}] [Signal ${signal}] [Code ${code}]`,
    );
    // 落ちたものがcron処理を行っていたworkerかを判定
    if (cronWorker.id === worker.id) {
      // cron処理を行うworkerは環境変数を追加
      // idを格納
      const worker = cluster.fork({ RUN_CRON: 'true' });
      cronWorker.id = worker.id;
    } else {
      cluster.fork();
    }
  });
};

const workerProcess = () => {
  logger.log(`bootstrap@${process.pid}`);
  bootstrap();
};

if (cluster.isMaster || cluster.isPrimary) {
  primaryProcess();
} else {
  workerProcess();
}
