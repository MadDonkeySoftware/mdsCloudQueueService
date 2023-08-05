import { Static, Type } from '@sinclair/typebox';

export const GetQueueLengthResponseBodySchema = Type.Object({
  orid: Type.String(),
  size: Type.Number(),
});

export type GetQueueLengthResponseBody = Static<
  typeof GetQueueLengthResponseBodySchema
>;
