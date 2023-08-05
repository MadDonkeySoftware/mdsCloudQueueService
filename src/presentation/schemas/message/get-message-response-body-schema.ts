import { Static, Type } from '@sinclair/typebox';

export const GetMessageResponseBodySchema = Type.Union([
  Type.Object({
    id: Type.String(),
    message: Type.String(),
    rc: Type.Number(),
  }),
  Type.Object({}),
]);

export type GetMessageResponseBody = Static<
  typeof GetMessageResponseBodySchema
>;
