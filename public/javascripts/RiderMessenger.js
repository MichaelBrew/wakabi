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
  if (parser.verifyRiderLocation(message)) {
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
  cookies = {"rideStage": stages.rideStages.AWAITING_LOCATION}
  Messenger.requestLocation(res, resend, cookies);
}

function requestTrailerInfo(res, resend) {
  cookies = {"rideStage": stages.rideStages.AWAITING_TRAILER}
  Messenger.textResponse(res, strings.askTrailer, cookies);
}

function sendWaitText(res) {
  cookies = {"rideStage": stages.rideStages.CONTACTING_DRIVER}
  Messenger.textResponse(res, strings.waitText, cookies);
}

function defaultHelpResponse(res) {
  Messenger.textResponse(res, strings.resendText + strings.helpText);
}

function searchForDriver(res, from, location, needTrailer) {
  var params = {
    riderNum: from,
    location: location,
    needTrailer: needTrailer,
    driverTimeLastRide: null,
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
