const strings = require('./strings')
const twilio = require('twilio')
const twilioClient = require('twilio')('ACf55ee981f914dc797efa85947d9f60b8', 'cc3c8f0a7949ce40356c029579934c0f') // eslint-disable-line max-len

const TWILIO_NUMBER = '+18443359847'

function sendResponseText(res, message, cookies = {}) {
  Object.assign(res.cookie, cookies)

  const response = (new twilio.TwimlResponse())
    .sms(message)
    .toString()

  return res.send(response, {'Content-Type': 'text/xml'}, 200)
}

module.exports = {
  textResponse: sendResponseText,

  text: (to, msg) => {
    return new Promise(resolve => {
      twilioClient.sendSms({
        to,
        from: TWILIO_NUMBER,
        body: msg
      }, () => {
        resolve()
      })
    })
  },

  requestLocation: (res, resend, cookies = {}) => {
    const locationList = strings.availableLocations
      .reduce((list, loc, i) => `${list}${i + 1}: ${loc}\n`)

    const responseText = resend
      ? strings.resendText + strings.askLocation + locationList
      : strings.askLocation + locationList

    return sendResponseText(res, responseText, cookies)
  }
}
