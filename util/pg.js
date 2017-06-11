const pg = require('pg');

module.exports = {
  query: (sql) => {
    return new Promise((resolve, reject) => {
      pg.connect(process.env.DATABASE_URL, (err, client) => {
        if (err != null) {
          return reject(err);
        }

        client.query(sql, (queryErr, res) => {
          client.end();

          return (queryErr != null)
            ? reject(queryErr)
            : resolve(res);
        });
      });
    });
  }
}
