const restify = require('restify');

module.exports = (req, res, next) => {


  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Response-Time, X-PINGOTHER, X-CSRF-Token,Authorization');

  next();

};

/*
module.exports = (req, res) => {

  if (req.method.toLowerCase() === 'options') {

    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Methods', res.methods.join(', '));
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Response-Time, X-PINGOTHER, X-CSRF-Token,Authorization');
    //res.header('Access-Control-Expose-Headers', 'X-Api-Version, X-Request-Id, X-Response-Time');
    //res.header('Access-Control-Max-Age', '1000');

    return res.send(204);
  } else {
    return res.send(new restify.MethodNotAllowedError());
  }

};
*/
