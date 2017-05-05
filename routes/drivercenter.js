const router = require('express').Router()
const pg = require('pg')

/* GET driver center page. */
router.get('/', (req, res, next) => {
  const params = {
    tab: 'Drivers',
    drivers: null,
    currentDriver: null
  }

  pg.connect(process.env.DATABASE_URL, (err, client) => {
    if (err) {
      return res.render('drivercenter', params)
    }

    client.query('SELECT * FROM drivers', (err1, {rows: drivers}) => {
      if (err1) {
        return res.render('drivercenter', params)
      }

      params.drivers = drivers
      params.currentDriver = (req.query.driver != null) ? req.query.driver : null

      return res.render('drivercenter', params)
    })
  })
})

router.get('/remove/:id', (req, res, next) => {
  const driverNum = req.query.driver

  pg.connect(process.env.DATABASE_URL, (err, client) => {
    if (err) {
      return res.error()
    }

    client.query(`DELETE FROM drivers WHERE num = '${driverNum}'`, (err1) => {
      if (err1) {
        return res.error()
      }

      res.success()
      client.end()
    })
  })
})

module.exports = router
