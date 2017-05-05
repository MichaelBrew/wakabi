const router = require('express').Router()
const moment = require('moment')
const pg = require('pg')

/* GET home page. */
router.get('/', (req, res, next) => {
  const params = {
    tab: 'Home',
    date: moment().format('MMMM D, YYYY'),
    numDrivers: 0,
    numIdleDrivers: 0,
    numBusyDrivers: 0,
    ridesRequested: 0,
    ridesCompleted: 0,
    ridesFailed: 0,
    positiveFeedback: 0,
    negativeFeedback: 0,
    netFeedback: 0,
    alerts: []
  }

  pg.connect(process.env.DATABASE_URL, (err, client) => {
    if (err) {
      return res.render('index', params)
    }

    client.query('SELECT * FROM drivers', (err1, {rows: drivers}) => {
      if (err1) {
        return res.render('index', params)
      }

      params.numDrivers = drivers
        .filter(({working}) => working)
        .length
      params.alerts = drivers
        .filter(({rating}) => rating < 80)
        .map(({num, rating}) => ({
          message: `Driver ${num} rating fell to ${rating}%`,
          path: `/drivercenter?driver=${num.replace(/\+/g, '')}`
        }))

      // TODO: Fix date comparison w/ Postgres
      const today = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss Z')

      client.query(`SELECT * FROM rides WHERE request_time >= ${today}`, (err2, {rows: rides}) => {
        if (err2) {
          return res.render('index', params)
        }

        params.ridesCompleted = rides
          .filter(({end_time: end}) => end != null)
          .length
        params.positiveFeedback = rides
          .filter(({feedback}) => feedback === 'good')
          .length
        params.negativeFeedback = rides
          .filter(({feedback}) => feedback && feedback !== 'good')
          .length

        params.ridesRequested = rides.length
        params.ridesFailed = params.ridesRequested - params.ridesCompleted
        params.netFeedback = params.positiveFeedback - params.negativeFeedback

        return res.render('index', params)
      })
    })
  })
})

module.exports = router
