import { Static, Type } from '@sinclair/typebox';

export const QueueActionRequestParamsSchema = Type.Object({
  orid: Type.String(),
});

export type QueueActionRequestParams = Static<
  typeof QueueActionRequestParamsSchema
>;
