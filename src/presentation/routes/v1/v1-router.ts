import { FastifyInstance } from 'fastify';
import { queuesController, messagesController } from '../../controllers/v1';

export async function v1Router(app: FastifyInstance) {
  await app.register(queuesController, { prefix: '/' });
  await app.register(messagesController, { prefix: '/' });
}
