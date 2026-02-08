// Define React Native globals needed in node environment
global.__DEV__ = true;

// Mock NativeWind's CSS interop (requires DOM in web mode, native bridge otherwise)
jest.mock("react-native-css-interop", () => ({
  cssInterop: jest.fn(),
  remapProps: jest.fn(),
  StyleSheet: { create: (s) => s },
}));

jest.mock("nativewind", () => ({}));

// Mock AsyncStorage for Zustand persist
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
