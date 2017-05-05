const express = require('express')
const path = require('path')
const logger = require('morgan')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')

const index = require('./routes/index')
const incoming = require('./routes/incoming')
const drivercenter = require('./routes/drivercenter')

const app = express()

// Rider waiting queue
global.riderWaitingQueue = []

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')

app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

app.use('/', index)
app.use('/incoming', incoming)
app.use('/drivercenter', drivercenter)
app.use('/drivercenter/remove/:id', drivercenter)

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(Object.assign(new Error('Not Found'), {status: 404}))
})

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use((err, req, res, next) => {
    res.status(err.status || 500)
    res.render('error', {
      message: err.message,
      error: err
    })
  })
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
  res.status(err.status || 500)
  res.render('error', {
    message: err.message,
    error: {}
  })
})

module.exports = app
