const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

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

exports.auth = (token) => ({ Authorization: `Bearer ${token}` });

exports.signupAndLogin = async (username = 'ali') => {
  await request(app)
    .post('/auth/signup')
    .send({
      username,
      password: 'Passw0rd!',
      name: username,
      email: `${username}@example.com`,
    });

  const res = await request(app).post('/auth').send({
    username,
    password: 'Passw0rd!',
  });

  const user = await User.findOne({ username });
  return { token: res.body.accessToken, userId: user._id.toString() };
};

exports.signupAndLoginAsAdmin = async (username = 'admin1') => {
  await request(app)
    .post('/auth/signup')
    .send({
      username,
      password: 'Passw0rd!',
      name: username,
      email: `${username}@example.com`,
    });

  await User.findOneAndUpdate({ username }, { role: 'admin' });

  const res = await request(app).post('/auth').send({
    username,
    password: 'Passw0rd!',
  });

  const user = await User.findOne({ username });
  return { token: res.body.accessToken, userId: user._id.toString() };
};
