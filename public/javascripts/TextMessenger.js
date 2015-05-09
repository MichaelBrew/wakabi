var sys     = require('sys');

/* Twilio Credentials */
var accountSid    = 'ACf55ee981f914dc797efa85947d9f60b8';
var authToken     = 'cc3c8f0a7949ce40356c029579934c0f';
var twilio        = require('twilio');
var twilioClient  = require('twilio')(accountSid, authToken);
var TWILIO_NUMBER = '+18443359847';

module.exports = {
  textResponse: function(res, message, cookies) {
    var response = new twilio.TwimlResponse();
    response.sms(message);

    if (cookies != null) {
      for (var key in cookies) {
        if (cookies.hasOwnProperty(key)) {
          res.cookie(key, cookies[key]);
          sys.log("Twilio.textResponse: cookie " + key + " set to " + cookies[key]);
        }
      }
    }

    res.send(response.toString(), {
      'Content-Type':'text/xml'
    }, 200);

    sys.log("TextMessenger.textResponse: response sent");
  }
};