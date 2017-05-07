const express = require('express')
const path = require('path')
const logger = require('morgan')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')

const index = require('./routes/index')
const drivercenter = require('./routes/drivercenter')
const {handleIncomingText} = require('./routes/incoming')

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

// From web client
app.use('/', index)
app.use('/drivercenter', drivercenter)
app.use('/drivercenter/remove/:id', drivercenter)

// From Twilio
app.post('/incoming', handleIncomingText)

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  next(Object.assign(new Error('Not Found'), {status: 404}))
})

// Error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  res.status(err.status || 500)
  res.render('error', {
    message: err.message,
    error: (app.get('env') === 'development') ? err : {}
  })
})

module.exports = app
