import { Static, Type } from '@sinclair/typebox';

export const CreateQueueResponseBodySchema = Type.Object({
  name: Type.String(),
  orid: Type.String(),
});

export type CreateQueueResponseBody = Static<
  typeof CreateQueueResponseBodySchema
>;
