var sys       = require('sys');
var pg        = require('pg');
var stages    = require('./stages');
var strings   = require('./strings');
var db        = require('./db');
var parser    = require('./messageParser');
var Messenger = require('./TextMessenger');

var DriverMessenger   = require('./DriverMessenger');
var RiderWaitingQueue = require('./RiderWaitingQueue');

function handleRideRequest(res, message, from) {
  if (message.toUpperCase() == strings.keywordRide) {
    sys.log('handleRideRequest: Ride request received');
    requestLocation(res, false);
  } else {
    sys.log('handleRideRequest: invalid messages received');
    defaultHelpResponse(res);
  }
}

function handleLocationResponse(res, message) {
  if (verifyRiderLocation(message)) {
    sys.log('handleLocationResponse: Location received');

    res.cookie('originLocation', message);
    requestTrailerInfo(res, false);
  } else {
    sys.log('handleLocationResponse: Invalid response for location');
    requestLocation(res, true);
  }
}

function handleTrailerResponse(req, res, message, from) {
  if (parser.isYesMessage(message) || parser.isNoMessage(message)) {
    sys.log('handleTrailerResponse: Trailer decision received');
    var location = req.cookies.originLocation;

    sendWaitText(res);

    var needsTrailer = (parser.isYesMessage(message) ? true : false);
    searchForDriver(from, location, needsTrailer);
  } else {
    sys.log('handleTrailerResponse: Invalid response for trailer decision');
    requestTrailerInfo(res, true);
  }
}

function requestLocation(res, resend) {
  var locationList = "";
  for (var i = 1; i <= strings.availableLocations.length; i++) {
    locationList += (i + ": " + strings.availableLocations[i-1]);

    if (i != strings.availableLocations.length) {
      locationList += "\n";
    }
  }

  var responseText = "";

  if (resend) {
    responseText += strings.resendText;
  }

  responseText += strings.askLocation + locationList;
  cookies = {
    "rideStage": stages.rideStages.AWAITING_LOCATION
  }
  Messenger.textResponse(res, responseText, cookies);
}

function requestTrailerInfo(res, resend) {
  cookies = {
    "rideStage": stages.rideStages.AWAITING_TRAILER
  }
  Messenger.textResponse(res, strings.askTrailer, cookies);
}

function sendWaitText(res) {
  cookies = {
    "rideStage": stages.rideStages.CONTACTING_DRIVER
  }
  Messenger.textResponse(res, strings.waitText, cookies);
}

function defaultHelpResponse(res) {
  Messenger.textResponse(res, strings.resendText + strings.helpText);
}

// TODO: If we're sending this after the 30 min timeout, need to somehow reset their rideStage back
//       to nothing or else they can't request a new ride.
function sendNoDriversText(rider, isTimeout) {
  if (isTimeout) {
    sys.log("sendNoDrivers: Called from a timeout!");
    if (RiderWaitingQueue.isRiderWaiting(rider)) {
      RiderWaitingQueue.removeRiderFromQueue(rider);
    } else {
      return;
    }
  }

  msg = isTimeout ? strings.noDriversAvailable : (strings.noDriversAvailable + strings.willNotifyIn30);
  Messenger.text(rider, msg);
}

function verifyRiderLocation(msg) {
  for (var i = 1; i <= strings.availableLocations.length; i++) {
    if (parseInt(msg) == i) {
      return true;
    }
  }

  return false;
}

function searchForDriver(from, location, needTrailer) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var queryString = "SELECT num FROM drivers WHERE working = 'true' AND giving_ride_to IS NULL AND current_zone = " + location;
      if (needTrailer) {
        queryString += " AND has_trailer = 'true'";
      }

      var query = client.query(queryString, function(err, result) {
        if (!err) {
          sys.log("searchForDriver: successfully queried db, found " + result.rows.length + " eligible drivers");
          var driver = result.rows[0];

          if (driver != null && driver.num != null) {
            sys.log("searchForDriver: About to text driver " + driver.num);
            DriverMessenger.textDriverForConfirmation(driver.num, from);
          } else {
            noDriversFound(from, location, false);
          }
        } else {
          noDriversFound(from, location, false);
        }

        client.end();
      });
    } else {
      noDriversFound(from, location, false);
    }
  });
}

function noDriversFound(from, location, resend) {
  sendNoDriversText(from, false);
  RiderWaitingQueue.addRiderWithZoneToQueue(from, location);
  startTimeoutForRider(from);
}

function startTimeoutForRider(riderNum) {
  var delay = 1000 * 60 * 1; // 1000ms = 1sec * 60 = 1min * 30 = 30min
  sys.log("About to set timeout for rider waiting, delay is " + delay + "ms");
  setTimeout(sendNoDriversText, delay, riderNum, true);
}

function handleFeedbackResponse(res, message, from) {
  sys.log("handleFeedbackResponse: from = " + from);
  var responseText = parser.isYesMessage(message) ? strings.goodFeedback : strings.badFeedback;

  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      sys.log("handleFeedbackResponse: connected to DB");
      var query = client.query("SELECT * FROM drivers WHERE giving_ride_to = '" + from + "'", function(err, result) {
        if (!err) {
          var driverNum = result.rows[0].num;
          var currentRating = (result.rows[0].rating == null) ? 100 : result.rows[0].rating;
          var totalRides = (result.rows[0].total_rides_completed == null) ? 0 : result.rows[0].total_rides_completed;
          sys.log("handleFeedbackResponse: found the driver, num is " + driverNum);

          //New rating = (# of positive feedback / # of total feedback)
          var multiplier = parser.isYesMessage(message) ? 100 : 0;
          var newRating = (1/(totalRides+1))*multiplier + (totalRides/(totalRides+1))*currentRating;

          if (multiplier == 100) {
            sys.log("updateDriverRating: feedback: GOOD; oldRating = " + currentRating + "; oldTotalRides = " + totalRides + "; newRating = " + newRating + "; newTotalRides = " + (totalRides+1));
          } else {
            sys.log("updateDriverRating: feedback: BAD; oldRating = " + currentRating + "; oldTotalRides = " + totalRides + "; newRating = " + newRating + "; newTotalRides = " + (totalRides+1));
          }
          var queryString = "UPDATE drivers SET rating = " + newRating + ", total_rides_completed = " + (totalRides+1) + ", giving_ride_to = NULL WHERE num = '" + driverNum + "'";

          var query = client.query(queryString, function(err, result) {
            if (!err) {
              sys.log("handleFeedbackResponse: updated rating, totalrides, on_ride, and giving_ride_to successfully");
              cookies = {
                "rideStage": stages.rideStages.NOTHING
              }
              Messenger.textResponse(res, responseText, cookies);
              sys.log("handleFeedbackResponse: Just sent response: " + responseText);
            } else {
              sys.log("handleFeedbackResponse: Failed to updated rating, totalrides, on_ride, and giving_ride_to");
            }
            client.end();
          });
        } else {
          sys.log("handleFeedbackResponse: Error with query to find driver, err = " + err);
        }
      });
    }
  });
}

module.exports = {
  handleText: function(req, res, message, from, rideStage) {
    switch (rideStage) {
      case stages.rideStages.NOTHING:
      handleRideRequest(res, message, from);
      break;

      case stages.rideStages.AWAITING_LOCATION:
      handleLocationResponse(res, message);
      break;

      case stages.rideStages.AWAITING_TRAILER:
      handleTrailerResponse(req, res, message, from);
      break;

      case stages.rideStages.CONTACTING_DRIVER:
      if (parser.isYesMessage(message) || parser.isNoMessage(message)) {
        handleFeedbackResponse(res, message, from);
      } else {
        sys.log('handleRiderText: received text from waiting rider');
        sendWaitText(res);
      }
      break;
    }
  }
};
