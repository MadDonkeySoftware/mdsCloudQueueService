import { Static, Type } from '@sinclair/typebox';

export const GetHealthResponseSchema = Type.Object({
  status: Type.String(),
});

export type GetHealthResponse = Static<typeof GetHealthResponseSchema>;
