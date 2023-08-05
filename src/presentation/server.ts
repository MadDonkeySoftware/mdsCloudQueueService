import config from 'config';
import { buildApp } from './index';
import { MdsSdk } from '@maddonkeysoftware/mds-cloud-sdk-node';
import { IntervalInvoker } from '../core/classes/interval-invoker';

// skipcq: JS-0098
void (async () => {
  // NOTE: the MdsSdk is used in the dependency initialization, so it must be initialized first
  const mdsSdkConfig = config.get<Record<string, unknown>>('mdsSdk');
  await MdsSdk.initialize(mdsSdkConfig);

  const port = config.get<number>('apiPort');
  const app = await buildApp();

  try {
    const address = await app.listen({ port, host: '::' });

    app.log.info(
      app.printRoutes({
        includeHooks: false,
        includeMeta: ['metaProperty'],
      }),
    );

    app.log.info(`Server listening at ${address}`);

    // TODO: Remove this once we have a better way to start the invoker.
    // I.e. maybe the invoker should be a separate process similar to the
    // docker minion used by serverless functions.
    const invoker = app.diContainer.resolve<IntervalInvoker>('resourceInvoker');
    invoker.startMonitor();
    app.log.info('Resource invoker started');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
