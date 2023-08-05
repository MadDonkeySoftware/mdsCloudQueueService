import { Static, Type } from '@sinclair/typebox';

export const GetQueueDetailsResponseBodySchema = Type.Object({
  orid: Type.String(),
  resource: Type.Union([Type.String(), Type.Null()]),
  dlq: Type.Union([Type.String(), Type.Null()]),
});

export type GetQueueDetailsResponseBody = Static<
  typeof GetQueueDetailsResponseBodySchema
>;
