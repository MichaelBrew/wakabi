var sys       = require('sys');
var pg        = require('pg');
var moment    = require('moment')

var stages    = require('./stages');
var strings   = require('./strings');
var db        = require('./db');
var parser    = require('./messageParser');
var Messenger = require('./TextMessenger');

var DriverMessenger   = require('./DriverMessenger');
var RiderWaitingQueue = require('./RiderWaitingQueue');

function handleRideRequest(res, message, from) {
  if (parser.isRideRequest(message)) {
    sys.log('RiderMessenger.handleRideRequest: Ride request received');

    db.createNewRide(from, moment().format('YYYY-MM-DD HH:mm:ssZ'), function(rideId) {
      if (rideId) {
        requestLocation(res, false, rideId)
      }
    })

    db.addRiderNumToDb(from);
  } else {
    sys.log('RiderMessenger.handleRideRequest: Invalid message received');
    defaultHelpResponse(res);
  }
}

function handleLocationResponse(req, res, message, from) {
  if (parser.verifyRiderLocation(message)) {
    sys.log('RiderMessenger.handleLocationResponse: Location received');
    db.addOriginToRide(message, req.cookies.rideId, function(rideId) {
      if (rideId) {
        requestTrailerInfo(res, false);
      }
    })
  } else {
    sys.log('RiderMessenger.handleLocationResponse: Invalid response for location');
    requestLocation(res, true);
  }
}

function handleTrailerResponse(req, res, message, from) {
  if (parser.isYesMessage(message) || parser.isNoMessage(message)) {
    sys.log('RiderMessenger.handleTrailerResponse: Trailer decision received');
    var needsTrailer = (parser.isYesMessage(message) ? true : false);

    db.addTrailerToRide(needsTrailer, req.cookies.rideId, function(rideId) {
      if (rideId) {
        searchForDriver(res, rideId)
      }
    })
  } else {
    sys.log('handleTrailerResponse: Invalid response for trailer decision');
    requestTrailerInfo(res, true);
  }
}

function requestLocation(res, resend, rideId) {
  cookies = {
    "rideStage": stages.rideStages.AWAITING_LOCATION,
    "rideId": rideId
  }
  Messenger.requestLocation(res, resend, cookies);
}

function requestTrailerInfo(res, resend) {
  cookies = {"rideStage": stages.rideStages.AWAITING_TRAILER}
  Messenger.textResponse(res, strings.askTrailer, cookies);
}

function handleFeedbackResponse(res, message, from) {
  db.updateDriverRatingWithRiderNum(res, from, message)
}

function sendWaitText(res) {
  cookies = {"rideStage": stages.rideStages.CONTACTING_DRIVER}
  Messenger.textResponse(res, strings.waitText, cookies);
}

function defaultHelpResponse(res) {
  Messenger.textResponse(res, strings.resendText + strings.helpText);
}

function searchForDriver(res, rideId) {
  var params = {
    rideId: rideId,
    riderRes: res,
    riderWaitingForResponse: true
  }

  db.sendRequestToAvailableDriver(params)
}

function noDriversFound(from, location, resend) {
  sendNoDriversText(from, false);
  RiderWaitingQueue.addRiderWithZoneToQueue(from, location);
  startTimeoutForRider(from);
}

function sendNoDriversText(rider, isTimeout) {
  msg = isTimeout ? strings.noDriversAvailable : (strings.noDriversAvailable + strings.willNotifyIn30);

  if (isTimeout && RiderWaitingQueue.isRiderWaiting(rider)) {
    RiderWaitingQueue.removeRiderFromQueue(rider);
  }

  Messenger.text(rider, msg);
}

function startTimeoutForRider(riderNum) {
  var delay = 1000 * 60 * 1; // 1000ms = 1sec * 60 = 1min * 30 = 30min
  setTimeout(sendNoDriversText, delay, riderNum, true);
}

module.exports = {
  handleText: function(req, res, message, from, rideStage) {
    switch (rideStage) {
      case stages.rideStages.NOTHING:
        handleRideRequest(res, message, from);
      break;

      case stages.rideStages.AWAITING_LOCATION:
        handleLocationResponse(req, res, message, from);
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
  noDriversFoundForRide: function(from, location, resend) {
    noDriversFound(from, location, resend)
  }
};
