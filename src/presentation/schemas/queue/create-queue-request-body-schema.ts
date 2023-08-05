import { Static, Type } from '@sinclair/typebox';

export const CreateQueueRequestBodySchema = Type.Object({
  name: Type.String(),
  resource: Type.Optional(Type.String()),
  dlq: Type.Optional(Type.String()),
  maxSize: Type.Optional(Type.Number()),
  delay: Type.Optional(Type.Number()),
  vt: Type.Optional(Type.Number()),
});

export type CreateQueueRequestBody = Static<
  typeof CreateQueueRequestBodySchema
>;
