const moment = require('moment')

const STAGES = require('../stages')
const STRINGS = require('../strings')

const parser = require('../messageParser')
const db = require('../db')
const DriverUtil = require('./DriverUtil')
const PgUtil = require('../../../util/pg')
const Messenger = require('../TextMessenger')

function requestLocation(res, resend, driveStage) {
  return Messenger.requestLocation(res, resend, {driveStage})
}

function receiveStartShiftLocation(res, location, driverNum) {
  return DriverUtil.toggleDriverShift(driverNum, true)
    .then(() => DriverUtil.updateLocation(driverNum, +location))
    .then(() => Messenger.textResponse(res, STRINGS.successfulStartShift, {
      driveStage: STAGES.driveStages.NOTHING
    }))
    .catch(() => Messenger.textResponse(res, STRINGS.dbError, {
      driveStage: STAGES.driveStages.NOTHING
    }))
}

function sendNumberToDriver(res, driverNum) {
  const queryString = `
    UPDATE
      rides
    SET
      status = 'ACTIVE'
    WHERE
      driver_num = '${driverNum}' AND end_time IS NULL RETURNING rider_num
  `

  return PgUtil.query(queryString).then(({rows: riders}) => {
    return Messenger.textResponse(res, `${STRINGS.hereIsRiderNum}${riders[0].rider_num}`, {
      driveStage: STAGES.driveStages.AWAITING_END_RIDE
    })
  })
}

function handleRequestResponse(res, message, driverNum) {
  if (parser.isYesMessage(message)) {
    return sendNumberToDriver(res, driverNum)
  } else if (parser.isNoMessage(message)) {
    return DriverUtil.getDriverWithNum(driverNum).then(driver => {
      if (!driver) {
        return null
      }

      const getRidesQuery =
        `SELECT * FROM rides WHERE driver_num = '${driverNum}' AND end_time IS NULL`

      return PgUtil.query(getRidesQuery).then(({rows: rides}) => {
        const [ride] = rides

        return PgUtil.query(`UPDATE rides SET driver_num = NULL WHERE ride_id = ${ride.ride_id}`)
          .then(() => {
            return db.sendRequestToAvailableDriver({
              rideId: ride.ride_id,
              driverTimeLastRide: driver.time_last_ride,
              riderWaitingForResponse: true
            })
          })
      })
    })
  }
}

function handleEndRideText(res, message, driverNum) {
  if (!parser.isEndRideMessage(message)) {
    return Promise.resolve()
  }

  const getRidesQuery =
    `SELECT * FROM rides WHERE driver_num = '${driverNum}' AND end_time IS NULL`

  return PgUtil.query(getRidesQuery).then(({rows: rides}) => {
    const rideId = rides[0].ride_id
    const riderNum = rides[0].rider_num
    const rideEndTime = moment().format('YYYY-MM-DD HH:mm:ssZ')

    const updateRideQuery =
      `UPDATE rides SET end_time = '${rideEndTime}', status = 'FINISHED' WHERE ride_id = ${rideId}`
    const updateDriverQuery =
      `UPDATE drivers SET time_last_ride = '${rideEndTime}' WHERE num = '${driverNum}'`

    return Promise.all([
      requestLocation(res, false, STAGES.driveStages.AWAITING_UPDATED_LOCATION),
      Messenger.text(riderNum, STRINGS.feedbackQuestion),
      PgUtil.query(updateRideQuery),
      PgUtil.query(updateDriverQuery)
    ])
  })
}

function handleUpdatedLocation(res, message, driverNum) {
  return PgUtil.query(`UPDATE drivers SET current_zone = ${+message} WHERE num = '${driverNum}'`)
    .then(() => {
      const updateRideQuery = `
        UPDATE
          rides
        SET
          destination = ${+message}
        WHERE
          driver_num = '${driverNum}' AND destination IS NULL
      `

      return Promise.all([
        PgUtil.query(updateRideQuery),
        Messenger.textResponse(res, STRINGS.updatedDriverLocation, {
          driveStage: STAGES.driveStages.NOTHING
        })
      ])
    })
}

function isShiftChange(message) {
  return (parser.isStartShift(message)) || (parser.isEndShift(message))
}

function processShiftChange(res, message, driverNum) {
  if (parser.isStartShift(message)) {
    return requestLocation(res, false, STAGES.driveStages.AWAITING_START_LOCATION)
  } else if (parser.isEndShift(message)) {
    return DriverUtil.toggleDriverShift(driverNum, false)
      .then(() => Messenger.textResponse(res, STRINGS.successfulEndShift, {
        driveStage: STAGES.driveStages.NOTHING
      }))
      .catch(() => Messenger.textResponse(res, STRINGS.dbError))
  }
}

module.exports = {
  handleText: (res, message, driverNum, driverStage) => {
    if (isShiftChange(message)) {
      return processShiftChange(res, message, driverNum)
    }

    switch (driverStage) {
      case STAGES.driveStages.AWAITING_START_LOCATION:
        return receiveStartShiftLocation(res, message, driverNum)

      case STAGES.driveStages.NOTHING:
        return handleRequestResponse(res, message, driverNum)

      case STAGES.driveStages.AWAITING_END_RIDE:
        return handleEndRideText(res, message, driverNum)

      case STAGES.driveStages.AWAITING_UPDATED_LOCATION:
        return handleUpdatedLocation(res, message, driverNum)

      default:
        console.error(`Unrecognized driver stage ${driverStage}`)
    }
  },

  textDriverForConfirmation: (driverNumber) => {
    return Messenger.text(driverNumber, STRINGS.acceptRideQuestion)
  }
}
