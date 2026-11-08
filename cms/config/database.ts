import path from 'path';

// SQLite only. DATABASE_FILENAME lets the box keep the file outside the deploy dir (piece P6).
export default ({ env }) => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: path.join(__dirname, '..', '..', env('DATABASE_FILENAME', '.tmp/data.db')),
    },
    useNullAsDefault: true,
  },
});
