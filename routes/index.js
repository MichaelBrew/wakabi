var express = require('express');
var router = express.Router();
var pg = require('pg');
var sys = require('sys');

/* GET home page. */
router.get('/', function(req, res, next) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
        var query = client.query("SELECT num FROM drivers", function(err, result) {
            if (!err) {
              res.render('index', { title: 'Wakabi', drivers: result.rows })
            } else {
              // Error
              sys.log("index.js: Error querying DB for drivers, " + err);
            }
        });
    } else {
        // Error
        sys.log("index.js: Error connecting to DB, " + err);
    }
  });
});

module.exports = router;
