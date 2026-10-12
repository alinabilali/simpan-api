const PASSWORD_RULE = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}/;

module.exports = (password) => PASSWORD_RULE.test(password);
