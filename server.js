import { connectDB } from './src/config/db.js';
import { loadBookFriendEnv, resolveLlmProvider } from './src/config/env.js';
import { createApp } from './src/app.js';

loadBookFriendEnv();

const app = createApp();

process.on('unhandledRejection', (reason) => {
  console.error('[BOOKFRIEND] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[BOOKFRIEND] Uncaught exception:', error);
  process.exit(1);
});

const port = process.env.PORT || 10000;

try {
  await connectDB();
} catch (error) {
  console.warn('[BOOKFRIEND] Starting in degraded mode without database:', error.message);
}

const { provider } = resolveLlmProvider();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[BOOKFRIEND] Agent server listening on ${port}`);
  // eslint-disable-next-line no-console
  console.log(`[BOOKFRIEND] LLM provider: ${provider}`);
});

