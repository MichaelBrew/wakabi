var pg           = require('pg');
var sys          = require('sys');

module.exports = {
    searchForDriver: function (from, location, needTrailer) {
        pg.connect(process.env.DATABASE_URL, function(err, client) {
            if (!err) {
                // Look for driver
                var queryString = "SELECT num FROM drivers WHERE working = 'true' AND on_ride = 'false' AND current_zone = " + location;
                if (needTrailer) {
                    queryString += " AND has_trailer = 'true'";
                }

                var query = client.query(queryString, function(err, result) {
                    if (!err) {
                        return result.rows[0];
                        /*
                        if (result.rows.length == 0) {
                            // No drivers available
                            sys.log("searchForDriver: No drivers available");
                            sendNoDriversText(from);
                        } else {
                            // For now, just grab first driver
                            var driver = result.rows[0];

                            var driverNumber;
                            if (driver.num != null) {
                                sys.log("searchForDriver: Found driver " + driver.num);
                                driverNumber = driver.num;
                            } else {
                                sys.log("searchForDriver: driver.num is NULL");
                            }

                            textDriverForConfirmation(driverNumber)
                        }
                        */
                    } else {
                        sys.log("searchForDriver: Error querying DB to find drivers, " + err);
                    }
                });
            } else {
                sys.log("searchForDriver: Error connecting to DB, " + err);
            }
        });
    }
};