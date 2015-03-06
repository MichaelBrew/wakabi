var cookieParser = require('cookie-parser');
var express      = require('express');
var pg           = require('pg');
var sys          = require('sys');
var strings      = require('../public/javascripts/strings');

var router       = express.Router();

/* Twilio Credentials */
var accountSid   = 'ACf55ee981f914dc797efa85947d9f60b8';
var authToken    = 'cc3c8f0a7949ce40356c029579934c0f';
var twilio       = require('twilio');
var twilioClient = require('twilio')(accountSid, authToken);

/*
 * The 'rideStages' var acts as an enum to represent where the current
 * rider is in the request process.
 * TODO: can we eliminate DRIVER here now there's a driveStages?
 *
 * DRIVER            : All drivers' rideStage is marked DRIVER (default for drivers)
 * NOTHING           : Before the request, all riders have sent nothing (default for riders)
 * AWAITING_LOCATION : The server has asked for their location, waiting for answer
 * AWAITING_TRAILER  : The server has asked if they need a trailer, waiting for answer
 * CONTACTING_DRIVER : The server has told them a driver will contact them
 */
var rideStages = {
    DRIVER             : "driver",
    NOTHING            : "nothing",
    AWAITING_LOCATION  : "awaitingLocation",
    AWAITING_TRAILER   : "awaitingTrailer",
    CONTACTING_DRIVER  : "contactingDriver",
    AWAITING_DRIVER    : "awaitingDrivier"
}

/*
 * The 'driveStages' var acts as an enum to represent where the current
 * driver is in the ride process.
 *
 * NOTHING           : Driver has not yet started the ride process
 * SENT_RIDER_NUMBER : If the ride request is accepted, the rider's number has been sent
 * RIDE_STARTED      : The driver has indicated the start of the ride
 * RIDE_ENDED        : The driver has indicated the end of the ride
 */
var driveStages = {
    NOTHING             : "nothing",
    AWAITING_START_RIDE : "awaitingStartRide",
    AWAITING_END_RIDE   : "awaitingEndRide"
}

var TWILIO_NUMBER = '+18443359847';


/********************/
/* HELPER FUNCTIONS */
/********************/
function isSenderDriver(senderNumber) {
    pg.connect(process.env.DATABASE_URL, function(err, client) {
        if (!err) {
            // Look for driver
            var query = client.query("SELECT num FROM drivers WHERE num = '" + senderNumber + "'", function(err, result) {
                if (!err) {
                    if (result.rows.length == 0) {
                        // Number is not in DB -> not driver
                        return false;
                    } else {
                        // Number is in DB -> driver
                        sys.log("isSenderDriver: true");
                        return true;
                    }
                } else {
                    sys.log("isSenderDriver: Error querying DB to see if driver exists already, " + err);
                }
            });
        } else {
            sys.log("isSenderDriver: Error connecting to DB, " + err);
        }
    });
}

function getRideStage(request, isDriver) {
    var defaultReturnVal;
    if (isDriver) {
        defaultReturnVal = rideStages.DRIVER;
    } else {
        defaultReturnVal =  rideStages.NOTHING;
    }

    if (request.cookies != null) {
        if (request.cookies.rideStage != null) {
            return request.cookies.rideStage;
        } else {
            return defaultReturnVal;
        }
    } else {
        sys.log("getRideStage: cookies are null, returning " + defaultReturnVal);
        return defaultReturnVal;
    }
}

function addRiderNumToDb(from) {
    pg.connect(process.env.DATABASE_URL, function(err, client) {
        if (!err) {
            // Look for rider
            var query = client.query("SELECT num FROM riders WHERE num = '" + from + "'", function(err, result) {
                if (!err) {
                    if (result.rows.length == 0) {
                        // Rider is not in DB yet, add them
                        var addRiderQuery = client.query("INSERT INTO riders (num, onride) VALUES ('" + from + "', false)", function(err, result) {
                            if (!err) {
                                sys.log("addRiderNumToDb: Rider " + from + " successfully added to DB");
                            } else {
                                sys.log("addRiderNumToDb: Rider " + from + " unsuccessfully added to DB, " + err);
                            }
                        });
                    } else {
                        // Rider already exists in DB
                        sys.log("addRiderNumToDb: Rider already exists in DB");
                    }
                } else {
                    sys.log("addRiderNumToDb: Error querying DB to see if rider exists already, " + err);
                }
            });
        } else {
            sys.log("addRiderNumToDb: Error connecting to DB, " + err);
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

function isRideStageReset(res, msg) {
    if (msg.toLowerCase() == "reset") {
        sys.log("isRideStageReset: message was a reset");
        var response = new twilio.TwimlResponse();
        var responseText = "Ok, rideStage has been reset to NOTHING";
        response.sms(responseText);
        res.cookie('rideStage', rideStages.NOTHING);
        sys.log("isRideStageReset: Just set the rideStage to " + rideStages.NOTHING);
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
                var queryString = "INSERT INTO drivers (num, working, on_ride, current_zone, has_trailer, rating, last_payment) VALUES ('"
                        + from + "', true, false, 1, true, 100, '2015-02-26')";

                var query = client.query(queryString, function(err, result) {
                    var responseText = "";

                    if (!err) {
                        sys.log("isQuickDriverSignUp: Driver added to DB successfully");
                        responseText += "Ok, you are now registered as a driver!";
                        res.cookie('rideStage', rideStages.DRIVER);
                    } else {
                        sys.log("isQuickDriverSignUp: Error adding driver to DB, " + err);
                        responseText += "Error adding driver, " + err;
                    }

                    var response = new twilio.TwimlResponse();
                    response.sms(responseText);
                    res.send(response.toString(), {
                        'Content-Type':'text/xml'
                    }, 200);
                });
            } else {
                sys.log("isQuickDriverSignUp: Error connecting to DB, " + err);
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
                // Create query to add driver
                var queryString = "DELETE FROM drivers WHERE num = '" + from + "'";

                var query = client.query(queryString, function(err, result) {
                    var responseText = "";

                    if (!err) {
                        sys.log("isQuickRemoveDriver: Driver removed from DB successfully");
                        responseText += "Ok, you are no longer a driver!";
                        res.cookie('rideStage', rideStages.NOTHING);
                    } else {
                        sys.log("isQuickRemoveDriver: Error removing driver from DB, " + err);
                        responseText += "Error removing driver, " + err;
                    }

                    var response = new twilio.TwimlResponse();
                    response.sms(responseText);
                    res.send(response.toString(), {
                        'Content-Type':'text/xml'
                    }, 200);
                });
            } else {
                sys.log("isQuickRemoveDriver: Error connecting to DB, " + err);
            }
        });

        return true;
    }

    return false;
}

function searchForDriver(from, location, needTrailer) {
    pg.connect(process.env.DATABASE_URL, function(err, client) {
        if (!err) {
            // Look for driver
            var queryString = "SELECT num FROM drivers WHERE working = 'true' AND on_ride = 'false' AND current_zone = " + location;
            if (needTrailer) {
                queryString += " AND has_trailer = 'true'";
            }

            var query = client.query(queryString, function(err, result) {
                if (!err) {
                    if (result.rows.length == 0) {
                        // No drivers available
                        sys.log("searchForDriver: No drivers available");
                        sendNoDriversText(from);
                    } else {
                        // For now, just grab first driver
                        var driver = result.rows[0];

                        var driverNumber;
                        if (driver.num != null) {
                            sys.log("searchForDriver: Found driver " + driver.num);
                            driverNumber = driver.num;
                        } else {
                            sys.log("searchForDriver: driver.num is NULL");
                        }

                        textDriverForConfirmation(driverNumber)
                    }
                } else {
                    sys.log("searchForDriver: Error querying DB to find drivers, " + err);
                }
            });
        } else {
            sys.log("searchForDriver: Error connecting to DB, " + err);
        }
    });
}

/**********************/
/* REPLYING FUNCTIONS */
/**********************/
function handleRideRequest(res, message) {
    if (message.toUpperCase() == strings.keywordRide) {
        sys.log('handleRideRequest: Ride request received');

        addRiderNumToDb(from);
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

function handleTrailerResponse(res, message) {
    if (isYesMessage(message) || isNoMessage(message)) {
        sys.log('handleTrailerResponse: Trailer decision received');

        res.cookie('rideStage', rideStages.CONTACTING_DRIVER);
        res.cookie('Content-Type', 'text/xlm');
        sendWaitText(res);

        var location = req.cookies.originLocation;
        var needsTrailer = if isYesMessage(message) ? true : false;
        searchForDriver(from, location, needTrailers);
    } else {
        sys.log('handleTrailerResponse: Invalid response for trailer decision');
        requestTrailerInfo(res, true);
    }
}

function handleRiderText(req, res, message, from, riderStage) {
    switch (riderStage) {
        case rideStages.NOTHING:
            handleRideRequest(res, message);
            break;

        case rideStages.AWAITING_LOCATION:
            handleLocationResponse(res, message);
            break;

        case rideStages.AWAITING_TRAILER:
            handleTrailerResponse(res, message);
            break;

        case rideStages.CONTACTING_DRIVER:
            sys.log('handleRiderText: received text from waiting rider');
            sendWaitText(res);
            break;
    }
}

function handleDriverText(res, message, from, driverStage) {
    switch (driverStage) {
        case driveStages.NOTHING:
            // Expecting: Driver's decision to accept ride request
            // TODO: what if driver randomly texts server? Can't assume it's in response
            //       to a ride request
            if (isYesMessage(message)) {
                // uh, where is the rider's number at this point?
                // may need to store rider's number in DB as an extra column for driver
                // entry, like 'riderNum'
                sendNumberToDriver(res);
            } else if (isNoMessage(message)) {
                // pass the request on to the next driver
            } else {
                // wasn't a response to the request, send back default message?
            }
            break;

        case driverStages.AWAITING_START_RIDE:
            // Expecting: Start ride text
            handleStartRideText(res, message);
            break;

        case driverStages.AWAITING_END_RIDE:
            // Expecting: End ride text
            handleEndRideText(res, message);
    }
}

function isYesMessage(message) {
    for (var i = 0; i < strings.validYesWords.length; i++) {
        if (msg == strings.validYesWords[i]) {
            sys.log("isYesMessage: message is yes");
            return true;
        }
    }
}

function isNoMessage(message) {
    for (var i = 0; i < strings.validNoWords.length; i++) {
        if (msg == strings.validNoWords[i]) {
            sys.log("isNoMessage: message is no");
            return true;
        }
    }
}

function requestLocation (res, resend) {
    var locationXml = "";
    for (var i = 1; i <= strings.availableLocations.length; i++) {
        locationXml += (i + ": " + strings.availableLocations[i-1]);

        if (i != strings.availableLocations.length+1) {
            locationXml += "\n";
        }
    }

    var responseText = "";

    if (resend) {
        responseText += strings.resendText;
    }

    responseText += strings.askLocation + locationXml;

    var response = new twilio.TwimlResponse();
    response.sms(responseText);
    res.cookie('rideStage', rideStages.AWAITING_LOCATION);
    sys.log("requestLocation: Just set the rideStage to " + rideStages.AWAITING_LOCATION);
    res.send(response.toString(), {
        'Content-Type':'text/xml'
    }, 200);
}

function requestTrailerInfo(res, resend) {
    var response = new twilio.TwimlResponse();
    response.sms(strings.askTrailer);
    res.cookie('rideStage', rideStages.AWAITING_TRAILER);
    sys.log("requestTrailerInfo: Just set the rideStage to " + rideStages.AWAITING_TRAILER);
    res.send(response.toString(), {
        'Content-Type':'text/xml'
    }, 200);
}

function sendWaitText(res) {
    sys.log("sendWaitText");
    var response = new twilio.TwimlResponse();
    response.sms(strings.waitText);
    //res.cookie('rideStage', rideStages.CONTACTING_DRIVER);
    //sys.log("sendWaitText: Just set the rideStage to " + rideStages.CONTACTING_DRIVER);
    res.send(response.toString(), {}, 200);
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

function sendNoDriversText(rider) {
    /*
     * Set rideStage cookie to rideStages.AWAITING_DRIVER
     */
    twilioClient.sms.messages.create({
        to: rider,
        from: TWILIO_NUMBER,
        body: strings.noDriversAvailable
    }, function(error, message) {
        if (!error) {
            // Record time sent, so if nothing comes up in 30 mins, let them know
        } else {
            sys.log('Failed to send noDriversText, ' + error);
        }
    });
}

function textDriverForConfirmation(driverNumber) {
    twilioClient.sendSms({
        to: driverNumber,
        from: TWILIO_NUMBER,
        body: "Do you want to accept a new ride request?"
    }, function(error, message) {
        if (!error) {
            // Record time sent, so if nothing comes up in 30 mins, let them know
            // Actually, start timeout once the wait text is sent to rider, then
            // cancel that if the ride is accepted
        } else {
            sys.log('Failed to send message asking if driver wanted to accept ride, ' + error);
        }
    });
}

var receiveIncomingMessage = function(req, res, next) {
    var message   = req.body.Body;
    var from      = req.body.From;
    var isDriver  = isSenderDriver(from);
    var rideStage = getRideStage(req, isDriver);

    // Hacks/development/testing shortcuts
    if (isRideStageReset(res, message)) {
        return;
    } else if (isQuickDriverSignUp(res, message, from)) {
        return;
    } else if (isQuickRemoveDriver(res, message, from)) {
        return;
    }

    if (isDriver) {
        sys.log('From: ' + from + ', Status: Driver, Message: ' + message + ', rideStage: ' + rideStage);
        handleDriverText(res, message, from);
    } else {
        sys.log('From: ' + from + ', Status: Rider, Message: ' + message + ', rideStage: ' + rideStage);
        handleRiderText(req, res, message, from, rideStage);
    }
}

/* Incoming SMS */
router.post('/', [receiveIncomingMessage]);

module.exports = router;
