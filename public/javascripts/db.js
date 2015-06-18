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

var pg = require('pg');
var sys = require('sys');
var _ = require('underscore')

var RiderMessenger = require('./RiderMessenger.js');
var DriverMessenger = require('./DriverMessenger.js')
var parser = require('./messageParser.js');
var Messenger = require('./TextMessenger.js');
var strings = require('./strings.js');
var stages = require('./stages');

module.exports.addRiderNumToDb = function(from) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var query = client.query("SELECT num FROM riders WHERE num = '" + from + "'", function(err, result) {
        if (!err) {
          if (result.rows.length == 0) {
            // Rider is not in DB yet, add them
            var addRiderQuery = client.query("INSERT INTO riders (num, onride) VALUES ('" + from + "', false)", function(err, result) {
              if (!err) {
                sys.log("addRiderNumToDb: Rider " + from + " successfully added to DB");
              }
              client.end();
            });
          }
        }
      });
    }
  });
};

module.exports.sendRequestToAvailableDriver = function(params) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var queryString = "SELECT * FROM drivers WHERE working = 'true' AND 
        giving_ride_to IS NULL AND current_zone = " + params.location

      if (params.needTrailer) {
        queryString += " AND has_trailer = 'true'"
      }
      if (params.driverTimeLastRide) {
        queryString += " AND time_last_ride > " + params.driverTimeLastRide
      }

      var query = client.query(queryString, function(err, result) {
        if (!err) {
          var drivers = result.rows

          if (drivers.length == 0) {
            if (params.riderWaitingForResponse) {
              RiderMessenger.noDriversFound(params.riderNum, params.location, false) // From RiderMessenger
              // Think I need to set params.riderWaitingForResponse to false here, then save to DB
            }
            return
          }

          var drivers = _.sortBy(drivers, function(driver) {
            return driver.time_last_ride
          })

          DriverMessenger.textDriverForConfirmation(drivers[0].num, params)

          if (params.riderRes) {
            cookies = {"rideStage": stages.rideStages.CONTACTING_DRIVER}
            Messenger.textResponse(params.riderRes, strings.waitText, cookies)
          }
        }
      })
    }
  })
}

module.exports.addRiderNumToDriver = function(driverNum, riderNum) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var query = client.query("UPDATE drivers SET giving_ride_to = '" + riderNum + "' WHERE num = '" + driverNum + "'", function(err, result) {
        if (!err) {
          sys.log("addRiderNumToDriver: Rider num " + riderNum + " successfully added to driver " + driverNum);
        }
        client.end();
      });
    }
  });
}

module.exports.updateDriverRatingWithRiderNum = function(res, riderNum, message) {
  var responseText = parser.isYesMessage(message) ? strings.goodFeedback : strings.badFeedback;

  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var query = client.query("SELECT * FROM drivers WHERE giving_ride_to = '" + riderNum + "'", function(err, result) {
        if (!err) {
          var driverNum = result.rows[0].num;
          var currentRating = (result.rows[0].rating == null) ? 100 : result.rows[0].rating;
          var totalRides = (result.rows[0].total_rides_completed == null) ? 0 : result.rows[0].total_rides_completed;

          //New rating = (# of positive feedback / # of total feedback)
          var multiplier = parser.isYesMessage(message) ? 100 : 0;
          var newRating = (1/(totalRides+1))*multiplier + (totalRides/(totalRides+1))*currentRating;
          var queryString = "UPDATE drivers SET rating = " + newRating + ", total_rides_completed = " + (totalRides+1) + ", giving_ride_to = NULL WHERE num = '" + driverNum + "'";

          var query = client.query(queryString, function(err, result) {
            if (!err) {
              sys.log("handleFeedbackResponse: updated rating, totalrides, and giving_ride_to successfully");
              cookies = {
                "rideStage": stages.rideStages.NOTHING
              }
              Messenger.textResponse(res, responseText, cookies);
            }
            client.end();
          });
        }
      });
    }
  });
}

module.exports.getDriverFromNum = function(number, cb) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var query = client.query("SELECT * FROM drivers WHERE num = '" + number + "'", function(err, result) {
        if (!err) {
          if (result.rows.length == 1) {
            cb(result.rows[0])
          }
        }
      })
    }
  })
}

module.exports.clearGivingRideTo = function(driverNum) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var queryString = "UPDATE drivers SET giving_ride_to = NULL WHERE num = '" + driverNum + "'";
      var query = client.query(queryString, function(err, result) {
        if (!err) {
          // cool
        }
        client.end();
      });
    }
  });
}
