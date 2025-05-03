import { Static, Type } from '@sinclair/typebox';

export const DeleteMessageResponseBodySchema = Type.Object({
  message: Type.Optional(Type.String()),
});

export type DeleteMessageResponseBody = Static<
  typeof DeleteMessageResponseBodySchema
>;
