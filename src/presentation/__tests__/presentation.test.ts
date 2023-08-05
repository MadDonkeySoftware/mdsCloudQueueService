import { buildApp } from '../index';
import { diContainerInit } from '../di-container-init';
import { diContainer } from '@fastify/awilix';
import { FastifyInstance } from 'fastify';

describe('presentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('defaultDependencyInjection', () => {
    it('registers expected items', async () => {
      try {
        // Arrange
        const fakeServer = {
          log: {},
        } as unknown as FastifyInstance;
        await diContainerInit({ diContainer, server: fakeServer });

        // Act
        const logic = diContainer.resolve('logic');
        const resourceInvoker = diContainer.resolve('resourceInvoker');

        // Assert
        expect(logic).not.toBeNull();
        expect(resourceInvoker).not.toBeNull();
      } finally {
        await diContainer.dispose();
      }
    });
  });

  describe('buildApp', () => {
    it('using default DI creates and starts container manager', () => {
      // Act & Assert
      expect(() => buildApp()).not.toThrow();
    });
  });
});
