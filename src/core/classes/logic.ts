import config from 'config';
import {
  QueueRepo,
  CreateQueueArgs,
  UpdateQueueArgs,
  RemoveQueueArgs,
  GetQueueDetailsArgs,
  CreateMessageArgs,
  GetMessageArgs,
  RemoveMessageArgs,
} from '../interfaces/queue-repo';
import { v1 as oridV1 } from '@maddonkeysoftware/orid-node';
import {
  InvalidNameError,
  QueueExistsError,
  QueueNotFoundError,
  QueueUpdateConditionError,
} from '../errors';

export class Logic {
  #queueRepo: QueueRepo;

  constructor({ queueRepo }: { queueRepo: QueueRepo }) {
    this.#queueRepo = queueRepo;
  }

  #makeOridName(name: string, accountId: string) {
    return oridV1.generate({
      provider: config.get<string>('oridProviderKey'),
      service: 'qs',
      resourceId: name,
      custom3: accountId,
    });
  }

  listQueues(accountId?: string) {
    return this.#queueRepo.listQueues(accountId);
  }

  async createQueue(args: CreateQueueArgs & { accountId: string }) {
    const nameRegex = /^[a-zA-Z0-9-]+$/;
    if (!nameRegex.test(args.name) || args.name.length > 50) {
      throw new InvalidNameError(
        'Queue name invalid. Criteria: maximum length 50 characters, alphanumeric and hyphen only.',
      );
    }

    const oridName = this.#makeOridName(args.name, args.accountId);
    const existingQueues = await this.#queueRepo.listQueues();

    if (existingQueues.includes(oridName)) {
      throw new QueueExistsError(`Queue already exists: ${oridName}`);
    }

    await this.#queueRepo.createQueue({ ...args, name: oridName });

    return oridName;
  }

  async updateQueue(args: UpdateQueueArgs) {
    const { dlq, resource } = args;

    // Validate the parameters
    if ((resource && !dlq) || (!resource && dlq)) {
      throw new QueueUpdateConditionError(
        'When using resource or dlq both resource and dlq must be provided',
      );
    }

    if (resource && !oridV1.isValid(resource)) {
      throw new QueueUpdateConditionError('resource must be a valid orid');
    }

    if (dlq && !oridV1.isValid(dlq)) {
      throw new QueueUpdateConditionError('dlq must be a valid orid');
    }

    if (resource && dlq) {
      const resourceOrid = oridV1.parse(resource);
      const dlqOrid = oridV1.parse(dlq);

      const validResourceTypes = ['sf', 'sm'];
      if (!new Set(validResourceTypes).has(resourceOrid.service)) {
        throw new QueueUpdateConditionError(
          `Resource must be one of the following types: ${validResourceTypes.join(
            ', ',
          )}`,
        );
      }

      if (dlqOrid.service !== 'qs') {
        throw new QueueUpdateConditionError('DLQ must be a queue');
      }
    }

    await this.#queueRepo.updateQueue(args);
  }

  async deleteQueue(args: RemoveQueueArgs) {
    const existingQueues = await this.#queueRepo.listQueues();

    if (!existingQueues.includes(args.queueOrid)) {
      throw new QueueNotFoundError(`Queue does not exists: ${args.queueOrid}`);
    }

    await this.#queueRepo.removeQueue(args);
  }

  async getQueueDetails(args: GetQueueDetailsArgs) {
    const existingQueues = await this.#queueRepo.listQueues();

    if (!existingQueues.includes(args.queueOrid)) {
      throw new QueueNotFoundError(`Queue does not exists: ${args.queueOrid}`);
    }

    return this.#queueRepo.getQueueDetails(args);
  }

  async createMessage(args: CreateMessageArgs) {
    const existingQueues = await this.#queueRepo.listQueues();

    if (!existingQueues.includes(args.queueOrid)) {
      throw new QueueNotFoundError(`Queue does not exists: ${args.queueOrid}`);
    }

    await this.#queueRepo.createMessage(args);
  }

  getMessage(args: GetMessageArgs) {
    return this.#queueRepo.getMessage(args);
  }

  removeMessage(args: RemoveMessageArgs) {
    return this.#queueRepo.removeMessage(args);
  }
}
