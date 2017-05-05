const router = require('express').Router()
const moment = require('moment')
const pg = require('pg')
const _ = require('lodash')

const stages = require('../public/javascripts/stages')

const Messenger = require('../public/javascripts/TextMessenger')
const RiderMessenger = require('../public/javascripts/Rider/RiderMessenger')
const DriverMessenger = require('../public/javascripts/Driver/DriverMessenger')

/* ************** */
/* TEST FUNCTIONS */
/* ************** */

function isRideStageReset(res, msg = '') {
  if (msg.replace(/\s+/g, '').toLowerCase() !== 'reset') {
    return false
  }

  Messenger.textResponse(res, 'Ok, rideStage/driveStage has been reset to NOTHING', {
    rideStage: stages.rideStages.NOTHING,
    driveStage: stages.driveStages.NOTHING
  })

  return true
}

function isQuickDriverSignUp(res, msg = '', from) {
  if (msg.replace(/\s+/g, '').toLowerCase() !== 'signupdriver') {
    return false
  }

  pg.connect(process.env.DATABASE_URL, (err, client) => {
    if (err) {
      return Messenger.textResponse(res, `Error connecting to DB to add driver, ${err}`)
    }

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
        '${from}',
        true,
        1,
        true,
        100,
        '${moment().format('YYYY-MM-DD HH:mm:ssZ')}',
        0,
        '${moment('1976-01-01').format('YYYY-MM-DD HH:mm:ssZ')}'
      )`

    client.query(queryString, (err1) => {
      const responseText = (err1 != null)
        ? `Error adding driver, ${err1}`
        : 'Ok, you are now registered as a driver!'

      Messenger.textResponse(res, responseText, {
        driveStage: stages.driveStages.NOTHING
      })

      client.end()
    })
  })

  return true
}

function isQuickRemoveDriver(res, msg = '', from) {
  if (msg.replace(/\s+/g, '').toLowerCase() !== 'removedriver') {
    return false
  }

  pg.connect(process.env.DATABASE_URL, (err, client) => {
    if (err) {
      return Messenger.textResponse(res, `Error connecting to DB to remove driver, ${err}`)
    }

    client.query(`DELETE FROM drivers WHERE num = '${from}'`, (err1) => {
      const responseText = (err1 != null)
        ? `Error removing driver, ${err}`
        : 'Ok, you are no longer a driver!'

      Messenger.textResponse(res, responseText, {
        rideStage: (err1 != null) ? stages.rideStages.NOTHING : undefined
      })

      client.end()
    })
  })

  return true
}

/* ***************** */
/* ROUTING FUNCTIONS */
/* ***************** */

function getStage(request, isDriver) {
  if (isDriver) {
    if (_.get(request, 'cookies.driveStage')) {
      return request.cookies.driveStage
    }
  } else {
    if (_.get(request, 'cookies.rideStage')) {
      return request.cookies.rideStage
    }
  }

  return isDriver
    ? stages.driveStages.NOTHING
    : stages.rideStages.NOTHING
}

function receiveIncomingMessage(req, res, next) {
  const message = req.body.Body
  const from = req.body.From

  console.log(`incoming: From: ${from}, Message: ${message}`)

  /**
   * These all come from the phone number itself, not from the sender's actual location
   * (unless they're in the same place that their phone number is registered).
   *
   * const fromCity = req.body.FromCity
   * const fromState = req.body.FromState
   * const fromZip = req.body.FromZip
   * const fromCountry = req.body.FromCountry
   *
   * if (fromCity) sys.log('incoming: fromCity = ' + fromCity)
   * if (fromState) sys.log('incoming: fromState = ' + fromState)
   * if (fromZip) sys.log('incoming: fromZip = ' + fromZip)
   * if (fromCountry) sys.log('incoming: fromCountry = ' + fromCountry)
   */

  // Testing shortcuts
  if (isRideStageReset(res, message) ||
      isQuickDriverSignUp(res, message, from) ||
      isQuickRemoveDriver(res, message, from)) {
    return
  }

  pg.connect(process.env.DATABASE_URL, (err, client) => {
    if (err) {
      // Default to rider
      return RiderMessenger.handleText(req, res, message, from, getStage(req, false))
    }

    // Check if sender is a driver
    client.query(`SELECT num FROM drivers WHERE num = '${from}'`, (err1, {rows: drivers}) => {
      if (err1) {
        // Default to rider
        return RiderMessenger.handleText(req, res, message, from, getStage(req, false))
      }

      if (drivers.length === 0) {
        RiderMessenger.handleText(req, res, message, from, getStage(req, false))
      } else {
        DriverMessenger.handleText(res, message, from, getStage(req, true))
      }

      client.end()
    })
  })
}

/* Incoming SMS */
router.post('/', [receiveIncomingMessage])

module.exports = router
