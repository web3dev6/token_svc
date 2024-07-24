import buildServer from './server';

async function main() {
  const server = await buildServer();

  const port = process.env.PORT || '8081'; // Default to '3000' as a string if not specified
  const host = process.env.HOST || 'localhost'; // Default to 'localhost' if not specified

  // Start listening on server
  try {
    await server.listen({
      port: parseInt(port, 10), // Ensure port is parsed as an integer (base 10)
      host,
    });
    console.log(`Server listening at http://${host}:${port}`);
  } catch (e) {
    console.error(`Error in starting server at http://${host}:${port}`, e);
    process.exit(1);
  }
}

main();
