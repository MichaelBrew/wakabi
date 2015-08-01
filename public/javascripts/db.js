var pg = require('pg');
var sys = require('sys');
var _ = require('underscore')
var moment = require('moment')

var RiderMessenger = require('./Rider/RiderMessenger.js');
var DriverMessenger = require('./Driver/DriverMessenger.js')
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
          var ride = result.rows[0]
          var queryString = "SELECT * FROM drivers WHERE working = 'true' AND current_zone = " + ride.origin +
            " AND NOT EXISTS (SELECT 1 FROM rides WHERE end_time = NULL AND driver_num = drivers.num)"

          if (ride.trailer_needed) {
            queryString += " AND has_trailer = 'true'"
          }

          if (params.driverTimeLastRide) {
            queryString += " AND time_last_ride > '" + moment(params.driverTimeLastRide).format('YYYY-MM-DD HH:mm:ssZ') + "'"
          }

          queryString += " ORDER BY time_last_ride ASC LIMIT 1"

          sys.log("sendRequestToAvailableDriver: query to get drivers is ", queryString)

          var query = client.query(queryString, function(err, result) {
            if (!err) {
              sys.log("sendRequestToAvailableDriver: result = ", result)

              if (result.rows.length == 0) {
                if (params.riderWaitingForResponse) {
                  RiderMessenger.noDriversFoundForRide(ride.rider_num, ride.origin, false)
                }
                return
              }

              var driver = result.rows[0]

              DriverMessenger.textDriverForConfirmation(driver.num, ride.rider_num)

              if (params.riderRes) {
                cookies = {"rideStage": stages.rideStages.CONTACTING_DRIVER}
                Messenger.textResponse(params.riderRes, strings.waitText, cookies)
              }

              var addDriverQueryString = "UPDATE rides SET driver_num = '" + driver.num + "' WHERE ride_id = " + ride.ride_id
              var addDriverQuery = client.query(addDriverQueryString, function(err, result) {
                if (!err) {
                  // good
                } else {
                  sys.log("db.sendRequestToAvailableDriver: error adding driver num to ride entry, ", err)
                }
                client.end()
              })
            } else {
              sys.log("db.sendRequestToAvailableDriver: error with db, ", err)
            }
          })
        } else {
          sys.log("db.sendRequestToAvailableDriver: error getting rides, ", err)
        }
      })
    }
  })
}

module.exports.updateDriverRatingWithRiderNum = function(res, riderNum, message) {
  var responseText = parser.isYesMessage(message) ? strings.goodFeedback : strings.badFeedback;

  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var queryString = "SELECT * FROM rides WHERE rider_num = '" + riderNum + "' ORDER BY request_time DESC"
      var query = client.query(queryString, function(err, result) {
        if (!err) {
          var ride = result.rows[0]
          var driverNum = ride.driver_num
          var queryString = "SELECT * FROM drivers WHERE num = '" + driverNum + "'"
          var query = client.query(queryString, function(err, result) {
            if (!err) {
              var driver = result.rows[0]
              var driverNum = driver.num
              var currentRating = (driver.rating == null) ? 100 : driver.rating
              var totalRides = (driver.total_rides_completed == null) ? 0 : driver.total_rides_completed

              // New rating = (# of positive feedback / # of total feedback)
              var multiplier = parser.isYesMessage(message) ? 100 : 0
              var newRating = (1/(totalRides+1))*multiplier + (totalRides/(totalRides+1))*currentRating

              var queryString = "UPDATE drivers SET rating = " + newRating + ", total_rides_completed = "
                + (totalRides+1) + " WHERE num = '" + driverNum + "'"
              var query = client.query(queryString, function(err, result) {
                if (!err) {
                  sys.log("handleFeedbackResponse: updated rating, totalrides, and giving_ride_to successfully");
                  cookies = {
                    "rideStage": stages.rideStages.NOTHING
                  }
                  Messenger.textResponse(res, responseText, cookies);

                  var feedback = ""

                  if (multiplier == 100) {
                    feedback = "POSITIVE"
                  } else {
                    feedback = "NEGATIVE"
                  }

                  var queryString = "UPDATE rides SET feedback = '" + feedback + "' WHERE ride_id = " + ride.ride_id
                  var query = client.query(queryString, function(err, result) {
                    client.end()
                  })
                }
              })
            }
          })
        }
      })
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
      var queryString = "UPDATE rides SET trailer_needed = '" + needTrailer + "' WHERE ride_id = '"
        + rideId + "' RETURNING ride_id";
      sys.log("db.addTrailerToRide: about to update ride entry with ", queryString)
      var query = client.query(queryString, function(err, result) {
        if (!err) {
          sys.log("db.addTrailerToRide: success, ride id is ", result.rows[0].ride_id)
          cb(result.rows[0].ride_id)
        } else {
          sys.log("db.addTrailerToRide: error, ", err)
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
