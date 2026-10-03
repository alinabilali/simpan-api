const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Food = require('../models/Food');
const jwt = require('jsonwebtoken');

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await Food.deleteMany({});
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

async function createUserAndToken(username = 'ali') {
  const res = await request(app)
    .post('/auth/signup')
    .send({
      username,
      password: 'Passw0rd!',
      name: 'Ali',
      email: `${username}@example.com`,
    });
  const user = await User.findOne({ username });
  return { token: res.body.accessToken, userId: user._id.toString() };
}

const foodData = (userId, overrides = {}) => ({
  user: userId,
  name: 'Milk',
  dateExpiry: '2030-01-01',
  category: 'Dairy',
  place: 'Fridge',
  quantity: '2',
  ...overrides,
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('auth guard on /food', () => {
  test('rejects a request without a token (401)', async () => {
    const res = await request(app).get('/food').set(auth('not-a-real-token'));
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /food', () => {
  test('returns 400 with a message when there is no food', async () => {
    const { token } = await createUserAndToken();
    const res = await request(app).get('/food').set(auth(token));
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('No food found');
  });

  test('returns food with the owner username attached', async () => {
    const { token, userId } = await createUserAndToken();
    await Food.create(foodData(userId));

    const res = await request(app).get('/food').set(auth(token));

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Milk');
    expect(res.body[0].username).toBe('ali');
  });
});

describe('POST /food', () => {
  test('creates a food item (201)', async () => {
    const { token, userId } = await createUserAndToken();

    const res = await request(app)
      .post('/food')
      .set(auth(token))
      .send(foodData(userId));

    expect(res.statusCode).toBe(201);
    expect(await Food.countDocuments()).toBe(1);
  });

  test('rejects a missing quantity (400)', async () => {
    const { token, userId } = await createUserAndToken();

    const res = await request(app)
      .post('/food')
      .set(auth(token))
      .send(foodData(userId, { quantity: undefined }));

    expect(res.statusCode).toBe(400);
  });

  test('rejects a missing name (400)', async () => {
    const { token, userId } = await createUserAndToken();

    const res = await request(app)
      .post('/food')
      .set(auth(token))
      .send(foodData(userId, { name: undefined }));

    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /food', () => {
  test('updates an existing food item', async () => {
    const { token, userId } = await createUserAndToken();
    const food = await Food.create(foodData(userId));

    const res = await request(app)
      .patch('/food')
      .set(auth(token))
      .send({ ...foodData(userId, { name: 'Oat milk' }), id: food.id });

    expect(res.statusCode).toBe(200);
    const updated = await Food.findById(food.id);
    expect(updated.name).toBe('Oat milk');
  });

  test('returns 400 for an unknown id', async () => {
    const { token, userId } = await createUserAndToken();

    const res = await request(app)
      .patch('/food')
      .set(auth(token))
      .send({ ...foodData(userId), id: new mongoose.Types.ObjectId() });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Food not found');
  });
});

describe('DELETE /food', () => {
  test('deletes an existing food item', async () => {
    const { token, userId } = await createUserAndToken();
    const food = await Food.create(foodData(userId));

    const res = await request(app)
      .delete('/food')
      .set(auth(token))
      .send({ id: food.id });

    expect(res.statusCode).toBe(200);
    expect(await Food.countDocuments()).toBe(0);
  });

  test('requires an id (400)', async () => {
    const { token } = await createUserAndToken();
    const res = await request(app).delete('/food').set(auth(token)).send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /food/deleteAllFood', () => {
  test('deletes only expired items', async () => {
    const { token, userId } = await createUserAndToken();
    await Food.create(
      foodData(userId, { name: 'Old', dateExpiry: '2000-01-01' }),
    );
    await Food.create(
      foodData(userId, { name: 'Fresh', dateExpiry: '2030-01-01' }),
    );

    const res = await request(app)
      .delete('/food/deleteAllFood')
      .set(auth(token));

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('1 expired');
    const left = await Food.find();
    expect(left).toHaveLength(1);
    expect(left[0].name).toBe('Fresh');
  });
});

describe('auth guard on /food', () => {
  test('rejects a request without a token (401)', async () => {
    const res = await request(app).get('/food');
    expect(res.statusCode).toBe(401);
  });

  test('rejects an invalid token (403)', async () => {
    const res = await request(app).get('/food').set(auth('not-a-real-token'));
    expect(res.statusCode).toBe(403);
  });

  test('rejects an expired token (403)', async () => {
    const expired = jwt.sign(
      { UserInfo: { id: '1', username: 'ali', name: 'Ali' } },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: -10 },
    );
    const res = await request(app).get('/food').set(auth(expired));
    expect(res.statusCode).toBe(403);
  });
});
