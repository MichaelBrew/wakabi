var sys     = require('sys');
var strings = require('./strings');

/* Twilio Credentials */
var accountSid    = 'ACf55ee981f914dc797efa85947d9f60b8';
var authToken     = 'cc3c8f0a7949ce40356c029579934c0f';
var twilio        = require('twilio');
var twilioClient  = require('twilio')(accountSid, authToken);
var TWILIO_NUMBER = '+18443359847';

function sendInitialText(to, msg) {
  twilioClient.sendSms({
    to: to,
    from: TWILIO_NUMBER,
    body: msg
  }, function(error, message) {
    if (!error) {
      sys.log("TextMessenger.text: successfully sent message: " + msg + "; to " + to);
    } else {
      sys.log("TextMessenger.text: error sending to " + to + " the message: " + msg);
    }
  });
}

function sendResponsetext(res, message, cookies) {
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

module.exports = {
  text: function(to, msg) {
    sendInitialText(to, msg);
  },
  textResponse: function(res, message, cookies) {
    sendResponsetext(res, message, cookies);
  },
  requestLocation: function(res, resend, cookies) {
    var locationList = "";
    for (var i = 1; i <= strings.availableLocations.length; i++) {
      locationList += (i + ": " + strings.availableLocations[i-1]);

      if (i != strings.availableLocations.length) {
        locationList += "\n";
      }
    }

    var responseText = "";
    if (resend) {
      responseText += strings.resendText;
    }

    responseText += strings.askLocation + locationList;
    sendResponseText(res, responseText, cookies);
  }
};