var express      = require('express');
var pg           = require('pg');
var sys          = require('sys');
var twilio       = require('twilio');
var db           = require('../public/javascripts/db');
var stages       = require('../public/javascripts/stages');

var RiderMesseneger = require('../public/javascripts/RiderMessenger');
var DriverMessenger = require('../public/javascripts/DriverMessenger');

var router       = express.Router();


/******************/
/* TEST FUNCTIONS */
/******************/
function isRideStageReset(res, msg) {
    if (msg.toLowerCase() == "reset") {
        sys.log("isRideStageReset: message was a reset");
        var response = new twilio.TwimlResponse();
        var responseText = "Ok, rideStage has been reset to NOTHING";
        response.sms(responseText);
        res.cookie('rideStage', stages.rideStages.NOTHING);
        sys.log("isRideStageReset: Just set the rideStage to " + stages.rideStages.NOTHING);
        res.send(response.toString(), {
            'Content-Type':'text/xml'
        }, 200);

        sys.log("isRideStageReset: returning true");
        return true;
    }

    return false;
}

function isQuickDriverSignUp(res, message, from) {
    if (message.toLowerCase() == "signupdriver") {
        pg.connect(process.env.DATABASE_URL, function(err, client) {
            if (!err) {
                sys.log("isQuickDriverSignUp: connected to DB");
                // Create query to add driver
                // TODO: Should probably get current date and use that, but not high priority
                //       since this is just for internal testing anyway
                var queryString = "INSERT INTO drivers (num, working, on_ride, current_zone, has_trailer, rating, last_payment) VALUES ('"
                        + from + "', true, false, 1, true, 100, '2015-02-26')";

                var query = client.query(queryString, function(err, result) {
                    var responseText = "";
                    if (!err) {
                        sys.log("isQuickDriverSignUp: Driver added to DB successfully");
                        responseText += "Ok, you are now registered as a driver!";
                        res.cookie('driveStage', stages.driveStages.NOTHING);
                    } else {
                        sys.log("isQuickDriverSignUp: Error adding driver to DB, " + err);
                        responseText += "Error adding driver, " + err;
                    }

                    // Send response text to sender
                    var response = new twilio.TwimlResponse();
                    response.sms(responseText);
                    res.send(response.toString(), {
                        'Content-Type':'text/xml'
                    }, 200);
                });
            } else {
                // Error connecting to DB
                var errorString = "Error connecting to DB to add driver, " + err;
                sys.log("isQuickDriverSignUp: " + errorString);
                var response = new twilio.TwimlResponse();
                response.sms(errorString);
                res.send(response.toString(), {
                    'Content-Type':'text/xml'
                }, 200);
            }
        });

        return true;
    }

    return false;
}

function isQuickRemoveDriver(res, message, from) {
    if (message.toLowerCase() == "removedriver") {
        pg.connect(process.env.DATABASE_URL, function(err, client) {
            if (!err) {
                var queryString = "DELETE FROM drivers WHERE num = '" + from + "'";
                var query = client.query(queryString, function(err, result) {
                    var responseText = "";
                    if (!err) {
                        sys.log("isQuickRemoveDriver: Driver removed from DB successfully");
                        responseText += "Ok, you are no longer a driver!";
                        res.cookie('rideStage', stages.rideStages.NOTHING);
                    } else {
                        sys.log("isQuickRemoveDriver: Error removing driver from DB, " + err);
                        responseText += "Error removing driver, " + err;
                    }

                    // Send response to sender
                    var response = new twilio.TwimlResponse();
                    response.sms(responseText);
                    res.send(response.toString(), {
                        'Content-Type':'text/xml'
                    }, 200);
                });
            } else {
                var errorString = "Error connecting to DB to remove driver, " + err;
                sys.log("isQuickRemoveDriver: " + errorString);
                var response = new twilio.TwimlResponse();
                response.sms(errorString);
                res.send(response.toString(), {
                    'Content-Type':'text/xml'
                }, 200);
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

    sys.log("getStage: cookies are null, or cookies.stage was null, returning '" + defaultReturnVal + "'");
    return defaultReturnVal;
}

var receiveIncomingMessage = function(req, res, next) {
    var message   = req.body.Body;
    var from      = req.body.From;

    // Testing shortcuts
    if (isRideStageReset(res, message)) {
        return;
    } else if (isQuickDriverSignUp(res, message, from)) {
        return;
    } else if (isQuickRemoveDriver(res, message, from)) {
        return;
    }

    sys.log('From: ' + from + ', Message: ' + message);

    pg.connect(process.env.DATABASE_URL, function(err, client) {
        if (!err) {
            // Check if sender is a driver
            var query = client.query("SELECT num FROM drivers WHERE num = '" + from + "'", function(err, result) {
                if (!err) {
                    if (result.rows.length == 0) {
                        sys.log("receiveIncomingMessage: sender is a rider");
                        RiderMessenger.handleText(req, res, message, from, getStage(req, false));
                    } else {
                        sys.log("receiveIncomingMessage: sender is a driver");
                        DriverMessenger.handleText(res, message, from, getStage(req, true));
                    }
                } else {
                    sys.log("receiveIncomingMessage: Error querying DB to see if driver exists already, " + err);
                    // Default to rider
                    RiderMessenger.handleText(req, res, message, from, getStage(req, false));
                }
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
