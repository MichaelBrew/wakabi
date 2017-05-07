const PgUtil = require('../../../util/pg')

function getDriverWithNum(driverNum) {
  return PgUtil.query(`SELECT * FROM drivers WHERE num = '${driverNum}'`)
    .then(({rows: drivers}) => {
      if (drivers.length === 0) {
        return Promise.reject(`No driver found with number ${driverNum}`)
      }

      return drivers[0]
    })
}

function toggleDriverShift(driverNum, isWorking) {
  return PgUtil.query(`UPDATE drivers SET working = ${isWorking} WHERE num = '${driverNum}'`)
}

function updateLocation(driverNum, location) {
  return PgUtil.query(`UPDATE drivers SET current_zone = ${location} WHERE num = '${driverNum}'`)
}

module.exports = {getDriverWithNum, toggleDriverShift, updateLocation}
