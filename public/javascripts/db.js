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
      var queryString = "SELECT * FROM rides WHERE ride_id = " + params.rideId
      var query = client.query(queryString, function(err, result) {
        if (!err) {
          // Rather than getting all drivers, can we do a query that returns a single driver
          // that matches this criteria and is the one with the earliest time last ride?
          var ride = result.rows[0]
          var queryString = "SELECT * FROM drivers WHERE working = 'true' AND " +
            "giving_ride_to IS NULL AND current_zone = " + ride.origin

          if (ride.trailer_needed) {
            queryString += " AND has_trailer = 'true'"
          }

          if (ride.driver_time_last_ride) {
            queryString += " AND time_last_ride > " + ride.driver_time_last_ride
          }

          queryString += " ORDER BY time_last_ride DESC LIMIT 1"

          var query = client.query(queryString, function(err, result) {
            if (!err) {
              if (result.rows.length == 0) {
                if (params.riderWaitingForResponse) {
                  RiderMessenger.noDriversFound(ride.rider_num, ride.origin, false)

                  // var queryString = "UPDATE TABLE rides SET rider_waiting_for_response = 'false' 
                  //   WHERE ride_id = '" + ride.ride_id + "'"
                  // var query = client.query(queryString, function(err, result) {
                  //   client.end()
                  // })
                }
                return
              }

              var driver = result.rows[0]

              // var drivers = _.sortBy(drivers, function(driver) {
              //   return driver.time_last_ride
              // })

              // DriverMessenger.textDriverForConfirmation(drivers[0].num, ride.rider_num)
              DriverMessenger.textDriverForConfirmation(driver.num, ride.rider_num)

              if (params.riderRes) {
                cookies = {"rideStage": stages.rideStages.CONTACTING_DRIVER}
                Messenger.textResponse(params.riderRes, strings.waitText, cookies)
              }
            }
            client.end()
          })
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
        client.end()
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

module.exports.createNewRide = function(riderNum, requestTime, cb) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var queryString = "INSERT INTO rides (rider_num, request_time) VALUES ('" + riderNum + 
        "', '" + requestTime + "') RETURNING ride_id";
      var query = client.query(queryString, function(err, result) {
        if (!err) {
          cb(result.rows[0].ride_id)
        } else {
          sys.log("db.createNewRide: error with query, ", err)
        }
        client.end()
      })
    }
  })
}

module.exports.addOriginToRide = function(origin, rideId, cb) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var queryString = "UPDATE rides SET origin = " + origin + " WHERE ride_id = '" 
        + rideId + "' RETURNING ride_id";
      var query = client.query(queryString, function(err, result) {
        if (!err) {
          cb(result.rows[0].ride_id)
        } else {
          sys.log("db.addOriginToRide: error with query, ", err)
        }
        client.end()
      })
    }
  })
}

module.exports.addTrailerToRide = function(needTrailer, rideId, cb) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var queryString = "UPDATE rides SET trailer_needed = '" + needTrailer + "'' WHERE ride_id = '" 
        + rideId + "' RETURNING ride_id";
      var query = client.query(queryString, function(err, result) {
        if (!err) {
          cb(result.rows[0].ride_id)
        } else {
          // Error
        }
        client.end()
      })
    }
  })
}

module.exports.getRideWithId = function(id) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var queryString = "SELECT * FROM drivers WHERE ride_id = '" + id + "'"
      var query = client.query(queryString, function(err, result) {
        if (!err) {
          return result.rows[0]
        }
        client.end()
      })
    }
  })
}
