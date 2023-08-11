export type QueueDetails = {
  orid: string;
  meta: {
    dlq?: string | null;
    resource?: string | null;
  };
  maxSize?: number;
  delay?: number;
  visibilityTimeout?: number;
  currentMessages: number;
};

export type CreateQueueArgs = {
  name: string;
  meta: {
    dlq?: string | null;
    resource?: string | null;
  };
  maxSize?: number;
  delay?: number;
  visibilityTimeout?: number;
};

export type UpdateQueueArgs = {
  queueOrid: string;
  dlq?: string | null;
  resource?: string | null;
};

export type RemoveQueueArgs = {
  queueOrid: string;
};

export type GetQueueDetailsArgs = {
  queueOrid: string;
};

export type CreateMessageArgs = {
  queueOrid: string;
  message: string;
  delay?: number;
};

export type GetMessageArgs = {
  queueOrid: string;
  visibilityTimeout?: number;
};

export type GetMessageResult = {
  id: string;
  message: string;
  rc: number;
};

export type RemoveMessageArgs = {
  queueOrid: string;
  messageId: string;
};

export type HealthChecksResult = {
  queueStatus: string;
  redisStatus: string;
};

export interface QueueRepo {
  createQueue: (args: CreateQueueArgs) => Promise<void>;
  listQueues: (account?: string) => Promise<string[]>;
  updateQueue: (args: UpdateQueueArgs) => Promise<void>;
  removeQueue: (args: RemoveQueueArgs) => Promise<void>;
  getQueueDetails: (args: GetQueueDetailsArgs) => Promise<QueueDetails>;

  createMessage: (args: CreateMessageArgs) => Promise<void>;
  getMessage: (args: GetMessageArgs) => Promise<GetMessageResult | null>;
  removeMessage: (args: RemoveMessageArgs) => Promise<number>;

  healthChecks: () => Promise<HealthChecksResult>;
}
