var express = require('express');
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

function parseCookies (request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = unescape(parts.join('='));
    });

    return list;
}

function requestLocation (sender, res, resend) {
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
        'Set-Cookie':'rideStage='+rideStages.REQUESTED_RIDE, 'Content-Type':'text/xml'
    }, 200);
}

function requestTrailerInfo(sender, res, resend) {

}

function isSenderDriver(senderNumber) {
    if (/* Sender number found in driver DB table*/0) {
        return true;
    } else {
        return false;
    }
}

var receiveIncomingMessage = function(req, res, next) {
    var message   = req.body.Body;
    var from      = req.body.From;
    var cookies   = parseCookies(req);
    var isDriver  = isSenderDriver(from);
    var rideStage;

    if (cookies['rideStage'] == null) {
        if (isDriver) {
            rideStage = rideStages.DRIVER;
        } else {
            rideStage = rideStages.NOT_REQUESTED;
        }
    } else {
        rideStage = cookies['rideStage'];
    }

    sys.log('From: ' + from + ', Message: ' + message + ', rideStage: ' + rideStage);

    if (!isDriver) {
        // Handling rider texts

        switch (rideStage) {
            case rideStages.NOT_REQUESTED:
                if (message.toUpperCase() === keywordRide) {
                    sys.log('Ride requested');

                    if (/* sender's number doesn't exist in riders DB*/0) {
                           /* Add number to rider DB*/
                    }

                    // Send response asking for location
                    requestLocation(from, res, false);
                }
                break;

            case rideStages.REQUESTED_RIDE:
                sys.log('Asked for location');

                if (/* Check if received text contains single number that was part of locations list*/0) {
                    // Send response asking for needed trailer
                    requestTrailerInfo(from, res);
                } else {
                    // Send response asking them to resend their location correctly this time
                    requestLocation(from, res, true);
                }
                break;

            case rideStages.SENT_LOCATION:
                sys.log('Received location');
                break;

            case rideStages.SENT_TRAILER:
                sys.log('Received trailer decision');
                break;
        }
    } else {
        // Handling driver texts
    }
}

/* Incoming SMS */
router.post('/', [receiveIncomingMessage]);

module.exports = router;
