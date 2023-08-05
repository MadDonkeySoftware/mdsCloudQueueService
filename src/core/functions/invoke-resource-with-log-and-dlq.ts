import { GetMessageResult, QueueRepo } from '../interfaces/queue-repo';
import { BaseLogger } from 'pino';

export type InvokeCallbackHandler = ({
  resource,
  message,
}: {
  resource: string;
  message: string;
}) => Promise<void>;
export type InvokeResourceWithLogArgs = {
  queue: string;
  queueRepo: QueueRepo;
  message: GetMessageResult;
  resource: string;
  dlq: string;
  logger: BaseLogger;
  cb: InvokeCallbackHandler;
};

export async function invokeResourceWithLog({
  queue,
  queueRepo,
  message,
  resource,
  dlq,
  logger,
  cb,
}: InvokeResourceWithLogArgs) {
  try {
    await cb({ resource, message: message.message });
    logger.info(
      {
        queue,
        messageId: message.id,
        resource,
      },
      'Invoked resource',
    );
    await queueRepo.removeMessage({
      queueOrid: queue,
      messageId: message.id,
    });
  } catch (err) {
    logger.error(
      {
        queue,
        messageId: message.id,
        resource,
        err,
      },
      'Error invoking resource',
    );
    await queueRepo.createMessage({
      queueOrid: dlq,
      message: message.message,
    });
    await queueRepo.removeMessage({
      queueOrid: queue,
      messageId: message.id,
    });
  }
}
