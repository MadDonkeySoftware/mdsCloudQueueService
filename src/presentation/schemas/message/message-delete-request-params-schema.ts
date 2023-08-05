import { Static, Type } from '@sinclair/typebox';

export const MessageDeleteRequestParamsSchema = Type.Object({
  orid: Type.String(),
  messageId: Type.String(),
});

export type MessageDeleteRequestParams = Static<
  typeof MessageDeleteRequestParamsSchema
>;
