const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Food = require('../models/Food');
const jwt = require('jsonwebtoken');
const {
  connect,
  clear,
  disconnect,
  auth,
  signupAndLogin,
} = require('./helpers');

beforeAll(connect);
afterEach(clear);
afterAll(disconnect);

const foodData = (userId, overrides = {}) => ({
  user: userId,
  name: 'Milk',
  dateExpiry: '2030-01-01',
  category: 'Dairy',
  place: 'Fridge',
  quantity: '2',
  ...overrides,
});

describe('GET /food', () => {
  test('returns 400 with a message when there is no food', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app).get('/food').set(auth(token));
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('No food found');
  });

  test('returns food with the owner username attached', async () => {
    const { token, userId } = await signupAndLogin();
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
    const { token, userId } = await signupAndLogin();

    const res = await request(app)
      .post('/food')
      .set(auth(token))
      .send(foodData(userId));

    expect(res.statusCode).toBe(201);
    expect(await Food.countDocuments()).toBe(1);
  });

  test('rejects a missing quantity (400)', async () => {
    const { token, userId } = await signupAndLogin();

    const res = await request(app)
      .post('/food')
      .set(auth(token))
      .send(foodData(userId, { quantity: undefined }));

    expect(res.statusCode).toBe(400);
  });

  test('rejects a missing name (400)', async () => {
    const { token, userId } = await signupAndLogin();

    const res = await request(app)
      .post('/food')
      .set(auth(token))
      .send(foodData(userId, { name: undefined }));

    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /food', () => {
  test('updates an existing food item', async () => {
    const { token, userId } = await signupAndLogin();
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
    const { token, userId } = await signupAndLogin();

    const res = await request(app)
      .patch('/food')
      .set(auth(token))
      .send({ ...foodData(userId), id: new mongoose.Types.ObjectId() });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Food not found');
  });

  test('returns 500 on an unexpected server error', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app).patch('/food').set(auth(token)).send({
      id: 'not-a-valid-object-id',
      user: 'also-not-valid',
      name: 'Milk',
      dateExpiry: '2030-01-01',
      category: 'Dairy',
      place: 'Fridge',
      quantity: '2',
    });
    expect(res.statusCode).toBe(500);
  });
});

describe('DELETE /food', () => {
  test('deletes an existing food item', async () => {
    const { token, userId } = await signupAndLogin();
    const food = await Food.create(foodData(userId));

    const res = await request(app)
      .delete('/food')
      .set(auth(token))
      .send({ id: food.id });

    expect(res.statusCode).toBe(200);
    expect(await Food.countDocuments()).toBe(0);
  });

  test('requires an id (400)', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app).delete('/food').set(auth(token)).send({});
    expect(res.statusCode).toBe(400);
  });

  test('reply includes the food name', async () => {
    const { token, userId } = await signupAndLogin();
    const food = await Food.create(foodData(userId, { name: 'Yogurt' }));

    const res = await request(app)
      .delete('/food')
      .set(auth(token))
      .send({ id: food.id });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Yogurt');
  });
});

describe('DELETE /food/deleteAllFood', () => {
  test('deletes only expired items', async () => {
    const { token, userId } = await signupAndLogin();
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

describe('GET /food/expiredFood', () => {
  test('returns only expired items with the owner username', async () => {
    const { token, userId } = await signupAndLogin();
    await Food.create(
      foodData(userId, { name: 'Old', dateExpiry: '2000-01-01' }),
    );
    await Food.create(
      foodData(userId, { name: 'Fresh', dateExpiry: '2030-01-01' }),
    );

    const res = await request(app).get('/food/expiredFood').set(auth(token));

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Old');
    expect(res.body[0].username).toBe('ali');
  });

  test('returns 400 when nothing is expired', async () => {
    const { token, userId } = await signupAndLogin();
    await Food.create(
      foodData(userId, { name: 'Fresh', dateExpiry: '2030-01-01' }),
    );

    const res = await request(app).get('/food/expiredFood').set(auth(token));
    expect(res.statusCode).toBe(400);
  });
});

describe('ownership', () => {
  test("a user cannot update someone else's food (403)", async () => {
    const userA = await signupAndLogin('ali');
    const userB = await signupAndLogin('sam');
    const food = await Food.create(foodData(userA.userId));

    const res = await request(app)
      .patch('/food')
      .set(auth(userB.token))
      .send({ ...foodData(userA.userId, { name: 'Hijacked' }), id: food.id });

    expect(res.statusCode).toBe(403);
  });

  test("a user cannot delete someone else's food (403)", async () => {
    const userA = await signupAndLogin('ali');
    const userB = await signupAndLogin('sam');
    const food = await Food.create(foodData(userA.userId));

    const res = await request(app)
      .delete('/food')
      .set(auth(userB.token))
      .send({ id: food.id });

    expect(res.statusCode).toBe(403);
  });

  test("GET /food only returns the logged-in user's items", async () => {
    const userA = await signupAndLogin('ali');
    const userB = await signupAndLogin('sam');
    await Food.create(foodData(userA.userId, { name: "Ali's milk" }));
    await Food.create(foodData(userB.userId, { name: "Sam's milk" }));

    const res = await request(app).get('/food').set(auth(userA.token));

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Ali's milk");
  });
});
