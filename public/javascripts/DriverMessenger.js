var sys     = require('sys');
var stages  = require('./stages');
var strings = require('./strings');

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

module.exports = {
    handleText: function(res, message, from, driveStage) {
        switch (driveStage) {
            case stages.driveStages.NOTHING:
                // Expecting: Driver's decision to accept ride request
                // TODO: what if driver randomly texts server? Can't assume it's in response
                //       to a ride request
                if (isYesMessage(message)) {
                    // uh, where is the rider's number at this point?
                    // may need to store rider's number in DB as an extra column for driver
                    // entry, like 'riderNum'

                    //sendNumberToDriver(res);
                } else if (isNoMessage(message)) {
                    // pass the request on to the next driver
                } else {
                    // wasn't a response to the request, send back default message?
                }
                break;

            case stages.driveStages.AWAITING_START_RIDE:
                // Expecting: Start ride text
                handleStartRideText(res, message);
                break;

            case stages.driveStages.AWAITING_END_RIDE:
                // Expecting: End ride text
                handleEndRideText(res, message);
                break;

            default:
                // Shouldn't happen, getStage() should default return driveStages.NOTHING
        }
    }
};
