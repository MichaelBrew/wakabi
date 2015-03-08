var cookieParser = require('cookie-parser');
var express      = require('express');
var pg           = require('pg');
var sys          = require('sys');
var strings      = require('../public/javascripts/strings');
var db           = require('../public/javascripts/db');

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
function getRideStage(request) {
    var defaultReturnVal = rideStages.NOTHING;

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
        var responseText = "";

        if (db.quickAddDriver(from)) {
            responseText += "Ok, you are now registered as a driver!";
            res.cookie('rideStage', rideStages.DRIVER);
        } else {
            responseText += "Error adding driver, " + err;
        }

        var response = new twilio.TwimlResponse();
        response.sms(responseText);
        res.send(response.toString(), {
            'Content-Type':'text/xml'
        }, 200);

        return true;
    }

    return false;
}

function isQuickRemoveDriver(res, message, from) {
    if (message.toLowerCase() == "removedriver") {
        var responseText = "";

        if (db.isQuickRemoveDriver(from)) {
            responseText += "Ok, you are no longer a driver!";
            res.cookie('rideStage', rideStages.NOTHING);
        } else {
            responseText += "Error removing driver, " + err;
        }

        var response = new twilio.TwimlResponse();
        response.sms(responseText);
        res.send(response.toString(), {
            'Content-Type':'text/xml'
        }, 200);

        return true;
    }

    return false;
}

function searchForDriver(from, location, needTrailer) {
    var driver = db.searchForDriver(from, location, needTrailer);
    sys.log("Driver returned from db.searchForDriver is " + driver + ", with num " + driver.num);

    if (driver != null) {
        if (driver.num != null) {
            sys.log("searchForDriver: About to text driver " + driver.num);
            textDriverForConfirmation(driver.num);
        } else {
            sys.log("searchForDriver: driver.num is NULL");
            sendNoDriversText(from);
        }
    } else {
        sys.log("searchForDriver: searchForDriver returned null, calling sendNoDriversText");
        sendNoDriversText(from);
    }
}

/**********************/
/* REPLYING FUNCTIONS */
/**********************/
function handleRideRequest(res, message, from) {
    if (message.toUpperCase() == strings.keywordRide) {
        sys.log('handleRideRequest: Ride request received');

        db.addRiderNumToDb(from);
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
    if (isYesMessage(message) || isNoMessage(message)) {
        sys.log('handleTrailerResponse: Trailer decision received');
        var location = req.cookies.originLocation;
        sys.log('handleTrailerResponse: Got location from cookies, is location ' + location);

        sendWaitText(res);

        var needsTrailer = (isYesMessage(message) ? true : false);
        searchForDriver(from, location, needsTrailer);
    } else {
        sys.log('handleTrailerResponse: Invalid response for trailer decision');
        requestTrailerInfo(res, true);
    }
}

function handleRiderText(req, res, message, from, riderStage) {
    switch (riderStage) {
        case rideStages.NOTHING:
            handleRideRequest(res, message, from);
            break;

        case rideStages.AWAITING_LOCATION:
            handleLocationResponse(res, message);
            break;

        case rideStages.AWAITING_TRAILER:
            handleTrailerResponse(req, res, message, from);
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

function isYesMessage(msg) {
    for (var i = 0; i < strings.validYesWords.length; i++) {
        if (msg == strings.validYesWords[i]) {
            sys.log("isYesMessage: message is yes");
            return true;
        }
    }
}

function isNoMessage(msg) {
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
    var response = new twilio.TwimlResponse();
    response.sms(strings.waitText);
    res.cookie('rideStage', rideStages.CONTACTING_DRIVER);
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

function sendNoDriversText(rider) {
    sys.log("sendNoDriversText: beginning of sendNoDriversText");
    twilioClient.sendSms({
        to: rider,
        from: TWILIO_NUMBER,
        body: strings.noDriversAvailable
    }, function(error, message) {
        if (!error) {
            // Record time sent, so if nothing comes up in 30 mins, let them know
            sys.log("sendNoDriversText: successfully sent noDriversText")
        } else {
            sys.log('sendNoDriversText: Failed to send noDriversText, ' + error.message);
        }
    });
}

function textDriverForConfirmation(driverNumber) {
    twilioClient.sendSms({
        to: driverNumber,
        from: TWILIO_NUMBER,
        body: strings.acceptRideQuestion
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
    var rideStage = getRideStage(req);

    // Hacks/development/testing shortcuts
    if (isRideStageReset(res, message)) {
        return;
    } else if (isQuickDriverSignUp(res, message, from)) {
        return;
    } else if (isQuickRemoveDriver(res, message, from)) {
        return;
    }

    sys.log('From: ' + from + ', Message: ' + message + ', rideStage: ' + rideStage);

    pg.connect(process.env.DATABASE_URL, function(err, client) {
        if (typeof req === 'undefined'
            || typeof res === 'undefined'
            || typeof message === 'undefined'
            || typeof from === 'undefined'
            || typeof rideStage === 'undefined')
        {
            sys.log("Cannot reference variables in async db query callback :(");
            return;
        }
        if (!err) {
            // Check if sender is a driver
            var query = client.query("SELECT num FROM drivers WHERE num = '" + from + "'", function(err, result) {
                if (!err) {
                    if (result.rows.length == 0) {
                        sys.log("receiveIncomingMessage: sender is a rider");
                        handleRiderText(req, res, message, from, rideStage);
                    } else {
                        sys.log("receiveIncomingMessage: sender is a driver");
                        handleDriverText(res, message, from);
                    }
                } else {
                    sys.log("receiveIncomingMessage: Error querying DB to see if driver exists already, " + err);
                    // Default to rider
                    handleRiderText(req, res, message, from, rideStage);
                }
            });
        } else {
            sys.log("receiveIncomingMessage: Error connecting to DB, " + err);
            // Default to rider
            handleRiderText(req, res, message, from, rideStage);
        }
    });
}

/* Incoming SMS */
router.post('/', [receiveIncomingMessage]);

module.exports = router;
