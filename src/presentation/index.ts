import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import { fastifyAwilixPlugin, diContainer, Cradle } from '@fastify/awilix';
import config from 'config';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { rootRouter } from './routes/root-router';
import { AwilixContainer } from 'awilix';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { diContainerInit } from './di-container-init';
import { Logic } from '../core/classes/logic';

export async function buildApp(
  dependencyInjectionOverride?: ({
    diContainer,
    server,
  }: {
    diContainer: AwilixContainer<Cradle>;
    server: FastifyInstance;
  }) => Promise<void>,
) {
  // Note: The object coming out of the config is immutable. We spread into
  // a new object so that fastify can modify the object internally as it expects
  // to do.
  const fastifyOptions: FastifyServerOptions = {
    ...config.get<FastifyServerOptions>('fastifyOptions'),
  };
  const server = fastify(fastifyOptions);
  server.withTypeProvider<TypeBoxTypeProvider>();

  // We ignore the swagger block given that it is only used for development. When
  // enabled it causes errors in the test runner.
  /* istanbul ignore next */
  if (config.get<boolean>('enableSwagger')) {
    server.register(fastifySwagger, {
      swagger: {
        produces: ['application/json'],
        consumes: ['application/json'],
      },
    });

    server.register(fastifySwaggerUi, {
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    });
  }

  server.register(fastifyAwilixPlugin, {
    disposeOnClose: true,
    disposeOnResponse: true,
  });

  if (dependencyInjectionOverride) {
    await dependencyInjectionOverride({ diContainer, server });
  } else {
    await diContainerInit({ diContainer, server });
  }

  // await server.register(multipart);
  await server.register(rootRouter);

  server.addHook('onRequest', (request, reply, done) => {
    // We proxy all the diScope services here so that various code editor "find all references" works properly.
    request.services = {
      get logic() {
        return request.diScope.resolve<Logic>('logic');
      },
    };

    done();
  });

  return server;
}
