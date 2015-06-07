var express = require('express');
var router = express.Router();
var pg = require('pg');
var sys = require('sys');

/* GET driver center page. */
router.get('/', function(req, res, next) {
  var params = {
    tab: 'Driver Center',
    drivers: null
  }
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var query = client.query("SELECT * FROM drivers", function(err, result) {
        if (!err) {
          params.drivers = result.rows

          for (var key in params.drivers) {
            if (params.drivers.hasOwnProperty(key)) {
              params.drivers[key] = params.drivers[key].replace(/[^\d\+]/g, ''); // STRIP out < >
            }
          }

          params.removeDriver = function(driverNum) {
            sys.log("wanna remove " + driverNum);
          }

          sys.log("rendering drivercenter with drivers ", params.drivers);
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
