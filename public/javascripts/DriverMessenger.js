var sys     = require('sys');
var stages  = require('./stages');
var strings = require('./strings');
var parser  = require('./messageParser');

/* Twilio Credentials */
var accountSid    = 'ACf55ee981f914dc797efa85947d9f60b8';
var authToken     = 'cc3c8f0a7949ce40356c029579934c0f';
var twilio        = require('twilio');
var twilioClient  = require('twilio')(accountSid, authToken);
var TWILIO_NUMBER = '+18443359847';

function textDriverForConfirmation(driverNumber) {
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
                handleEndRideText(res, message);
                break;
        }
    }
};
