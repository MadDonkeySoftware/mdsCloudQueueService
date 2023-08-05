import { Static, Type } from '@sinclair/typebox';

export const DeleteMessageResponseBodySchema = Type.Undefined();

export type DeleteMessageResponseBody = Static<
  typeof DeleteMessageResponseBodySchema
>;
