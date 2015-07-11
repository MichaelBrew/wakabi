var express      = require('express');
var path         = require('path');
var favicon      = require('serve-favicon');
var logger       = require('morgan');
var moment       = require('moment');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var sys          = require('sys');

var index        = require('./routes/index');
var incoming     = require('./routes/incoming');
var drivercenter = require('./routes/drivercenter');

var app = express();

// Rider waiting queue
global.riderWaitingQueue = [];

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(__dirname + 'public'));

app.use('/', index);
app.use('/incoming', incoming);
app.use('/drivercenter', drivercenter);
app.use('/drivercenter/remove/:id', drivercenter)

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
