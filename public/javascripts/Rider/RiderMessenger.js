const pg = require('pg');
const moment = require('moment');

const stages = require('../stages');
const strings = require('../strings');
const db = require('../db');
const parser = require('../messageParser');
const Messenger = require('../TextMessenger');

const DriverMessenger = require('../Driver/DriverMessenger');
const RiderWaitingQueue = require('./RiderWaitingQueue');

function handleRideRequest(res, message, from) {
  if (parser.isRideRequest(message)) {
    console.log('RiderMessenger.handleRideRequest: Ride request received');

    db.createNewRide(from, moment().format('YYYY-MM-DD HH:mm:ssZ'), (rideId) => {
      if (rideId) {
        requestLocation(res, false, rideId)
      }
    })

    db.addRiderNumToDb(from);
  } else {
    console.log('RiderMessenger.handleRideRequest: Invalid message received');
    defaultHelpResponse(res);
  }
}

function handleLocationResponse(req, res, message, from) {
  if (parser.verifyRiderLocation(message)) {
    console.log('RiderMessenger.handleLocationResponse: Location received');

    db.addOriginToRide(message, req.cookies.rideId, (rideId) => {
      if (rideId) {
        requestTrailerInfo(res, false);
      }
    })
  } else {
    console.log('RiderMessenger.handleLocationResponse: Invalid response for location');
    requestLocation(res, true);
  }
}

function handleTrailerResponse(req, res, message, from) {
  if (parser.isYesMessage(message) || parser.isNoMessage(message)) {
    console.log('RiderMessenger.handleTrailerResponse: Trailer decision received');
    const needsTrailer = parser.isYesMessage(message);

    db.addTrailerToRide(needsTrailer, req.cookies.rideId, (rideId) => {
      if (rideId) {
        searchForDriver(res, rideId);
      }
    })
  } else {
    console.log('handleTrailerResponse: Invalid response for trailer decision');
    requestTrailerInfo(res, true);
  }
}

function requestLocation(res, resend, rideId) {
  Messenger.requestLocation(res, resend, {
    rideId,
    rideStage: stages.rideStages.AWAITING_LOCATION
  });
}

function requestTrailerInfo(res, resend) {
  Messenger.textResponse(res, strings.askTrailer, {
    rideStage: stages.rideStages.AWAITING_TRAILER
  });
}

function handleFeedbackResponse(res, message, from) {
  db.updateDriverRatingWithRiderNum(res, from, message)
}

function sendWaitText(res) {
  Messenger.textResponse(res, strings.waitText, {
    rideStage: stages.rideStages.CONTACTING_DRIVER
  });
}

function defaultHelpResponse(res) {
  Messenger.textResponse(res, `${strings.resendText}${strings.helpText}`);
}

function searchForDriver(riderRes, rideId) {
  db.sendRequestToAvailableDriver({
    rideId,
    riderRes,
    riderWaitingForResponse: true
  })
}

function noDriversFound(from, location, resend) {
  sendNoDriversText(from, false);
  RiderWaitingQueue.addRiderWithZoneToQueue(from, location);
  startTimeoutForRider(from);
}

function sendNoDriversText(rider, isTimeout) {
  const msg = isTimeout
    ? strings.noDriversAvailable
    : `${strings.noDriversAvailable}${strings.willNotifyIn30}`;

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
  handleText: (req, res, message, from, rideStage) => {
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
          console.log('handleRiderText: received text from waiting rider');
          sendWaitText(res);
        }
      break;
    }
  },

  noDriversFoundForRide: (from, location, resend) => {
    noDriversFound(from, location, resend);
  }
};
