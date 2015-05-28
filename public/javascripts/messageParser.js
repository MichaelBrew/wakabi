var sys     = require('sys');
var strings = require('./strings');

module.exports = {
  isYesMessage: function(msg) {
    msg = msg.replace(/\s+/g, '');
    for (var i = 0; i < strings.validYesWords.length; i++) {
      if (msg == strings.validYesWords[i]) {
        return true;
      }
    }
  },
  isNoMessage: function(msg) {
    msg = msg.replace(/\s+/g, '');
    for (var i = 0; i < strings.validNoWords.length; i++) {
      if (msg == strings.validNoWords[i]) {
        return true;
      }
    }
  },
  isEndRideMessage: function(msg) {
    if (msg.toUpperCase() == "END RIDE") {
      return true;
    }
    return false;
  },
  isStartShift: function(msg) {
    if (msg.toLowerCase() == 'start shift') {
      return true;
    }
    return false;
  },
  isEndShift: function(msg) {
    if (msg.toLowerCase() == 'end shift') {
      return true;
    }
    return false;
  },
  isRideRequest: function(msg) {
    msg = msg.replace(/\s+/g, '');
    if (msg.toLowerCase() == strings.keywordRide) {
      return true;
    }
    return false;
  }
};
