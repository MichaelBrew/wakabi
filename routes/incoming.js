var express = require('express');
var pg      = require('pg');
var sys     = require('sys');
var router  = express.Router();

// Twilio Credentials
var accountSid   = 'ACf55ee981f914dc797efa85947d9f60b8';
var authToken    = 'cc3c8f0a7949ce40356c029579934c0f';
var twilio       = require('twilio');
var twilioClient = require('twilio')(accountSid, authToken);

var keywordRide = "RIDE";
var availableLocations = [
    "area1",
    "area2",
    "area3",
    "area4",
    "area5"
];

var rideStages = {
    DRIVER         : "driver",
    NOT_REQUESTED  : "haveNotRequested",
    REQUESTED_RIDE : "requestedRide",
    SENT_LOCATION  : "sentLocation",
    SENT_TRAILER   : "sentTrailer"
}

var resendText = "We\'re sorry, we did not understand that message. "

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
            return rideStages.NOT_REQUESTED;
        }
    //`}
}

function addRiderNumToDb(from) {
    pg.connect(process.env.DATABASE_URL, function(err, client) {
        sys.log("Connected to DB");
        // Query to add rider into DB (I think)
        // INSERT INTO riders (num, onride) VALUES (from, false);

        // Look for rider
        // TODO: Is this serach query correct?
        var query = client.query("SELECT num FROM riders WHERE num = '" + from + "'", function(err, result) {
            if (!err) {
                sys.log("Row count: %d", result.rows.length);

                if (result.rows.length == 0) {
                    // Rider is not in DB yet, add them
                    // TODO: Should probably normalize the input (such as just having format +11111111)
                    var addRiderQuery = client.query("INSERT INTO riders (num, onride) VALUES ('" + from + "', false)", function(err, result) {
                        if (!err) {
                            sys.log("Rider " + from + " unsuccessfully added to DB");
                        } else {
                            sys.log("Rider " + from + " successfully added to DB");
                        }
                    });
                } else {
                    // Rider already exists in DB
                    sys.log("Rider already exists in DB");
                }
            } else {
                sys.log("Error querying DB to see if rider exists already");
            }
        });

        /*
        query.on('row', function(row) {
            console.log(JSON.stringify(row));
        });
    */
    });
}

/**********************/
/* REPLYING FUNCTIONS */
/**********************/
function handleRiderText(res, message, from, riderStage) {
    switch (riderStage) {
        case rideStages.NOT_REQUESTED:
            if (message.toUpperCase() === keywordRide) {
                sys.log('Ride requested');

                addRiderNumToDb(from);

                // Send response asking for location
                requestLocation(res, false);
            } else {
                defaultHelpResponse(res);
            }
            break;

        case rideStages.REQUESTED_RIDE:
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
    for (var i = 1; i <= availableLocations.length; i++) {
        locationXml += (i + ": " + availableLocations[i-1]);

        if (i != availableLocations.length+1) {
            locationXml += "\n";
        }
    }

    var responseText = "";

    if (resend) {
        responseText += resendText;
    }

    responseText += 'Please respond with the number corresponding to your location:\n' + locationXml;

    var response = new twilio.TwimlResponse();
    response.sms(responseText);
    res.send(response.toString(), {
        'Set-Cookie':'rideStage='+rideStages.REQUESTED_RIDE,
        'Content-Type':'text/xml'
    }, 200);
}

function requestTrailerInfo(res, resend) {

}

function defaultHelpResponse(res) {
    var responseText = resendText + "Please text RIDE to request a ride.";
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
