import { MongoClient } from 'mongodb';

import env from './env.js';

let client;
let database;

export async function connectMongoDB() {
  if (database) {
    return database;
  }

  client = new MongoClient(env.mongodbUri);

  await client.connect();

  database = client.db(env.mongodbDatabase);

  await database.command({ ping: 1 });

  console.log(MongoDB connected: );

  return database;
}

export async function closeMongoDB() {
  if (!client) {
    return;
  }

  await client.close();

  client = null;
  database = null;

  console.log('MongoDB connection closed.');
}
