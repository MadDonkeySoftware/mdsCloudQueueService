module.exports = {
  // The port that the HTTP interface will listen upon for requests
  apiPort: 8888,

  // When true, enables the swagger interface. This should only be enabled for non-production environments.
  enableSwagger: false,

  fastifyOptions: {
    logger: {
      level: 'info',
      mixin: (mergeObject) => ({
        ...mergeObject,
        'event.dataset': 'mdsCloudQueue',
      }),
    },
  },

  // The redis instance that will be used for data persistence
  redisUrl: undefined,

  // MDS SDK configuration
  mdsSdk: {
    nsUrl: undefined,
    smUrl: undefined,
    sfUrl: undefined,
    identityUrl: undefined,
    account: undefined,
    userId: undefined,
    password: undefined,
  },

  // The provider element for all ORIDs created or consumed. Used in the validation process.
  oridProviderKey: 'orid',
};
