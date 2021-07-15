const pool = require('../config/database');
const solapi = require('./solapi');
const solapiConfig = require('../config/solapi');

// 주기적으로 배치가 돌면서 메세지를 발송하기 위해서 배치 모듈에서 호출하는 함수
async function batchSendMessage() {
	const connection = await pool.getConnection();

	try {
		const query = 'SELECT * FROM msg_queue WHERE status = 0';
		const sendCompleteQuery =
			'UPDATE msg_queue SET status = 1 WHERE msg_id = ?';

		await connection.beginTransaction();
		const [rows] = await connection.query(query);

		const currentTime = new Date().getTime();

		for (var i = 0; i < rows.length; i++) {
			const compareTime = new Date(rows[i].send_time).getTime();
			if (currentTime >= compareTime) {
				const messageData = {
					text: `${rows[i].msg_subject} ${rows[i].msg_contents}`,
					receiver: rows[i].receiver,
					sender: rows[i].sender,
					type: rows[i].msg_type,
				};

				// 문자 발송
				await solapi.sendSimpleMessage(messageData);
				
				// 문자 발송하면 다시 발송되지 않도록 발송 완료 처리
				await connection.beginTransaction();
				await connection.query(sendCompleteQuery, [rows[i].msg_id]);
				await connection.commit();
			}
		}

		return true;
	} catch (error) {
		await connection.rollback();
		console.log(error);
		return false;
	} finally {
		await connection.release();
	}
}

// 문자를 발송하기 위해서 메세지 큐에 넣어주는 함수
async function pushMessageQueue(parmasMessageData) {
	try {
		const connection = await pool.getConnection();
		const query = 'INSERT INTO msg_queue(msg_subject, msg_contents, receiver, send_time, msg_type) VALUES (?, ?, ?, ?, ?)';
		
		await connection.beginTransaction();
		await connection.query(query, [
			parmasMessageData.subject,
			parmasMessageData.contents,
			parmasMessageData.receiver,
			parmasMessageData.sendTime,
			parmasMessageData.type,
		]);
		await connection.commit();

		return true;
	} catch (error) {
		await connection.rollback();
		return false;
	} finally {
		await connection.release();
	}
}

// 문자를 큐에 담지 않고 즉시 보내는 함수
async function sendMessage(parmasMessageData) {
	try {
		const connection = await pool.getConnection();
		const query = 'INSERT INTO msg_queue(msg_subject, msg_contents, receiver, send_time, msg_type, status) VALUES (?, ?, ?, ?, ?, 1)';

		await connection.beginTransaction();
		await connection.query(query, [
			parmasMessageData.subject,
			parmasMessageData.contents,
			parmasMessageData.receiver,
			parmasMessageData.sendTime,
			parmasMessageData.type,
		]);
		await connection.commit();

		const messageData = {
			text: `${parmasMessageData.subject} ${parmasMessageData.contents}`,
			receiver: parmasMessageData.receiver,
			sender: solapiConfig.senderNumber,
			type: parmasMessageData.type,
		};

		// 문자 발송
		await solapi.sendSimpleMessage(messageData);

		return true;
	} catch (error) {
		await connection.rollback();
		return false;
	} finally {
		await connection.release();
	}
}

module.exports = {
	pushMessageQueue,
	batchSendMessage,
	sendMessage,
};
