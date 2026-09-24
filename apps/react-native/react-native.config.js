module.exports = {
  project: {
    ios: {},
    android: {
      sourceDir: 'android',
      packageName: 'org.alavex.streaming',
    },
    windows: {
      sourceDir: 'windows',
      solutionFile: 'AlaveXStreaming.sln',
      project: {
        projectFile: 'AlaveXStreaming/AlaveXStreaming.vcxproj',
      },
    },
  },
};
