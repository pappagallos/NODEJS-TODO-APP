const schedule = require('node-schedule');
const message = require('../utils/message');
const openweathermap = require('../api/weather');

function crontab() {
	// 매초마다 실행되는 예약작업
	schedule.scheduleJob('* * * * * *', async function () {
		console.log(`${new Date()} batch execute.`);
		await message.batchSendMessage();
	});

	// 매일 새벽 2시마다 실행되는 예약작업
	schedule.scheduleJob('0 2 * * * *', async function () {
		console.log('weather');
		await openweathermap.getTodayCurrentWeather();
	});
}

module.exports = crontab;