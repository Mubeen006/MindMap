const net = require('net');

function checkPort(host, port, label) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });
}

async function main() {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = Number(process.env.REDIS_PORT || 6379);
  const dbUrl = process.env.DATABASE_URL || '';
  const dbMatch = dbUrl.match(/@([^:/]+):(\d+)/);
  const dbHost = dbMatch?.[1] || 'localhost';
  const dbPort = Number(dbMatch?.[2] || 5432);

  const [redisOk, postgresOk] = await Promise.all([
    checkPort(redisHost, redisPort, 'Redis'),
    checkPort(dbHost, dbPort, 'Postgres'),
  ]);

  if (redisOk && postgresOk) {
    console.log('Infrastructure OK (Redis + Postgres reachable)');
    return;
  }

  console.error('\nInfrastructure not ready. Start Docker services first:\n');
  if (!postgresOk) {
    console.error(`  - Postgres is not reachable at ${dbHost}:${dbPort}`);
  }
  if (!redisOk) {
    console.error(`  - Redis is not reachable at ${redisHost}:${redisPort}`);
  }
  console.error('\nRun from reel-knowledge-backend:\n');
  console.error('  docker compose up -d\n');
  console.error('Make sure Docker Desktop is running, then retry npm run start:dev.\n');
  process.exit(1);
}

main();
