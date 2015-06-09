var express = require('express');
var router = express.Router();
var pg = require('pg');
var sys = require('sys');
var moment = require('moment');

/* GET home page. */
router.get('/', function(req, res, next) {
  var params = {
    tab: 'Home',
    date: moment().format('MMMM D, YYYY'),
    numDrivers: 0,
    numIdleDrivers: 0,
    numBusyDrivers: 0,
    ridesRequested: 0,
    ridesCompleted: 0,
    ridesFailed: 0,
    positiveFeedback: 0,
    negativeFeedback: 0,
    netFeedback: 0,
    alerts: []
  }

  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var query = client.query("SELECT * FROM drivers WHERE working = true", function(err, result) {
        if (!err) {
          var driversArray = result.rows;
          var numDrivers = result.rows.length;
          var numIdleDrivers = 0;
          var numBusyDrivers = 0;

          var alerts = [];

          sys.log("after query, driversArray is ", driversArray)

          for (var index in driversArray) {
            var driver  = driversArray[index]
            sys.log("looping through all drivers, current driver is ", driver)
            if (driver.giving_ride_to == null) {
              numIdleDrivers++;
            } else {
              numBusyDrivers++;
            }

            sys.log("current driver rating is " + driver.rating)
            if (driver.rating < 80) {
              sys.log("driver rating is below 80, creating an alert")
              var message = "Driver " + driver.num + " rating below " + driver.rating + "%"
              sys.log("message to show is " + message)
              var path = "/drivercenter#" + driver.num
              sys.log("path to go to is " + path)
              alerts.push({
                message: message,
                path: path
              })
            }
          }

          params.numDrivers = numDrivers;
          params.numIdleDrivers = numIdleDrivers;
          params.numBusyDrivers = numBusyDrivers;
          params.alerts = alerts;

          var currentDay = moment().startOf('day').toDate()
          sys.log("Current day at midnight is " + currentDay)

          var query = client.query("SELECT * FROM rides WHERE request_time >= " + currentDay, function(err, result) {
            if (!err) {
              if (result.rows.length == 0) {
                sys.log("No rides have been requested today")

                ridesRequested = result.rows.length
                ridesCompleted = 0
                positiveFeedback = 0
                negativeFeedback = 0

                for (var ride in result.rows) {
                  if (ride.end_time != null) {
                    ridesCompleted++
                  }

                  if (ride.feedback != null) {
                    if (ride.feedback == "good") {
                      positiveFeedback++
                    } else {
                      negativeFeedback++
                    }
                  }
                }

                params.ridesRequested = ridesRequested
                params.ridesCompleted = ridesCompleted
                params.ridesFailed = ridesRequested - ridesCompleted
                params.positiveFeedback = positiveFeedback
                params.negativeFeedback = negativeFeedback
                params.netFeedback = positiveFeedback - negativeFeedback
              } else {
                sys.log("At least 1 ride has been requested today!")
              }
            } else {
              sys.log("index.js: Error connecting to DB, " + err)
            }

            res.render('index', params)
          });
        } else {
          sys.log("index.js: Error querying DB for drivers, " + err)
          res.render('index', params)
        }
      });
    } else {
      sys.log("index.js: Error connecting to DB, " + err)
      res.render('index', params)
    }
  });
});

module.exports = router;
