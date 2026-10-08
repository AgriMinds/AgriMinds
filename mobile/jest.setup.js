// Official in-memory mock for AsyncStorage so storage helpers can be imported in unit tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
