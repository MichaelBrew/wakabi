var sys     = require('sys');
var stages  = require('./stages');
var strings = require('./strings');
var parser  = require('./messageParser');
var db      = require('./db');

var RiderMessenger = require('./RiderMessenger');

/* Twilio Credentials */
var accountSid    = 'ACf55ee981f914dc797efa85947d9f60b8';
var authToken     = 'cc3c8f0a7949ce40356c029579934c0f';
var twilio        = require('twilio');
var twilioClient  = require('twilio')(accountSid, authToken);
var TWILIO_NUMBER = '+18443359847';

function textDriverForConfirmation(driverNumber, riderNumber) {
    pg.connect(process.env.DATABASE_URL, function(err, client) {
        if (!err) {
            var queryString = "UPDATE drivers SET giving_ride_to = '" + riderNumber + "' WHERE num = '" + driverNumber + "'";
            var query = client.query(queryString, function(err, result) {
                if (!err) {

                } else {

                }
            });
        } else {

        }
    });

    twilioClient.sendSms({
        to: driverNumber,
        from: TWILIO_NUMBER,
        body: strings.acceptRideQuestion
    }, function(error, message) {
        if (error) {
            sys.log('textDriverForConfirmation: Failed to send message asking if driver wanted to accept ride, ' + error.message);
            // TODO: Either try resending text, or send text to next available driver? Can be part of "edge case/error handling"
            //       work to be done spring quarter.
        }
    });
}

function driverStartShift(res, from) {

}

function driverEndShift(res, from) {

}

function handleRequestResponse(res, message, from) {
    if (message.toLowerCase() == 'start shift') {
        driverStartShift(res, from);
    }

    if (message.toLowerCase() == 'end shift') {
        driverEndShift(res, from);
    }

    if (parser.isYesMessage(message)) {
        var riderNum = 0; // Get rider's num from db under driver's 'giving_ride_to' column

        // sendNumberToDriver(res, from, riderNum);
        // markDriverUnavailable(from);

        db.cancelTimeoutForRider(riderNum);
    } else if (parser.isNoMessage(message)) {
        // pass the request on to the next driver
    } else {
        // wasn't a response to the request, send back default message?
    }
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
                        var riderNum = result.rows[0];
                        RiderMessenger.requestFeedback(riderNum);

                        // Clear 'giving_ride_to' value
                        var queryString = "UPDATE drivers SET on_ride = false, giving_ride_to = NULL WHERE num = '" + from + "'";
                        var query = client.query(queryString, function(err, result) {
                            if (!err) {
                                // cool
                            } else {
                                // uh oh
                            }
                        });
                    } else {
                        // uh oh
                    }
                });
            } else {
                // uh oh
            }
        });
    } else {
        // ignore for now
    }
}

module.exports = {
    handleText: function(res, message, from, driveStage) {
        switch (driveStage) {
            // TODO: what if driver randomly texts server? Can't assume it's in response
            //       to a ride request. Leave for "edge case" work spring quarter
            case stages.driveStages.NOTHING:
                handleRequestResponse(res, message, from);
                break;

            case stages.driveStages.AWAITING_START_RIDE:
                handleStartRideText(res, message);
                break;

            case stages.driveStages.AWAITING_END_RIDE:
                handleEndRideText(res, message, from);
                break;
        }
    }
};
