var express = require('express');
var pg      = require('pg');
var sys     = require('sys');
var router  = express.Router();
var strings = require('../public/javascripts/strings');

// Twilio Credentials
var accountSid   = 'ACf55ee981f914dc797efa85947d9f60b8';
var authToken    = 'cc3c8f0a7949ce40356c029579934c0f';
var twilio       = require('twilio');
var twilioClient = require('twilio')(accountSid, authToken);

/*
 * The 'rideStages' var acts as an enum to represent where the current
 * rider is in the request process.
 *
 * DRIVER        : All drivers rideStages is marked DRIVER (default for drivers)
 * SENT_NOTHING  : Before the request, all riders have sent nothing (default for riders)
 * SENT_REQUEST  : The rider has now sent the initial request 
 * SENT_LOCATION : The rider has now sent their location
 * SENT_TRAILER  : The rider has now sent whether they need a trailer
*/
var rideStages = {
    DRIVER        : "driver",
    SENT_NOTHING  : "sentNothing",
    SENT_REQUEST  : "sentRequest",
    SENT_LOCATION : "sentLocation",
    SENT_TRAILER  : "sentTrailer"
}


/********************/
/* HELPER FUNCTIONS */
/********************/
function isSenderDriver(senderNumber) {
    if (/* Sender number found in driver DB table*/0) {
        return true;
    } else {
        return false;
    }
}

/*
 * Grabbed this from the internet, but I don't think
 * it's quite right. Not sure whether to keep.
 */
function parseCookies (request) {
    var list = {},
        rc   = request.headers.cookie;

    console.log("The request headers are:");
    for (var key in request.headers) {
        console.log("key: " + key + ", value: " + request.headers[key]);
    }
    sys.log("The cookies are " + rc);

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = unescape(parts.join('='));
    });

    return list;
}

function getRideStage(request, isDriver) {
    /*
    if (request.cookies.get("rideStage") != null) {
        return request.cookies.get("rideStage");
    } else {
    */
        if (isDriver) {
            return rideStages.DRIVER;
        } else {
            return rideStages.SENT_NOTHING;
        }
    //`}
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
                                sys.log("Rider " + from + " successfully added to DB");
                            } else {
                                sys.log("Rider " + from + " unsuccessfully added to DB, " + err);
                            }
                        });
                    } else {
                        // Rider already exists in DB
                        sys.log("Rider already exists in DB");
                    }
                } else {
                    sys.log("Error querying DB to see if rider exists already, " + err);
                }
            });
        } else {
            sys.log("Error connecting to DB, " + err);
        }
    });
}

/**********************/
/* REPLYING FUNCTIONS */
/**********************/
function handleRiderText(res, message, from, riderStage) {
    switch (riderStage) {
        case rideStages.SENT_NOTHING:
            if (message.toUpperCase() === strings.keywordRide) {
                sys.log('Ride requested');

                addRiderNumToDb(from);

                // Send response asking for location
                requestLocation(res, false);
            } else {
                defaultHelpResponse(res);
            }
            break;

        case rideStages.SENT_REQUEST:
            sys.log('Asked for location');

            if (/* Check if received text contains single number that was part of locations list*/0) {
                // Send response asking for needed trailer
                requestTrailerInfo(res, false);
            } else {
                // Send response asking them to resend their location correctly this time
                requestLocation(res, true);
            }
            break;

        case rideStages.SENT_LOCATION:
            sys.log('Received location');
            break;

        case rideStages.SENT_TRAILER:
            sys.log('Received trailer decision');
            break;
    }
}

function handleDriverText(res, message, from) {
    // Do something
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
        responseText += resendText;
    }

    responseText += strings.askLocation + locationXml;

    var response = new twilio.TwimlResponse();
    response.sms(responseText);
    res.send(response.toString(), {
        'Set-Cookie':'rideStage='+rideStages.SENT_REQUEST,
        'Content-Type':'text/xml'
    }, 200);
}

function requestTrailerInfo(res, resend) {

}

function defaultHelpResponse(res) {
    var responseText = resendText + strings.helpText;
    var response = new twilio.TwimlResponse();
    response.sms(responseText);
    res.send(response.toString(), {
        'Content-Type':'text/xml'
    }, 200);
}

var receiveIncomingMessage = function(req, res, next) {
    var message   = req.body.Body;
    var from      = req.body.From;
    var isDriver  = isSenderDriver(from);
    var rideStage = getRideStage(req, isDriver);

    /*
    var rideStage;

    /* TODO
     * Cookies doesn't work yet, whoops
     * Need it to track session
     * FIX IT!!!!!

    if (cookies['rideStage'] == null) {
        if (isDriver) {
            rideStage = rideStages.DRIVER;
        } else {
            rideStage = rideStages.NOT_REQUESTED;
        }
    } else {
        rideStage = cookies['rideStage'];
    }
    */

    if (isDriver) {
        sys.log('From: ' + from + ', Status: Driver, Message: ' + message + ', rideStage: ' + rideStage);
    } else {
        sys.log('From: ' + from + ', Status: Rider, Message: ' + message + ', rideStage: ' + rideStage);
    }

    if (!isDriver) {
        // Handling rider texts
        handleRiderText(res, message, from, rideStage);
    } else {
        // Handling driver texts
        handleDriverText(res, message, from);
    }
}

/* Incoming SMS */
router.post('/', [receiveIncomingMessage]);

module.exports = router;
