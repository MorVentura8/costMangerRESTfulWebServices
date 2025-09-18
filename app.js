const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');            // morgan (קיים אצלך - משאירים)
const mongoose = require('mongoose');

// --- Pino + Logs model ---
const pino = require('pino');
const pinoHttp = require('pino-http');
const Log = require('./models/logs');
const { randomUUID } = require('node:crypto');

// לוגר של Pino (pretty בפיתוח). חשוב: משתמשים בשם pinoLogger כדי לא להתנגש עם morgan's logger
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production'
      ? { transport: { target: 'pino-pretty' } }
      : {})
});

const User = require('./models/users');      // שים לב למסלול הנכון אצלך
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const apiRouter = require('./routes/api');

const app = express();

// connect to mongodb
const MONGO_URI = 'mongodb+srv://morventura88_db_user:0508787029@cluster0.bzcih5f.mongodb.net/costmanager?retryWrites=true&w=majority&appName=Cluster0';
// TIP: עדיף לשמור בעתיד ב-ENV: process.env.MONGO_URI

//const MONGO_URI = process.env.MONGO_URI;
//if (!MONGO_URI) {
//  console.error('❌ Missing MONGO_URI env (set it in your hosting / .env)');
//  process.exit(1);
//}

mongoose
    .connect(MONGO_URI, { dbName: 'costmanager', serverSelectionTimeoutMS: 8000 })
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => {
      console.error('❌ MongoDB connection error:', err.message);
      process.exit(1);
    });

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Middlewares
app.use(logger('dev'));                              // morgan (לא חובה, אבל אפשר להשאיר)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ----- Pino HTTP logging (לוג בקשות) -----
app.use(pinoHttp({
  logger: pinoLogger,                                // חשוב: לא "logger" כדי לא להתנגש עם morgan
  genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
  customLogLevel: (res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req(req) { return { id: req.id, method: req.method, url: req.originalUrl, query: req.query }; },
    res(res) { return { statusCode: res.statusCode }; }
  }
}));

// ----- לוג אפליקטיבי לבסיס הנתונים על כל בקשה -----
app.use((req, res, next) => {
  res.on('finish', () => {
    const userId = Number(req.body?.userid ?? req.query?.id);
    Log.create({
      event: 'HTTP_REQUEST',
      at: new Date(),
      userId: Number.isInteger(userId) ? userId : undefined,
      meta: { method: req.method, url: req.originalUrl, statusCode: res.statusCode, reqId: req.id }
    }).catch(() => {}); // לא לשבור את הזרימה אם כתיבת לוג נכשלה
  });
  next();
});

// Routers
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api', apiRouter);

// --- DB test route ---
app.get('/db/test-user', async (req, res) => {
  try {
    const doc = await User.findOneAndUpdate(
        { id: 1 },
        {
          $setOnInsert: {
            id: 1,
            first_name: 'Mor',
            last_name: 'Ventura',
            birthday: new Date('2000-01-01')
          }
        },
        { upsert: true, new: true, runValidators: true }
    );
    res.json({ ok: true, user: doc });
  } catch (e) {
    console.error('test-user error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/db/health', async (req, res) => {
  const map = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  try {
    const ping = await mongoose.connection.db.admin().ping();
    res.json({
      ok: true,
      state: map[mongoose.connection.readyState],
      host: mongoose.connection.host,
      db: mongoose.connection.name,
      ping
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, state: map[mongoose.connection.readyState] });
  }
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
