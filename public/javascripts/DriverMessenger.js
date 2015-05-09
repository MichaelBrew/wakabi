var sys     = require('sys');
var pg      = require('pg');
var stages  = require('./stages');
var strings = require('./strings');
var parser  = require('./messageParser');
var db      = require('./db');
var Messenger = require('./TextMessenger');
var RiderWaitingQueue = require('./RiderWaitingQueue');

var RiderMessenger = require('./RiderMessenger');

function driverStartShift(res, from) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      sys.log("driverStartShift: connected to DB");
      var query = client.query("SELECT num FROM drivers WHERE num = '" + from + "' AND working = true", function(err, result) {
        var responseText = "";
        if (!err) {
          if (result.rows.length == 1) {
            responseText += "I can't do that, you are already working.";
            Messenger.textResponse(res, responseText);
          } else {
            requestLocation(res, false);
          }
        } else {
          responseText += "We're sorry, there was an error with the DB";
          sys.log("driverStartShift: Error querying the DB");
          Messenger.textResponse(res, responseText);
        }

        client.end();
      });
    }
  });
}

function driverEndShift(res, from) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var query = client.query("UPDATE drivers SET working = false WHERE num = '" + from + "'", function(err, result) {
        var responseText = "";
        if (!err) {
          responseText += "You have successfully ended shift!";
        } else {
          responseText += "We're sorry, there was an error with the DB";
        }

        cookies = {
          "driveStage": stages.driveStages.NOTHING
        }
        Messenger.textResponse(res, responseText, cookies);

        client.end();
        sys.log("driverEndShift.js: closed connection to DB");
        return;
      });
    }
  });
}

function requestLocation(res, resend) {
  cookies = {
    "driveStage": stages.driveStages.AWAITING_START_LOCATION
  }
  Messenger.requestLocation(res, resend, cookies);
}

function receiveStartShiftLocation(res, location, from) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var query = client.query("UPDATE drivers SET working = true, current_zone = " + parseInt(location) + " WHERE num = '" + from + "'", function(err, result) {
        var responseText = ""
        if (!err) {
          responseText += "You started your shift - good luck!";
        } else {
          responseText += "We're sorry, there was an error with the DB";
        }

        cookies = {
          "driveStage": stages.driveStages.AWAITING_END_RIDE
        }
        Messenger.textResponse(res, responseText, cookies);

        checkRiderWaitingQueue(from, location);

        client.end();
        sys.log("receiveStartShiftLocation.js: closed connection to DB");
        return;
      });
    }
  });
}

function checkRiderWaitingQueue(driverNum, location) {
  ridersWaiting = RiderWaitingQueue.getRidersWaitingInZone(location);

  if (ridersWaiting.length > 0) {
    textForConfirmation(driverNum, ridersWaiting[0]);
  }
}

function handleRequestResponse(res, message, from) {
  if (parser.isYesMessage(message)) {
    sendNumberToDriver(res, from);
  } else if (parser.isNoMessage(message)) {
    // pass the request on to the next driver
    // Here we have to clear the 'giving_ride_to' field of this driver
  } else {
    // wasn't a response to the request, send back default message?
  }
}

function sendNumberToDriver(res, driverNum) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      // Get rider's number
      var queryString = "SELECT giving_ride_to FROM drivers WHERE num = '" + driverNum + "'";
      var query = client.query(queryString, function(err, result) {
        if (!err) {
          var riderNum = result.rows[0].giving_ride_to;
          var responseText = "Here is the rider's number: " + riderNum;

          cookies = {
            "driveStage": stages.driveStages.AWAITING_END_RIDE
          }
          Messenger.textResponse(res, responseText, cookies);

          RiderWaitingQueue.removeRiderFromQueue(riderNum);
        }

        client.end();
        sys.log("sendNumberToDriver.js: closed connection to DB");
      });
    }
  });
}

function handleEndRideText(res, message, from) {
  if (parser.isEndRideMessage(message)) {
    pg.connect(process.env.DATABASE_URL, function(err, client) {
      if (!err) {
        // Get rider's number
        var queryString = "SELECT giving_ride_to FROM drivers WHERE num = '" + from + "'";
        var query = client.query(queryString, function(err, result) {
          if (!err) {
            // Text rider for feedback
            var riderNum = result.rows[0].giving_ride_to;
            Messenger.text(riderNum, strings.feedbackQuestion);

            var responseText = "Ok, ride marked as over."
            cookies = {
              "driveStage": stages.driveStages.NOTHING
            }
            Messenger.textResponse(res, responseText, cookies);

            client.end();
          }
        });
      }
    });
  }
}

function textForConfirmation(driverNumber, riderNumber) {
  pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
      var queryString = "UPDATE drivers SET giving_ride_to = '" + riderNumber + "' WHERE num = '" + driverNumber + "'";
      var query = client.query(queryString, function(err, result) {
        if (!err) {
          Messenger.text(driverNumber, strings.acceptRideQuestion);
        } else {
          sys.log("textForConfirmation: Error querying db, err: " + err);
        }
        client.end();
      });
    }

    sys.log("textDriver.js: closed connection to DB");
  });
}

module.exports = {
  handleText: function(res, message, from, driveStage) {
    switch (driveStage) {
      // TODO: what if driver randomly texts server? Can't assume it's in response
      //       to a ride request. Leave for "edge case" work spring quarter
      case stages.driveStages.NOTHING:
        sys.log("DriverMessenger.handleText: Driver stage is NOTHING");

        if (parser.isStartShift(message)) {
          driverStartShift(res, from);
        } else if (parser.isEndShift(message)) {
          driverEndShift(res, from);
        } else {
          handleRequestResponse(res, message, from);
        }
        break;

      case stages.driveStages.AWAITING_START_LOCATION:
        receiveStartShiftLocation(res, message, from);
        break;

      case stages.driveStages.AWAITING_START_RIDE:
        sys.log("DriverMessenger.handleText: Driver stage is AWAITING_START_RIDE");
        handleStartRideText(res, message);
        break;

      case stages.driveStages.AWAITING_END_RIDE:
        sys.log("DriverMessenger.handleText: Driver stage is AWAITING_END_RIDE");
        if (parser.isEndShift(message)) {
          driverEndShift(res, from);
        } else {
          handleEndRideText(res, message, from);
        }
        break;
    }
  },
  textDriverForConfirmation: function(driverNumber, riderNumber) {
    textForConfirmation(driverNumber, riderNumber);
  }
};
