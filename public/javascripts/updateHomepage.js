var pg = require('pg');
var $  = require('jquery');

pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (!err) {
        var query = client.query("SELECT num FROM drivers", function(err, result) {
            if (!err) {
                var html = "";
                for (var i = 0; i < result.rows.length; i++) {
                    html += "tr\n\ttd\n\t" + result.rows[i] + "\n";
                }

                $('#activity-table').html(html);
            } else {
                // Error
            }
        });
    } else {
        // Error
    }
});

