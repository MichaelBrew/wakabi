var express = require('express');
var router = express.Router();
var pg = require('pg');
var sys = require('sys');
var moment = require('moment');

/* GET home page. */
router.get('/', function(req, res, next) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var query = client.query("SELECT * FROM drivers", function(err, result) {
        if (!err) {
          var numDrivers = result.rows.length;
          var numIdleDrivers = 0;
          var numBusyDrivers = 0;

          for driver in result.rows
            if driver.giving_ride_to == null
              numIdleDrivers++;
            else
              numBusyDrivers++;

          res.render('index', { 
            title: 'Wakabi', 
            numDrivers: numDrivers
            numIdleDrivers: numIdleDrivers
            numBusyDrivers: numBusyDrivers
            date: moment().format('MMMM DD, YYYY')
          })
        } else {
          sys.log("index.js: Error querying DB for drivers, " + err);
          res.render('index', { title: 'Wakabi', drivers: null })
        }
      });
    } else {
      sys.log("index.js: Error connecting to DB, " + err);
      res.render('index', { title: 'Wakabi', drivers: null })
    }
  });
});

module.exports = router;
