/*
 * db.js
 *
 * This file is intended to hold asynchronous database queries.
 * If a query is part of a sequential execution where future steps
 * rely on the result of such query, it should not be included here.
 *
 * Examples:
 * - GOOD: When receiving a text from a rider, query db to see if the number needs
 *         to be added to the rider's table. Response to rider is handled separately
 *         and does not rely on this result.
 * - BAD:  When receiving a new text, query the db to see if that number is part of
 *         the driver's table to decide whether to handle the text as a driver or rider.
 *         The response handling DOES rely on this result.
 */

 var pg             = require('pg');
 var sys            = require('sys');
 var RiderMessenger = require('./RiderMessenger');

 module.exports = {
  addRiderNumToDb: function (from) {
    pg.connect(process.env.DATABASE_URL, function(err, client) {
      if (!err) {
        // Look for rider
        var query = client.query("SELECT num FROM riders WHERE num = '" + from + "'", function(err, result) {
          if (!err) {
            if (result.rows.length == 0) {
              // Rider is not in DB yet, add them
              var addRiderQuery = client.query("INSERT INTO riders (num, onride) VALUES ('" + from + "', false)", function(err, result) {
                if (!err) {
                  sys.log("addRiderNumToDb: Rider " + from + " successfully added to DB");
                }
              });
            }
          }
        });
      }
    });
  },
  addRiderNumToDriver: function (driverNum, riderNum) {
    pg.connect(process.env.DATABASE_URL, function(err, client) {
      if (!err) {
        // Assign the rider's number to the driver's 'giving_ride_to' column
        var query = client.query("UPDATE drivers SET giving_ride_to = '" + riderNum + "' WHERE num = '" + driverNum + "'", function(err, result) {
          if (!err) {
            sys.log("addRiderNumToDriver: Rider num " + riderNum + " successfully added to driver " + driverNum);
          }
        });
      });
  },
  updateDriverRatingWithRiderNum: function(riderNum, goodFeedback) {
    pg.connect(process.env.DATABASE_URL, function(err, client) {
      if (!err) {
        var query = client.query("SELECT num FROM drivers WHERE giving_ride_to = '" + riderNum + "'", function(err, result) {
          if (!err && result.length == 1) {
            var driverNum = result.rows[0].num;

            var queryString = "SELECT rating AND total_rides_completed FROM drivers WHERE num = '" + driverNum + "'";
            var query = client.query(queryString, function(err, result) {
              if (!err && result.length == 1) {
                var currentRating = result.rows[0].rating;
                var totalRides = result.rows[0].total_rides_completed;

                // example: totalRides = 26, currentRating = 97%
                // GOOD: (1/(26+1))*100 + (26/(26+1))*97 = .037*100 + .962*97 = 3.7 + 93.4 = 97.1
                // BAD:  (1/(26+1))*0   + (26/(26+1))*97 = .037*0   + .962*97 = 0   + 93.4 = 93.4
                var multiplier = goodFeedback ? 100 : 0;
                var newRating = (1/(totalRides+1))*multiplier + (totalRides/(totalRides+1))*currentRating;

                var queryString = "UPDATE drivers SET rating = " + newRating + ", total_rides_completed = " + (totalRides+1) + " WHERE num = '" + driverNum + "'";

                var query = client.query(queryString, function(err, result) {
                  if (!err) {
                    clearGivingRideTo(driverNum);
                  }
                });
              }
            });
          }
        });
      }
    });
  },
  clearGivingRideTo: function(driverNum) {
    pg.connect(process.env.DATABASE_URL, function(err, client) {
      if (!err) {
        var queryString = "UPDATE drivers SET on_ride = false, giving_ride_to = NULL WHERE num = '" + driverNum + "'";
        var query = client.query(queryString, function(err, result) {
          if (!err) {
              // cool
            }
            client.end();
          });
      }
    });
  }
};