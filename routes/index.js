var express = require('express');
var router = express.Router();
var pg = require('pg');
var sys = require('sys');

/* GET home page. */
router.get('/', function(req, res, next) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
        sys.log("index.js: Successfully connected to DB, about to query for drivers");
        var query = client.query("SELECT num FROM drivers", function(err, result) {
            if (!err) {
              sys.log("index.js: Successfully got the drivers, there were " + result.rows.length);
              sys.log("index.js: For example, result.rows[0] is " + result.rows[0]);
              sys.log("index.js: result.rows[0].num is " + result.rows[0].num);
              sys.log("index.js: result.rows[0](num) is " + result.rows[0](num));
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

  //res.render('index', { title: 'Wakabi' });
});

module.exports = router;
