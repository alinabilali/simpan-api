const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;

exports.connect = async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
};

exports.clear = async () => {
  const { collections } = mongoose.connection;
  for (const key in collections) await collections[key].deleteMany({});
};

exports.disconnect = async () => {
  await mongoose.disconnect();
  await mongo.stop();
};
