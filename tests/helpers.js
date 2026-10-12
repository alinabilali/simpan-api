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

// Signs up and marks the user verified, without logging in
const createVerifiedUser = async (username, extra = {}) => {
  const res = await request(app)
    .post('/auth/signup')
    .send({
      username,
      password: 'Passw0rd!',
      name: username,
      email: `${username}@example.com`,
    });

  if (res.statusCode !== 201) {
    throw new Error(
      `signup failed for "${username}": ${res.statusCode} ${JSON.stringify(res.body)}`,
    );
  }

  await User.findOneAndUpdate({ username }, { verified: true, ...extra });
};

const login = async (username) => {
  const res = await request(app)
    .post('/auth')
    .send({ username, password: 'Passw0rd!' });

  if (!res.body.accessToken) {
    throw new Error(
      `login failed for "${username}": ${res.statusCode} ${JSON.stringify(res.body)}`,
    );
  }

  const user = await User.findOne({ username });
  return { token: res.body.accessToken, userId: user._id.toString() };
};

exports.createVerifiedUser = createVerifiedUser;

exports.signupAndLogin = async (username = 'ali') => {
  await createVerifiedUser(username);
  return login(username);
};

exports.signupAndLoginAsAdmin = async (username = 'admin1') => {
  await createVerifiedUser(username, { role: 'admin' });
  return login(username);
};
