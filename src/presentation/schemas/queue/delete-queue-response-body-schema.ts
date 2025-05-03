import { Static, Type } from '@sinclair/typebox';

export const DeleteQueueResponseBodySchema = Type.Object({
  message: Type.Optional(Type.String()),
});

export type DeleteQueueResponseBody = Static<
  typeof DeleteQueueResponseBodySchema
>;
