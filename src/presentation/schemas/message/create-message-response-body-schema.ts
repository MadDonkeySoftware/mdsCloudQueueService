import { Static, Type } from '@sinclair/typebox';

export const CreateMessageResponseBodySchema = Type.Object({
  messageId: Type.String(),
});

export type CreateMessageResponseBody = Static<
  typeof CreateMessageResponseBodySchema
>;
