var express = require('express');
var router = express.Router();
var pg = require('pg');
var sys = require('sys');

/* GET driver center page. */
router.get('/', function(req, res, next) {
  var params = {
    tab: 'Driver Center',
    drivers: null,
    currentDriver: null
  }
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var query = client.query("SELECT * FROM drivers", function(err, result) {
        if (!err) {
          params.drivers = result.rows
          params.currentDriver = (req.query.driver != null) ? req.query.driver : null

          res.render('drivercenter', params)
        } else {
          // Error
          sys.log("index.js: Error querying DB for drivers, " + err);
          res.render('drivercenter', params)
        }
      });
    } else {
      // Error
      sys.log("index.js: Error connecting to DB, " + err);
      res.render('drivercenter', params)
    }
  });
});

module.exports = router;
