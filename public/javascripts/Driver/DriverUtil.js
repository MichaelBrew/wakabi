var sys = require('sys')
var pg = require('pg')

module.exports = {
  toggleDriverShift: function(from, starting, cb) {
    pg.connect(process.env.DATABASE_URL, function(err, client) {
      if (!err) {
        var queryString = "UPDATE drivers SET working = " + starting + " WHERE num = '" + from + "'"
        var query = client.query(queryString, function(err, result) {
          client.end()

          if (err) {
            cb(err)
          } else{
            cb()
          }
          // if (!err) {
          //   if (starting) {
          //     requestLocation(res, false, stages.driveStages.AWAITING_START_LOCATION)
          //   } else {
          //     cookies = {"driveStage": stages.driveStages.NOTHING}
          //     Messenger.textResponse(res, strings.successfulEndShift, cookies)
          //   }
          // } else {
          //   Messenger.textResponse(res, strings.dbError)
          // }
        })
      } else {
        cb(err)
        // Messenger.textResponse(res, strings.dbError)
      }
    })
  }
}