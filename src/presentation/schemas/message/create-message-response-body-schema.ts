import { Static, Type } from '@sinclair/typebox';

export const CreateMessageResponseBodySchema = Type.Undefined();

export type CreateMessageResponseBody = Static<
  typeof CreateMessageResponseBodySchema
>;
