// The default configuration for the application. Override this and mount it to your docker
// container at /usr/src/app/config/index.js
// or
// Create a new file based on the default config, place it in another location and set the
// environment variable MDS_QS_CONFIG to the full path excluding the file and extension.
// Ex: for the file "/var/mds-qs/config/index.js" use "/var/mds-qs/config"

const defaultConfig = {
  DbUrl: 'sqlite://:memory:',
};

const config = process.env.MDS_QS_CONFIG
  ? require(process.env.MDS_QS_CONFIG) // eslint-disable-line import/no-dynamic-require
  : defaultConfig;

module.exports = config;
