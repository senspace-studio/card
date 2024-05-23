/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, context) => {
    config.module.rules.push({
      test: /\.node$/,
      loader: "node-loader",
    });
    return config;
  },
};

export default nextConfig;
