const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { connect, clear, disconnect, createVerifiedUser } = require('./helpers');
const jwt = require('jsonwebtoken');
const transporter = require('../config/mailer');

beforeEach(() => {
  jest.clearAllMocks();
  transporter.sendMail.mockResolvedValue(true);
});

beforeAll(connect);
afterEach(clear);
afterAll(disconnect);

const validUser = {
  username: 'ali',
  password: 'Passw0rd!',
  name: 'Ali',
  email: 'ali@example.com',
};

describe('POST /auth/signup', () => {
  test('creates a user and asks them to verify their email', async () => {
    const res = await request(app).post('/auth/signup').send(validUser);
    expect(res.statusCode).toBe(201);
    expect(res.body.accessToken).toBeUndefined();
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: validUser.email,
        subject: 'Verify Your Email Address',
      }),
    );
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

  test('an unverified user cannot log in, even by sending verified: true', async () => {
    await request(app).post('/auth/signup').send(validUser);
    const res = await request(app).post('/auth').send({
      username: validUser.username,
      password: validUser.password,
      verified: true,
    });
    expect(res.statusCode).toBe(403);
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

describe('POST /auth/forgot-password', () => {
  test('requires an email', async () => {
    const res = await request(app).post('/auth/forgot-password').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Email is required');
    expect(transporter.sendMail).not.toHaveBeenCalled();
  });

  test('rejects a non-string email', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: { $ne: null } });
    expect(res.statusCode).toBe(400);
    expect(transporter.sendMail).not.toHaveBeenCalled();
  });

  test('returns a generic response and sends nothing when email does not exist', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'wrongEmail@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe(
      'If that email exists, a reset link has been sent',
    );
    expect(transporter.sendMail).not.toHaveBeenCalled();
  });

  test('sends a reset email when email exists', async () => {
    await request(app).post('/auth/signup').send(validUser);
    transporter.sendMail.mockClear(); // signup sent a verification email too

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: validUser.email });

    expect(res.statusCode).toBe(200);
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: validUser.email,
        subject: 'Password Reset',
        text: expect.stringContaining('/reset-password/'),
      }),
    );
  });

  test('returns 500 when sending email fails', async () => {
    await request(app).post('/auth/signup').send(validUser);
    transporter.sendMail.mockClear();
    transporter.sendMail.mockRejectedValueOnce(
      new Error('Email service failed'),
    );

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: validUser.email });

    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Failed to send email');
  });
});

describe('POST /auth/reset-password', () => {
  let resetToken;

  beforeEach(async () => {
    await request(app).post('/auth/signup').send(validUser);
    await User.findOneAndUpdate(
      { username: validUser.username },
      { verified: true },
    );
    transporter.sendMail.mockClear();

    await request(app)
      .post('/auth/forgot-password')
      .send({ email: validUser.email });

    const { text } = transporter.sendMail.mock.calls[0][0];
    resetToken = text.match(/\/reset-password\/([A-Za-z0-9]+)/)[1];
  });

  test('requires an email', async () => {
    const res = await request(app).post('/auth/reset-password').send({
      token: resetToken,
      password: 'NewPassword123!',
      email: '',
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Email, token, and password are required');
  });

  test('rejects a weak password', async () => {
    const res = await request(app).post('/auth/reset-password').send({
      email: validUser.email,
      token: resetToken,
      password: 'weak',
    });

    expect(res.statusCode).toBe(400);
  });

  test('successfully resets the password with a valid token', async () => {
    const res = await request(app).post('/auth/reset-password').send({
      email: validUser.email,
      token: resetToken,
      password: 'NewPassword123!',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Password reset successfully');

    const loginOld = await request(app)
      .post('/auth')
      .send({ username: validUser.username, password: validUser.password });
    expect(loginOld.statusCode).toBe(401);

    const loginNew = await request(app)
      .post('/auth')
      .send({ username: validUser.username, password: 'NewPassword123!' });
    expect(loginNew.statusCode).toBe(200);
  });

  test('a reset token can only be used once', async () => {
    const body = {
      email: validUser.email,
      token: resetToken,
      password: 'NewPassword123!',
    };

    const first = await request(app).post('/auth/reset-password').send(body);
    const second = await request(app).post('/auth/reset-password').send(body);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(400);
  });

  test('rejects an invalid or expired token', async () => {
    const res = await request(app).post('/auth/reset-password').send({
      email: validUser.email,
      token: 'completely-fake-or-expired-token',
      password: 'NewPassword123!',
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Invalid or expired reset token');
  });
});

describe('GET /auth/verify-email', () => {
  const signupAndGetToken = async () => {
    await request(app).post('/auth/signup').send(validUser);
    const { text } = transporter.sendMail.mock.calls[0][0];
    return text.match(/token=([a-f0-9]+)/)[1];
  };

  test('verifies the user, and the token works only once', async () => {
    const token = await signupAndGetToken();

    const first = await request(app).get('/auth/verify-email').query({ token });
    expect(first.statusCode).toBe(200);
    const user = await User.findOne({ username: validUser.username });
    expect(user.verified).toBe(true);

    const second = await request(app)
      .get('/auth/verify-email')
      .query({ token });
    expect(second.statusCode).toBe(400);
  });

  test('rejects an expired token', async () => {
    const token = await signupAndGetToken();
    await User.updateOne(
      { username: validUser.username },
      { emailVerificationExpires: new Date(Date.now() - 1000) },
    );
    const res = await request(app).get('/auth/verify-email').query({ token });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /auth/refresh', () => {
  test('issues a new access token for a valid refresh cookie', async () => {
    await createVerifiedUser('ali');
    const login = await request(app)
      .post('/auth')
      .send({ username: 'ali', password: 'Passw0rd!' });
    const cookie = login.headers['set-cookie'][0].split(';')[0]; // "jwt=..."

    const res = await request(app).get('/auth/refresh').set('Cookie', cookie);
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  test('rejects a refresh token issued before a password reset', async () => {
    await createVerifiedUser('ali');
    await User.updateOne(
      { username: 'ali' },
      { passwordChangedAt: new Date() },
    );

    // Forge a token issued a minute ago, so the test doesn't depend on timing
    const old = jwt.sign(
      { username: 'ali', iat: Math.floor(Date.now() / 1000) - 60 },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' },
    );

    const res = await request(app)
      .get('/auth/refresh')
      .set('Cookie', `jwt=${old}`);
    expect(res.statusCode).toBe(403);
  });
});
