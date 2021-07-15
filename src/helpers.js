const oridToRepoName = (inOrid) => inOrid.replace(/:/g, '_');
const repoNameToOrid = (inName) => inName.replace(/_/g, ':');

module.exports = {
  oridToRepoName,
  repoNameToOrid,
};
