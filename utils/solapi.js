const { config, Group } = require('solapi');
const solapiConfig = require('../config/solapi');

async function sendSimpleMessage(messageData) {
	try {
		const apiKey = solapiConfig.apiKey;
		const apiSecret = solapiConfig.apiSecret;
		config.init({ apiKey, apiSecret });

		async function send(params = {}) {
			try {
				const response = await Group.sendSimpleMessage(params);
				console.log(response);
			} catch (e) {
				console.log(e);
			}
		}

		const params = {
			text: messageData.text, // 문자 내용
			type: messageData.type, // 발송할 메시지 타입 (SMS, LMS, MMS, ATA, CTA)
			to: messageData.receiver, // 수신번호 (받는이)
			from: messageData.sender, // 발신번호 (보내는이)
		};

		console.log(params);

		send(params);

		return true;
	} catch (error) {
		return false;
	}
}

module.exports = {
	sendSimpleMessage,
};
