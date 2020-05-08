const testWithSafeEnv = (envDict, testCb) => {
  const beforeEnv = {};
  const keys = Object.keys(envDict);

  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    beforeEnv[key] = process.env[key];
    process.env[key] = envDict[key];
  }

  try {
    const result = testCb();
    if (result && result.then) {
      return () => result;
    }
    return result;
  } finally {
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const beforeVal = beforeEnv[key];
      if (beforeVal === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = beforeVal;
      }
    }
  }
};

module.exports = {
  testWithSafeEnv,
};
