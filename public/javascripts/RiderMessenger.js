var sys     = require('sys');
var pg      = require('pg');
var stages  = require('./stages');
var strings = require('./strings');
var db      = require('./db');
var parser  = require('./messageParser');

var DriverMessenger   = require('./DriverMessenger');
var RiderWaitingQueue = require('./RiderWaitingQueue');

/* Twilio Credentials */
var accountSid    = 'ACf55ee981f914dc797efa85947d9f60b8';
var authToken     = 'cc3c8f0a7949ce40356c029579934c0f';
var twilio        = require('twilio');
var twilioClient  = require('twilio')(accountSid, authToken);

var TWILIO_NUMBER = '+18443359847';

function handleRideRequest(res, message, from) {
  // TODO: Move all parsing work (like determining if a text is a ride request)
  //       to messageParser.js. This would read like if (messageParser.isRideRequest(message))
  if (message.toUpperCase() == strings.keywordRide) {
    sys.log('handleRideRequest: Ride request received');

    //db.addRiderNumToDb(from);
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

  var response = new twilio.TwimlResponse();
  response.sms(responseText);
  res.cookie('rideStage', stages.rideStages.AWAITING_LOCATION);
  sys.log("requestLocation: Just set the rideStage to " + stages.rideStages.AWAITING_LOCATION);
  res.send(response.toString(), {
    'Content-Type':'text/xml'
  }, 200);
}

function requestTrailerInfo(res, resend) {
  var response = new twilio.TwimlResponse();
  response.sms(strings.askTrailer);
  res.cookie('rideStage', stages.rideStages.AWAITING_TRAILER);
  sys.log("requestTrailerInfo: Just set the rideStage to " + stages.rideStages.AWAITING_TRAILER);
  res.send(response.toString(), {
    'Content-Type':'text/xml'
  }, 200);
}

function sendWaitText(res) {
  var response = new twilio.TwimlResponse();
  response.sms(strings.waitText);
  res.cookie('rideStage', stages.rideStages.CONTACTING_DRIVER);
  res.send(response.toString(), {
    'Content-Type':'text/xml'
  }, 200);
  sys.log("sendWaitText: text sent");
}

function defaultHelpResponse(res) {
  var responseText = strings.resendText + strings.helpText;
  var response = new twilio.TwimlResponse();
  response.sms(responseText);
  res.send(response.toString(), {
    'Content-Type':'text/xml'
  }, 200);
}

// TODO: If we're sending this after the 30 min timeout, need to somehow reset their rideStage back
//       to nothing or else they can't request a new ride.
function sendNoDriversText(rider, isTimeout) {
  if (isTimeout) {
    sys.log("sendNoDrivers: Called from a timeout!");
    if (isRiderWaiting(rider)) {
      removeRiderFromQueue(rider);
    } else {
      return;
    }
  }

  sys.log("sendNoDriversText: beginning of sendNoDriversText");
  twilioClient.sendSms({
    to: rider,
    from: TWILIO_NUMBER,
    body: isTimeout ? strings.noDriversAvailable : (strings.noDriversAvailable + strings.willNotifyIn30)
  }, function(error, message) {
    if (!error) {
      sys.log("sendNoDriversText: successfully sent noDriversText")
    } else {
      sys.log('sendNoDriversText: Failed to send noDriversText, ' + error.message);
    }
  });
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
      var queryString = "SELECT num FROM drivers WHERE working = 'true' AND on_ride = 'false' AND current_zone = " + location;
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
            var query = client.query("UPDATE drivers SET giving_ride_to = '" + from + "' WHERE num = '" + driver.num + "'", function(err, result) {});
          } else {
            noDriversFound(from, false);
          }
        } else {
          noDriversFound(from, false);
        }
      });
    } else {
      noDriversFound(from, false);
    }
  });
}

function noDriversFound(from, resend) {
  sendNoDriversText(from, false);
  addRiderToQueue(from);
  startTimeoutForRider(from);
}

function startTimeoutForRider(riderNum) {
  var delay = 1000 * 60 * 1; // 1000ms = 1sec * 60 = 1min * 30 = 30min
  sys.log("About to set timeout for rider waiting, delay is " + delay + "ms");
  setTimeout(sendNoDriversText, delay, riderNum, true);
}

function isRiderWaiting(number) {
  for (var i = 0; i < global.riderWaitingQueue.length; i++) {
    if (global.riderWaitingQueue[i] == number) {
      return true;
    }
  }
  return false;
}

function removeRiderFromQueue(number) {
  for (var i = 0; i < global.riderWaitingQueue.length; i++) {
    if (global.riderWaitingQueue[i] == number) {
      global.riderWaitingQueue.splice(i, 1);
      return;
    }
  }
}

function addRiderToQueue(number) {
  global.riderWaitingQueue.push(number);
}

function handleFeedbackResponse(res, message, from) {
  sys.log("handleFeedbackResponse: from = " + from);
  var responseText = parser.isYesMessage(message) ? strings.goodFeedback : strings.badFeedback;

  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      sys.log("handleFeedbackResponse: connected to DB");
      var query = client.query("SELECT * FROM drivers WHERE giving_ride_to = '" + from + "'", function(err, result) {
        if (!err && result.length == 1) {
          var driverNum = result.rows[0].num;
          var currentRating = result.rows[0].rating;
          var totalRides = result.rows[0].total_rides_completed;
          sys.log("handleFeedbackResponse: found the driver, num is " + driverNum);

          /*
          * New rating = (# of positive feedback / # of total feedback)
          * EXAMPLE
          * totalRides = 26, currentRating = 97%
          * Good Feedback -> (1/(26+1))*100 + (26/(26+1))*97 = .037*100 + .962*97 = 3.7 + 93.4 = 97.1%
          * Bad Feedback  -> (1/(26+1))*0   + (26/(26+1))*97 = .037*0   + .962*97 = 0   + 93.4 = 93.4%
          */
          var multiplier = parser.isYesMessage(message) ? 100 : 0;
          var newRating = (1/(totalRides+1))*multiplier + (totalRides/(totalRides+1))*currentRating;

          if (multiplier == 100) {
            sys.log("updateDriverRating: feedback: GOOD; oldRating = " + currentRating + "; oldTotalRides = " + totalRides + "; newRating = " + newRating + "; newTotalRides = " + (totalRides+1));
          } else {
            sys.log("updateDriverRating: feedback: BAD; oldRating = " + currentRating + "; oldTotalRides = " + totalRides + "; newRating = " + newRating + "; newTotalRides = " + (totalRides+1));
          }
          var queryString = "UPDATE drivers SET rating = " + newRating + ", total_rides_completed = " + (totalRides+1) + ", on_ride = false, giving_ride_to = NULL WHERE num = '" + driverNum + "'";

          var query = client.query(queryString, function(err, result) {
            if (!err) {
              sys.log("handleFeedbackResponse: updated rating, totalrides, on_ride, and giving_ride_to successfully");
              var response = new twilio.TwimlResponse();
              response.sms(responseText);
              res.cookie('rideStage', stages.rideStages.NOTHING);
              res.send(response.toString(), {
                'Content-Type':'text/xml'
              }, 200);
              sys.log("handleFeedbackResponse: Just sent response: " + responseText);
            } else {
              sys.log("handleFeedbackResponse: Failed to updated rating, totalrides, on_ride, and giving_ride_to");
            }
            client.end();
          });
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
  },
  requestFeedback: function(riderNum) {
    twilioClient.sendSms({
      to: riderNum,
      from: TWILIO_NUMBER,
      body: strings.feedbackQuestion
    }, function(error, message) {});
  }
};
