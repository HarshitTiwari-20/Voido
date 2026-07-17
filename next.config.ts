import type { NextConfig } from "next";
import path from "path";

// Force Turbopack to use THIS project as root (parent ~/package-lock.json
// otherwise makes Next resolve modules from the home directory).
const projectRoot = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  // Ensure file tracing also stays scoped to this app
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
