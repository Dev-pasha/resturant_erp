import { createAgentServer } from './server';

const port = Number(process.env['PRINT_AGENT_PORT'] ?? 3002);
createAgentServer().listen(port, '127.0.0.1', () => {
  console.log(`print-agent listening on http://127.0.0.1:${port}`);
});
