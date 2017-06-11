const moment = require('moment')
const _ = require('lodash')

const PgUtil = require('../util/pg')
const STAGES = require('../public/javascripts/stages')

const TextMessenger = require('../public/javascripts/TextMessenger')
const RiderMessenger = require('../public/javascripts/Rider/RiderMessenger')
const DriverMessenger = require('../public/javascripts/Driver/DriverMessenger')

/* ************** */
/* TEST FUNCTIONS */
/* ************** */

const isRideStageReset = (msg = '') => msg.replace(/\s+/g, '').toLowerCase() === 'reset'
const isQuickDriverSignUp = (msg = '') => msg.replace(/\s+/g, '').toLowerCase() === 'signupdriver'
const isQuickRemoveDriver = (msg = '') => msg.replace(/\s+/g, '').toLowerCase() === 'removedriver'

function processRideStageReset(res) {
  return TextMessenger.textResponse(res, 'Ok, rideStage/driveStage has been reset to NOTHING', {
    rideStage: STAGES.rideStages.NOTHING,
    driveStage: STAGES.driveStages.NOTHING
  })
}

function processQuickDriverSignUp(res, fromNum) {
  const queryString = `
    INSERT INTO drivers (
      num,
      working,
      current_zone,
      has_trailer,
      rating,
      last_payment,
      total_rides_completed,
      time_last_ride
    ) VALUES (
      '${fromNum}',
      true,
      1,
      true,
      100,
      '${moment().format('YYYY-MM-DD HH:mm:ssZ')}',
      0,
      '${moment('1976-01-01').format('YYYY-MM-DD HH:mm:ssZ')}'
    )`

  return PgUtil.query(queryString)
    .then(() => {
      return TextMessenger.textResponse(res, 'Ok, you are now registered as a driver!', {
        driveStage: STAGES.driveStages.NOTHING
      })
    })
    .catch(err => {
      return TextMessenger.textResponse(res, `Error with quick driver sign-up, ${err}`)
    })
}

function processQuickRemoveDriver(res, fromNum) {
  return PgUtil.query(`DELETE FROM drivers WHERE num = '${fromNum}'`)
    .then(() => {
      return TextMessenger.textResponse(res, 'Ok, you are no longer a driver!', {
        rideStage: STAGES.rideStages.NOTHING
      })
    })
    .catch(err => {
      return TextMessenger.textResponse(res, `Error connecting to DB to remove driver, ${err}`)
    })
}

/* ***************** */
/* ROUTING FUNCTIONS */
/* ***************** */

function getStage(request, isDriver) {
  if (isDriver && _.get(request, 'cookies.driveStage')) {
    return request.cookies.driveStage
  } else if (!isDriver && _.get(request, 'cookies.rideStage')) {
    return request.cookies.rideStage
  }

  return isDriver
    ? STAGES.driveStages.NOTHING
    : STAGES.rideStages.NOTHING
}

module.exports = (req, res, next) => { // eslint-disable-line no-unused-vars
  const message = req.body.Body
  const fromNum = req.body.From.replace(/\D/g, '')

  console.log(`incoming: fromNum = ${fromNum}, message = ${message}`)

  /**
   * These all come from the phone number itself, not from the sender's actual location
   * (unless they're in the same place that their phone number is registered).
   *
   * const fromCity = req.body.FromCity
   * const fromState = req.body.FromState
   * const fromZip = req.body.FromZip
   * const fromCountry = req.body.FromCountry
   */

  // Testing shortcuts
  if (isRideStageReset(message)) {
    return processRideStageReset(res)
  } else if (isQuickDriverSignUp(message)) {
    return processQuickDriverSignUp(res, fromNum)
  } else if (isQuickRemoveDriver(message)) {
    return processQuickRemoveDriver(res, fromNum)
  }

  return PgUtil.query(`SELECT num FROM drivers WHERE num = '${fromNum}'`)
    .then(({rows: drivers}) =>
      drivers.length === 0
        ? RiderMessenger.handleText(req, res, message, fromNum, getStage(req, false))
        : DriverMessenger.handleText(res, message, fromNum, getStage(req, true))
    )
    .catch(() => RiderMessenger.handleText(req, res, message, fromNum, getStage(req, false)))
}
