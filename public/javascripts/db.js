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
                        sys.log("searchForDriver: successfully queried db, found " + result.rows.length + " eligible drivers");
                        return result.rows[0];
                    } else {
                        sys.log("searchForDriver: Error querying DB to find drivers, " + err);
                    }
                });
            } else {
                sys.log("searchForDriver: Error connecting to DB, " + err);
            }
        });
    },
    isSenderDriver: function (senderNumber) {
        pg.connect(process.env.DATABASE_URL, function(err, client) {
            if (!err) {
                // Look for driver
                var query = client.query("SELECT num FROM drivers WHERE num = '" + senderNumber + "'", function(err, result) {
                    if (!err) {
                        if (result.rows.length == 0) {
                            // Number is not in DB -> not driver
                            return false;
                        } else {
                            // Number is in DB -> driver
                            sys.log("isSenderDriver: true");
                            return true;
                        }
                    } else {
                        sys.log("isSenderDriver: Error querying DB to see if driver exists already, " + err);
                    }
                });
            } else {
                sys.log("isSenderDriver: Error connecting to DB, " + err);
            }
        });
    },
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
    quickAddDriver: function (from) {
        pg.connect(process.env.DATABASE_URL, function(err, client) {
            if (!err) {
                sys.log("quickAddDriver: connected to DB");
                // Create query to add driver
                // TODO: Should probably get current date and use that, but not high priority
                //       since this is just for internal testing anyway
                var queryString = "INSERT INTO drivers (num, working, on_ride, current_zone, has_trailer, rating, last_payment) VALUES ('"
                        + from + "', true, false, 1, true, 100, '2015-02-26')";

                var query = client.query(queryString, function(err, result) {
                    if (!err) {
                        sys.log("quickAddDriver: Driver added to DB successfully");
                        return true;
                    } else {
                        sys.log("quickAddDriver: Error adding driver to DB, " + err);
                        return false;
                    }
                });
            } else {
                sys.log("quickAddDriver: Error connecting to DB, " + err);
                return false;
            }
        });
    },
    quickRemoveDriver: function (from) {
        pg.connect(process.env.DATABASE_URL, function(err, client) {
            if (!err) {
                var queryString = "DELETE FROM drivers WHERE num = '" + from + "'";
                var query = client.query(queryString, function(err, result) {
                    if (!err) {
                        sys.log("quickRemoveDriver: Driver removed from DB successfully");
                        return true;
                    } else {
                        sys.log("quickRemoveDriver: Error removing driver from DB, " + err);
                        return false;
                    }
                });
            } else {
                sys.log("quickRemoveDriver: Error connecting to DB, " + err);
                return false;
            }
        });
    }
};