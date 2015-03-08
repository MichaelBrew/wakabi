var strings = require('./strings');

module.exports = {
    isYesMessage: function(msg) {
        for (var i = 0; i < strings.validYesWords.length; i++) {
            if (msg == strings.validYesWords[i]) {
                sys.log("isYesMessage: message is yes");
                return true;
            }
        }
    },
    isNoMessage: function(msg) {
        for (var i = 0; i < strings.validNoWords.length; i++) {
            if (msg == strings.validNoWords[i]) {
                sys.log("isNoMessage: message is no");
                return true;
            }
        }
    }
};
