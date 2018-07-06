const jwt = require('jsonwebtoken');
const { secretKey } = require('../../config')[process.env.NODE_ENV];
const tempUsers = require('./tempUsers');

module.exports = server => {

  server.get('/webrtc', (req, res, next) => {
    res.send({ message: 'Hello world!' });
    next();
  });

  server.post('/webrtc/api/auth', (req, res, next) => {

    if (
      !req.body
      || !req.body.username
    ) return next(new Error('InvalidRequest'));

    const { username/*, password*/} = req.body;

    let user = tempUsers[username];
    if (!user) {
      return res.send(404);
    }

    let token = jwt.sign({ data: user }, secretKey, {
      expiresIn: '1h'
    });

    res.send({ token, user });
    next();
  });

};
