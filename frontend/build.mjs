import { build } from 'vite';

try {
  await build();
} catch (err) {
  console.error(err);
  process.exit(1);
}

