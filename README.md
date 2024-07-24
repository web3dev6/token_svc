# Token Service

This constitutes of a Fastify REST API service that manages blockchain-read-transactions for token and a Cron service that processes blockchain-write-transactions from the Postgres DB using Prisma.

Note: 

Make sure to add a valid .env file (refer .env.example).

Make sure you are running the postgres DB and have node insalled on your system.

Get dependent node modules:
```shell
npm install
```

Run fastify service:
```shell
npm run dev
```
