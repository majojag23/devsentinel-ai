import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  turbopack: {root},
  poweredByHeader: false,
  serverExternalPackages: ['@github/copilot-sdk'],
};
