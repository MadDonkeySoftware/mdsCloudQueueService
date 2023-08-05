import { Static, Type } from '@sinclair/typebox';

export const ListQueuesResponseBodySchema = Type.Array(
  Type.Object({
    name: Type.String(),
    orid: Type.String(),
  }),
);

export type ListQueuesResponseBody = Static<
  typeof ListQueuesResponseBodySchema
>;
