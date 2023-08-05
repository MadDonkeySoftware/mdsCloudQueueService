import { Static, Type } from '@sinclair/typebox';

export const UpdateQueueRequestBodySchema = Type.Object({
  resource: Type.Optional(Type.String()),
  dlq: Type.Optional(Type.String()),
});

export type UpdateQueueRequestBody = Static<
  typeof UpdateQueueRequestBodySchema
>;
