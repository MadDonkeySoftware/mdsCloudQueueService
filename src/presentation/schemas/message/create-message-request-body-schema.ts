import { Static, Type } from '@sinclair/typebox';

export const CreateMessageRequestBodySchema = Type.Union([
  Type.String(),
  Type.Number(),
  Type.Boolean(),
  Type.Null(),
  Type.Array(Type.Any()),
  Type.Unknown(),
]);

export type CreateMessageRequestBody = Static<
  typeof CreateMessageRequestBodySchema
>;
