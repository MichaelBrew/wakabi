var express = require('express');
var pg      = require('pg');
var sys     = require('sys');
var moment  = require('moment')
var db      = require('../public/javascripts/db');
var stages  = require('../public/javascripts/stages');

var Messenger = require('../public/javascripts/TextMessenger');
var RiderMessenger  = require('../public/javascripts/Rider/RiderMessenger');
var DriverMessenger = require('../public/javascripts/Driver/DriverMessenger');

var router = express.Router();

/******************/
/* TEST FUNCTIONS */
/******************/
function isRideStageReset(res, msg) {
  msg = msg.replace(/\s+/g, '');
  if (msg.toLowerCase() == "reset") {
    sys.log("isRideStageReset: message was a reset");

    var message = "Ok, rideStage/driveStage has been reset to NOTHING";
    var cookies = {
      'rideStage': stages.rideStages.NOTHING,
      'driveStage': stages.driveStages.NOTHING
    }
    Messenger.textResponse(res, message, cookies);

    sys.log("isRideStageReset: returning true");
    return true;
  }
  return false;
}

function isQuickDriverSignUp(res, message, from) {
  message = message.replace(/\s+/g, '');
  if (message.toLowerCase() == "signupdriver") {
    pg.connect(process.env.DATABASE_URL, function(err, client) {
      if (!err) {
        var queryString = "INSERT INTO drivers (num, working, current_zone, has_trailer, rating, last_payment, total_rides_completed, time_last_ride) VALUES ('"
          + from + "', true, 1, true, 100, '" + moment().format('YYYY-MM-DD HH:mm:ssZ') + "', 0, '" + moment('1976-01-01').format('YYYY-MM-DD HH:mm:ssZ') + "')";

        var query = client.query(queryString, function(err, result) {
          var responseText = "";
          var cookies = {};
          if (!err) {
            sys.log("isQuickDriverSignUp: Driver added to DB successfully");
            responseText += "Ok, you are now registered as a driver!";
            cookies = {
              'driveStage': stages.driveStages.NOTHING
            }
          } else {
            sys.log("isQuickDriverSignUp: Error adding driver to DB, " + err);
            responseText += "Error adding driver, " + err;
          }

          Messenger.textResponse(res, responseText, cookies);
          client.end();
        });
      } else {
        // Error connecting to DB
        var errorString = "Error connecting to DB to add driver, " + err;
        Messenger.textResponse(res, errorString);
        sys.log("isQuickDriverSignUp: " + errorString);
      }
    });
    return true;
  }
  return false;
}

function isQuickRemoveDriver(res, message, from) {
  message = message.replace(/\s+/g, '');
  if (message.toLowerCase() == "removedriver") {
    pg.connect(process.env.DATABASE_URL, function(err, client) {
      if (!err) {
        var queryString = "DELETE FROM drivers WHERE num = '" + from + "'";
        var query = client.query(queryString, function(err, result) {
          var responseText = "";
          var cookies = {};
          if (!err) {
            sys.log("isQuickRemoveDriver: Driver removed from DB successfully");
            responseText += "Ok, you are no longer a driver!";
            cookies = {
              'rideStage': stages.rideStages.NOTHING
            }
          } else {
            sys.log("isQuickRemoveDriver: Error removing driver from DB, " + err);
            responseText += "Error removing driver, " + err;
          }

          Messenger.textResponse(res, responseText, cookies);
          client.end();
        });
      } else {
        var errorString = "Error connecting to DB to remove driver, " + err;
        sys.log("isQuickRemoveDriver: " + errorString);
        Messenger.textResponse(res, errorString);
      }
    });
    return true;
  }
  return false;
}


/*********************/
/* ROUTING FUNCTIONS */
/*********************/
function getStage(request, isDriver) {
  var defaultReturnVal;

  if (isDriver) {
    defaultReturnVal = stages.driveStages.NOTHING;
  } else {
    defaultReturnVal = stages.rideStages.NOTHING;
  }

  if (request.cookies != null) {
    if (isDriver) {
      if (request.cookies.driveStage != null) {
        return request.cookies.driveStage;
      }
    } else {
      if (request.cookies.rideStage != null) {
        return request.cookies.rideStage;
      }
    }
  }

  return defaultReturnVal;
}

var receiveIncomingMessage = function(req, res, next) {
  var message = req.body.Body;
  var from    = req.body.From;
  
  var fromCity = req.body.FromCity;
  var fromState = req.body.FromState;
  var fromZip = req.body.FromZip;
  var fromCountry = req.body.FromCountry;

  // These all come from the phone number itself
  // But not from the sender's actual location (unless they're in the same
  // place that their phone number is registered)
  // if (fromCity) sys.log("incoming: fromCity = " + fromCity);
  // if (fromState) sys.log("incoming: fromState = " + fromState);
  // if (fromZip) sys.log("incoming: fromZip = " + fromZip);
  // if (fromCountry) sys.log("incoming: fromCountry = " + fromCountry);

  sys.log('incoming: From: ' + from + ', Message: ' + message);

  // Testing shortcuts
  if (isRideStageReset(res, message)) {
    return;
  } else if (isQuickDriverSignUp(res, message, from)) {
    return;
  } else if (isQuickRemoveDriver(res, message, from)) {
    return;
  }

  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      // Check if sender is a driver
      var query = client.query("SELECT num FROM drivers WHERE num = '" + from + "'", function(err, result) {
        if (!err) {
          if (result.rows.length == 0) {
            sys.log("incoming: sender is a rider");
            RiderMessenger.handleText(req, res, message, from, getStage(req, false));
          } else {
            sys.log("incoming: sender is a driver");
            DriverMessenger.handleText(res, message, from, getStage(req, true));
          }
        } else {
          sys.log("incoming: Error querying DB to see if driver exists already, " + err);
          // Default to rider
          RiderMessenger.handleText(req, res, message, from, getStage(req, false));
        }

        client.end();
      });

    } else {
      sys.log("receiveIncomingMessage: Error connecting to DB, " + err);
      // Default to rider
      RiderMessenger.handleText(req, res, message, from, getStage(req, false));
    }
  });
}

/* Incoming SMS */
router.post('/', [receiveIncomingMessage]);

module.exports = router;
