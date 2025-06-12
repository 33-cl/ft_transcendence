var https = require('https');
var qs = require('querystring');
var noop = require("node-noop").noop;


//"private variables"
var blergCookies = null;
var blergUsername = null;

function Blerg() {
}

function handleresp(cb) {
  if(!cb) cb = noop; //If they don't want to handle errors, good on them
  return function(err, resp) {
    if(err) return cb(err);
    try {
      resp = JSON.parse(resp);
      if(resp.status === "failure") {
        return cb("Failure");
      } else if(resp.status === "success") {
        return cb(false);
      } else {
        return cb(false, resp);
      }
    } catch(ex) {
      console.log("Failed to parse", resp);
    }
    return cb("Failure");
  };
}

Blerg.prototype._get = function(url, cb) {
  var req = https.request({
    hostname: 'blerg.cc',
    port: 443,
    path: url,
    method: 'GET'
  }, function(res) {
    if(res.statusCode !== 200) {
      return cb("HTTP error code: " + res.statusCode);
    }
    if(res.headers["set-cookie"]) {
      blergCookies = res.headers["set-cookie"][0];
    }
    var resBody = '';
    res.on('data', function(chunk){resBody += chunk.toString();});
    res.on('end', function() {
      cb(false, resBody);
    });
  });
  if(blergCookies) req.setHeader('Cookie', blergCookies);
  req.end();
};

Blerg.prototype._post = function(url, body, cb) {
  var query = qs.stringify(body);
  var req = https.request({
    hostname: 'blerg.cc',
    port: 443,
    path: url,
    method: 'POST'
  }, function(res) {
    if(res.statusCode !== 200) {
      return cb("HTTP error code: " + res.statusCode);
    }
    if(res.headers["set-cookie"]) {
      blergCookies = res.headers["set-cookie"][0];
    }

    var resBody = '';
    res.on('data', function(chunk){resBody += chunk.toString();});
    res.on('end', function() {
      cb(false, resBody);
    });
  });

  req.setHeader('Content-Length', query.length);
  req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
  if(blergCookies) req.setHeader('Cookie', blergCookies);
  req.write(query);
  req.end();
};


Blerg.prototype.login = function(uname, pass, cb) {
  if(!cb) cb = noop;
  if(blergUsername !== null) {
    return cb("Client already logged in, don't login twice");
  }

  this._post('/login', {username: uname, password: pass},  function(err, resp) {
    if(err) return cb(err);
    try {
      resp = JSON.parse(resp);
      if(resp.status === "success") {
        blergUsername = uname;
        return cb(false);
      }
      return cb("Failure");
    } catch(ex) {
      return cb(ex);
    }
  });
};

Blerg.prototype.logout = function(cb) {
  if(!cb) cb = noop;

  this._post('/logout',{username: blergUsername},  function(err, resp) {
    if(err) return cb(err);
    try {
      resp = JSON.parse(resp);
      if(resp.status === "success") {
        blergUsername= null;
        this.cookie = null;
        return cb(false);
      }
      return cb("Failure");
    } catch(ex) {
      return cb(ex);
    }
  });
};

Blerg.prototype.put = function(data, cb) {
  this._post('/put', {username: blergUsername, data: data}, handleresp(cb));
};

Blerg.prototype.get = function(user, start, end, cb) {
  var tail = user;
  if(typeof start === "function") {
    cb = start;
  } else {
    tail += "/" + start + "-" + end;
  }

  this._get('/get/' + tail, handleresp(cb));
};

Blerg.prototype.info = function(user, cb) {
  this._get('/info/' + user, handleresp(cb));
};

Blerg.prototype.tag = function(tagname, cb) {
  this._get('/tag/' + tagname, handleresp(cb));
};

Blerg.prototype.subscribe = function(user, cb) {
  this._post('/subscribe/' + user,
             {username: blergUsername},
             handleresp(cb));
};

Blerg.prototype.unsubscribe = function(user, cb) {
  this._post('/unsubscribe/' + user,
             {username: blergUsername},
             handleresp(cb));
};

Blerg.prototype.feed = function(cb) {
  this._post('/feed',
             {username: blergUsername},
             handleresp(cb));
};

Blerg.prototype.feedinfo = function(user, cb) {
  this._post('/feedinfo' + (user ? '/'+user : ''),
             {username: blergUsername},
             handleresp(cb));
};

Blerg.prototype.passwd = function(password, new_password, cb) {
  this._post('/passwd',
             {username: blergUsername, password: password, new_password: new_password},
             handleresp(cb));
};

Blerg.prototype.create = function(username, password, cb) {
  this._post('/create',
             {username: username,password: password},
             handleresp(cb));
};

module.exports = new Blerg();
