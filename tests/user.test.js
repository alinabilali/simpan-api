const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const {
  connect,
  clear,
  disconnect,
  auth,
  signupAndLogin,
  signupAndLoginAsAdmin,
} = require('./helpers');

beforeAll(connect);
afterEach(clear);
afterAll(disconnect);

describe('GET /users', () => {
  test('a non-admin gets 403', async () => {
    const { token } = await signupAndLogin('regularuser');
    const res = await request(app).get('/users').set(auth(token));
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Forbidden');
  });

  test('an admin gets the full user list', async () => {
    const { token } = await signupAndLoginAsAdmin('adminuser');
    const res = await request(app).get('/users').set(auth(token));
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
