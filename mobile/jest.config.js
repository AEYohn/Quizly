module.exports = {
  testEnvironment: "./node_modules/react-native/jest/react-native-env.js",
  haste: {
    defaultPlatform: "ios",
    platforms: ["android", "ios", "native"],
  },
  resolver: "./node_modules/react-native/jest/resolver.js",
  transform: {
    "^.+\\.(js|jsx)$": ["babel-jest", {
      presets: [["babel-preset-expo", { jsxImportSource: "react" }]],
      plugins: [],
      configFile: false,
    }],
    "^.+\\.(ts|tsx)$": ["ts-jest", {
      tsconfig: {
        jsx: "react-jsx",
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|@testing-library/react-native|lucide-react-native|nativewind|react-native-css-interop)/)",
  ],
  setupFiles: ["./node_modules/react-native/jest/setup.js"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^react-native-css-interop(.*)$": "<rootDir>/jest/mocks/react-native-css-interop.js",
    "^nativewind/jsx-runtime$": "react/jsx-runtime",
    "^nativewind/jsx-dev-runtime$": "react/jsx-dev-runtime",
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
};
