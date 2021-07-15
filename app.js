// 라이브러리
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

// 라우터
const usersRouter = require('./routes/users');
const todoRouter = require('./routes/todo');

// 예약작업
const crontab = require('./jobs/crontab');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use('/users', usersRouter);
app.use('/todo', todoRouter);

crontab();

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	//console.error(createError(404));
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
