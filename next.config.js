// eslint-disable-next-line @typescript-eslint/no-var-requires
const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['avatars.githubusercontent.com', 'raw.githubusercontent.com'],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // @base-org/account (pulled in transitively via wagmi's Coinbase Smart
    // Wallet connector) conditionally imports x402 payment-protocol modules
    // that are optional at runtime. ARCTIS never calls this code path, but
    // webpack tries to statically resolve every import it finds. These
    // modules are genuinely not needed and not installed — ignore them
    // explicitly rather than installing unused packages.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@x402\//,
      })
    );

    
    config.externals = config.externals || [];
    config.externals.push({
      'pino-pretty': 'commonjs pino-pretty',
      'encoding': 'commonjs encoding',
      '@react-native-async-storage/async-storage': 'commonjs @react-native-async-storage/async-storage',
    });

    return config;
  },
};

module.exports = nextConfig;
