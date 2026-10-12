jest.mock('../config/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue(true),
}));
