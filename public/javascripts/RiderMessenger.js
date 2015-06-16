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
  if (parser.isRideRequest(message)) {
    sys.log('handleRideRequest: Ride request received');
    requestLocation(res, false);
    db.addRiderNumToDb(from);
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

    var needsTrailer = (parser.isYesMessage(message) ? true : false);
    searchForDriver(res, from, location, needsTrailer);
  } else {
    sys.log('handleTrailerResponse: Invalid response for trailer decision');
    requestTrailerInfo(res, true);
  }
}

function requestLocation(res, resend) {
  cookies = {
    "rideStage": stages.rideStages.AWAITING_LOCATION
  }
  Messenger.requestLocation(res, resend, cookies);
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

function sendNoDriversText(rider, isTimeout) {
  msg = isTimeout ? strings.noDriversAvailable : (strings.noDriversAvailable + strings.willNotifyIn30);

  if (isTimeout) {
    sys.log("sendNoDrivers: Called from a timeout!");

    if (RiderWaitingQueue.isRiderWaiting(rider)) {
      RiderWaitingQueue.removeRiderFromQueue(rider);
    }
  }

  Messenger.text(rider, msg);
}

function verifyRiderLocation(msg) {
  msg = msg.replace(/\s+/g, '');
  for (var i = 1; i <= strings.availableLocations.length; i++) {
    if (parseInt(msg) == i) {
      return true;
    }
  }
  return false;
}

function searchForDriver(res, from, location, needTrailer) {
  db.getAvailableDriver(location, needTrailer, null, function(driver) {
    if (driver != null) {
      sys.log("RiderMessenger.searchForDriver: Found driver " + driver.num)
      DriverMessenger.textDriverForConfirmation(driver.num, from)

      cookies = {"rideStage": stages.rideStages.CONTACTING_DRIVER}
      Messenger.textResponse(res, strings.waitText, cookies)
    } else {
      noDriversFound(from, location, false)
    }
  })
}

// function searchForDriver(res, from, location, needTrailer) {
//   pg.connect(process.env.DATABASE_URL, function(err, client) {
//     if (!err) {
//       var queryString = "SELECT num FROM drivers WHERE working = 'true' AND giving_ride_to IS NULL AND current_zone = " + location;
//       if (needTrailer) {
//         queryString += " AND has_trailer = 'true'";
//       }

//       var query = client.query(queryString, function(err, result) {
//         if (!err) {
//           sys.log("searchForDriver: successfully queried db, found " + result.rows.length + " eligible drivers");
//           var driver = result.rows[0];
//           // TODO: instead of grabbing first one, look to time_last_ride and pick the one that's waited longest

//           if (driver != null && driver.num != null) {
//             sys.log("searchForDriver: About to text driver " + driver.num);
//             DriverMessenger.textDriverForConfirmation(driver.num, from);

//             cookies = {
//               "rideStage": stages.rideStages.CONTACTING_DRIVER
//             }
//             Messenger.textResponse(res, strings.waitText, cookies)
//           } else {
//             noDriversFound(from, location, false);
//           }
//         } else {
//           noDriversFound(from, location, false);
//         }

//         client.end();
//       });
//     } else {
//       noDriversFound(from, location, false);
//     }
//   });
// }

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
  db.updateDriverRatingWithRiderNum(res, from, message)
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
