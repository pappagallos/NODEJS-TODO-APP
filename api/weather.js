const weatherConfig = require('../config/openweathermap');
const pool = require('../config/database');
const axios = require('axios');
const message = require('../utils/message');

function convertKelvinToTemperature(kelvin) {
	const K = 273.15;
	return Math.floor(kelvin - K);
}

function recommendDresscode(temperature) {
	const dresscode = [
		'민소매, 반팔, 반바지, 치마', // 28도 이상일 경우
		'반팔, 얇은 셔츠, 반바지, 면바지', // 23도에서 27도일 경우
		'얇은 가디건, 긴팔티, 면바지, 청바지', // 20도에서 22도일 경우
		'얇은 니트, 가디건, 맨투맨, 얇은 재킷, 면바지, 청바지', // 17도에서 19도일 경우
		'재킷, 가디건, 야상, 맨투맨, 니트, 스타킹, 청바지, 면바지', // 12도에서 16도일 경우
		'재킷, 트렌치코드, 야상, 니트, 스타킹, 청바지, 면바지', // 9도에서 11도일 경우
		'코트, 히트텍, 니트, 청바지, 레깅스', // 5도에서 8도일 경우
		'패딩, 두꺼운 코드, 목도리, 기모 제품', // 1도에서 4도일 경우
		'모자 달린 두꺼운 패딩, 안에는 스웨터, 귀마개, 부츠 등 방한 제품', // -4도에서 0도일 경우
		'파카, 코트 등 방한 제품', // -5도 이하일 경우
	];

	if (temperature >= 28) {
		return dresscode[0];
	} else if (temperature >= 23 && temperature <= 27) {
		return dresscode[1];
	} else if (temperature >= 20 && temperature <= 22) {
		return dresscode[2];
	} else if (temperature >= 17 && temperature <= 19) {
		return dresscode[3];
	} else if (temperature >= 12 && temperature <= 16) {
		return dresscode[4];
	} else if (temperature >= 9 && temperature <= 11) {
		return dresscode[5];
	} else if (temperature >= 5 && temperature <= 8) {
		return dresscode[6];
	} else if (temperature >= 1 && temperature <= 4) {
		return dresscode[7];
	} else if (temperature >= -4 && temperature <= 0) {
		return dresscode[8];
	} else if (temperature <= -5) {
		return dresscode[9];
	}
}

async function getTodayCurrentWeather() {
	try {
		const baseUrl = `http://api.openweathermap.org/data/2.5/weather?q=${weatherConfig.q}&appid=${weatherConfig.apiKey}&lang=${weatherConfig.lang}`;
		const { data } = await axios.get(baseUrl);

		const connection = await pool.getConnection();

		await connection.beginTransaction();
		const query = 'SELECT name, phone FROM usr_global';
		const [rows] = await connection.query(query);
		await connection.release();

		const date = new Date();
		const sendMessageTime = `${date.getFullYear()}-${
			date.getMonth() + 1
		}-${date.getDate()} 07:00:00`;

		for (var i = 0; i < rows.length; i++) {
			const messageData = {
				subject: '[TODO]\n',
				contents: `${
					rows[i].name
				}님 좋은 아침이에요! TODO의 오늘의 날씨입니다. :)\n\n오늘 최저 온도는 ${convertKelvinToTemperature(
					data.main.temp_min
				)}℃, 최고 온도는 ${convertKelvinToTemperature(
					data.main.temp_max
				)}℃ 입니다.\n현재 서울의 온도는 ${convertKelvinToTemperature(
					data.main.temp
				)}℃, 체감온도 ${convertKelvinToTemperature(data.main.feels_like)}℃로 ${
					data.weather[0].description
				} 날씨입니다.\n\n현재 온도를 기준으로 TODO가 추천하는 드레스코드는 ${recommendDresscode(
					convertKelvinToTemperature(data.main.temp)
				)} 입니다.\n\n오늘도 좋은 하루 되세요~!\n\n* 더 이상 TODO의 아침 인사 문자를 받고싶지 않다면 TODO 앱에서 [사용자정보 -> 정보수신 -> 아침 인사 수신 거부]를 설정해주세요.\n* TODO의 기상 데이터는 실시간으로 openweathermap에서 서울을 기준으로 가져옵니다.`,
				receiver: rows[i].phone,
				sendTime: sendMessageTime,
				type: 'LMS',
			};

			await message.pushMessageQueue(messageData);
		}

		return true;
	} catch (error) {
		return false;
	}
}

module.exports = {
	getTodayCurrentWeather,
};
