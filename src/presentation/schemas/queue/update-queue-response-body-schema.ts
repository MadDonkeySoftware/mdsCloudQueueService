import { Static, Type } from '@sinclair/typebox';

export const UpdateQueueResponseBodySchema = Type.Object({
  message: Type.Optional(Type.String()),
});

export type UpdateQueueResponseBody = Static<
  typeof UpdateQueueResponseBodySchema
>;
