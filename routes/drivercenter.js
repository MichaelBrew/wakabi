const router = require('express').Router() // eslint-disable-line new-cap
const PgUtil = require('../util/pg')

/* GET driver center page. */
router.get('/', (req, res, next) => {
  const params = {
    tab: 'Drivers',
    drivers: null,
    currentDriver: null
  }

  return PgUtil.query('SELECT * FROM drivers')
    .then(({rows: drivers}) =>
      res.render('drivercenter', Object.assign({}, params, {
        drivers,
        currentDriver: req.query.driver
      })))
    .catch(() => res.render('drivercenter', params))
})

router.get('/remove/:id', (req, res, next) => {
  return PgUtil.query(`DELETE FROM drivers WHERE num = '${req.query.driver}'`)
    .then(() => res.success())
    .catch(() => res.error())
})

module.exports = router
