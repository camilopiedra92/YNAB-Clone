import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use a separate build directory for E2E tests so `next build` doesn't
  // overwrite the dev server's .next/ cache and crash it.
  distDir: process.env.NEXT_TEST_BUILD ? '.next-test' : '.next',
};

export default nextConfig;
