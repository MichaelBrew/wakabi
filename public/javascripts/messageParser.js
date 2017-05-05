const _ = require('lodash')
const STRINGS = require('./strings')

module.exports = {
  isYesMessage: (msg = '') => {
    return _.find(STRINGS.validYesWords, msg.replace(/\s+/g, '')) != null
  },

  isNoMessage: (msg = '') => {
    return _.find(STRINGS.validNoWords, msg.replace(/\s+/g, '')) != null
  },

  isEndRideMessage: (msg = '') => {
    return msg.toUpperCase() === 'END RIDE'
  },

  isStartShift: (msg = '') => {
    return msg.toUpperCase() === 'START SHIFT'
  },

  isEndShift: (msg = '') => {
    return msg.toUpperCase() === 'END SHIFT'
  },

  isRideRequest: (msg = '') => {
    return msg.replace(/\s+/g, '').toLowerCase() === STRINGS.keywordRide
  },

  verifyRiderLocation: (msg = '') => {
    return +msg > 0 && +msg <= STRINGS.availableLocations.length
  }
}
