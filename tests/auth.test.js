const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const validUser = {
  username: 'ali',
  password: 'Passw0rd!',
  name: 'Ali',
  email: 'ali@example.com',
};

describe('POST /auth/signup', () => {
  test('creates a user and returns an access token', async () => {
    const res = await request(app).post('/auth/signup').send(validUser);
    console.log(res.statusCode, res.body);
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  test('rejects a weak password', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ ...validUser, password: 'weak' });
    expect(res.statusCode).toBe(400);
  });

  test('rejects a duplicate username', async () => {
    await request(app).post('/auth/signup').send(validUser);
    const res = await request(app).post('/auth/signup').send(validUser);
    expect(res.statusCode).toBe(409);
  });

  test('new user defaults to verified: false', async () => {
    await request(app).post('/auth/signup').send(validUser);
    const user = await User.findOne({ username: validUser.username });
    expect(user.verified).toBe(false);
  });
});

describe('POST /auth (login)', () => {
  beforeEach(async () => {
    await request(app).post('/auth/signup').send(validUser);
  });

  test('logs in with correct credentials and sets a refresh cookie', async () => {
    const res = await request(app)
      .post('/auth')
      .send({ username: validUser.username, password: validUser.password });
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/^jwt=/);
  });

  test('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/auth')
      .send({ username: validUser.username, password: 'Wrong123!' });
    expect(res.statusCode).toBe(401);
  });

  test('rejects missing fields with 400', async () => {
    const res = await request(app).post('/auth').send({ username: 'ali' });
    expect(res.statusCode).toBe(400);
  });
});

describe('refresh and logout', () => {
  test('refresh without a cookie returns 401', async () => {
    const res = await request(app).get('/auth/refresh');
    expect(res.statusCode).toBe(401);
  });

  test('logout without a cookie returns 204', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.statusCode).toBe(204);
  });
});
