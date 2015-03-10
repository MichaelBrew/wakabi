/*
 * db.js
 *
 * This file is intended to hold asynchronous database queries.
 * If a query is part of a sequential execution where future steps
 * rely on the result of such query, it should not be included here.
 *
 * Examples:
 * - GOOD: When receiving a text from a rider, query db to see if the number needs
 *         to be added to the rider's table. Response to rider is handled separately
 *         and does not rely on this result.
 * - BAD:  When receiving a new text, query the db to see if that number is part of
 *         the driver's table to decide whether to handle the text as a driver or rider.
 *         The response handling DOES rely on this result.
 */

var pg             = require('pg');
var sys            = require('sys');
var RiderMessenger = require('./RiderMessenger');

module.exports = {
    addRiderNumToDb: function (from) {
        pg.connect(process.env.DATABASE_URL, function(err, client) {
            if (!err) {
                // Look for rider
                var query = client.query("SELECT num FROM riders WHERE num = '" + from + "'", function(err, result) {
                    if (!err) {
                        if (result.rows.length == 0) {
                            // Rider is not in DB yet, add them
                            var addRiderQuery = client.query("INSERT INTO riders (num, onride) VALUES ('" + from + "', false)", function(err, result) {
                                if (!err) {
                                    sys.log("addRiderNumToDb: Rider " + from + " successfully added to DB");
                                } else {
                                    sys.log("addRiderNumToDb: Rider " + from + " unsuccessfully added to DB, " + err);
                                }
                            });
                        } else {
                            // Rider already exists in DB
                            sys.log("addRiderNumToDb: Rider already exists in DB");
                        }
                    } else {
                        sys.log("addRiderNumToDb: Error querying DB to see if rider exists already, " + err);
                    }
                });
            } else {
                sys.log("addRiderNumToDb: Error connecting to DB, " + err);
            }
        });
    },
    addRiderNumToDriver: function (driverNum, riderNum) {
        pg.connect(process.env.DATABASE_URL, function(err, client) {
            if (!err) {
                // Assign the rider's number to the driver's 'giving_ride_to' column
                var query = client.query("UPDATE drivers SET giving_ride_to = '" + riderNum + "' WHERE num = '" + driverNum + "'", function(err, result) {
                    if (!err) {
                        sys.log("addRiderNumToDriver: Rider num " + riderNum + " successfully added to driver " + driverNum);
                    } else {
                        sys.log("addRiderNumToDriver: Error adding rider num " + riderNum + " to driver " + driverNum + ", error: " + err);
                        // TODO: Try the query again? Can be taken care of as "error handling" work in spring quarter
                    }
                });
            } else {
                sys.log("addRiderNumToDriver: Error connecting to DB, " + err);
            }
        });
    }
};