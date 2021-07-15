const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const jwtObj = require('../config/jwt');
const message = require('../utils/message');

// 사용자의 TODO LIST를 가져오는 함수
router.get('/:todoDate', async function (req, res) {
	const connection = await pool.getConnection();

	try {
		const decoded = jwt.verify(req.headers.authorization, jwtObj.secret);
		// 토큰이 정상적으로 발행되었을 경우
		if (decoded) {
			const query =
				"SELECT * FROM usr_todo_list WHERE user_id = ? AND todo_status != 4 AND todo_time like ? ORDER BY todo_time";
			await connection.beginTransaction();

			// 검색된 월, 일자가 10월 혹은 10일 이하일 경우 앞에 0이 붙도록 예외처리
			let targetDate = req.params.todoDate.split("-");
			const targetMonth = Number(targetDate[1]);
			const targetDay = Number(targetDate[2]);

			if (targetMonth < 10) targetDate[1] = `0${targetDate[1]}`;
			if (targetDay < 10) targetDate[2] = `0${targetDate[2]}`;

			targetDate = targetDate.join("-");

			const [data] = await connection.query(query, [decoded.userId, `${targetDate}%`]);
			await connection.commit();

			res
				.status(200)
				.send({ result: 'success', code: '200', data: data })
				.end();
		} else {
			// 토큰이 정상적으로 발행되지 않았을 경우
			res
				.status(401)
				.send({ result: 'token is not valid.', code: '401' })
				.end();
		}
	} catch (error) {
		res.status(500).send({ result: 'get faild todo list.', code: '500', error: error });
	} finally {
		await connection.release();
	}
});

// 사용자의 TODO LIST를 추가하는 함수
router.post('/', async function (req, res) {
	const connection = await pool.getConnection();

	try {
		const decoded = jwt.verify(req.headers.authorization, jwtObj.secret);
		// 토큰이 정상적으로 발행되었을 경우
		if (decoded) {
			const todo = {
				header: '[TODO]', // 문자로 발송될 헤드라인
				userId: decoded.userId, // JWT 토큰에 발행된 사용자의 아이디
				todoTitle: req.body.todoTitle, // 문자로 발송될 문자 제목
				todoContents: req.body.todoContents, // 문자로 발송될 문자 제목 뒤의 내용
				todoTime: req.body.todoTime, // 사용자가 작성한 TODO LIST가 진행되는 시간
				sendSchedule: req.body.sendSchedule, // 사용자가 설정한 알림 설정
				type: 'SMS', // 메세지 종류
			};

			/*
			 * 해당 부분은 사용자가 TODO LIST를 등록하면서 일정 알림을 설정해놓은대로 MSG_QUEUE 테이블에 INSERT 시켜서 문자를 발송해주는 부분이다.
			 * 데이터는 아래와 같은 순서대로 나열되며 즉시, 10분, 20분, 30분전, 60분전에 알림을 설정할 수 있도록 되어있다.
			 * 즉시|10분전|20분전|30분전|60분전
			 */
			const sendSchedule = todo.sendSchedule.split('|');
			const todoTime = new Date(req.body.todoTime).getTime(); // TODO LIST가 실행될 시간을 TIMESTAMP로 환산
			const timestampSchedule = {
				now: new Date(), // TODO LIST를 등록한 시간
				m10: new Date(todoTime - 600000), // 10분전
				m20: new Date(todoTime - 1200000), // 20분전
				m30: new Date(todoTime - 1800000), // 30분전
				h1: new Date(todoTime - 3600000), // 1시간전
			};

			const phone = 'SELECT phone FROM usr_global WHERE user_id = ?';
			const query =
				'INSERT INTO usr_todo_list(user_id, todo_title, todo_contents, todo_time, send_schedule) VALUES (?, ?, ?, ?, ?)';

			await connection.beginTransaction();
			const [userPhone] = await connection.query(phone, todo.userId);

			await connection.query(query, [
				todo.userId,
				todo.todoTitle,
				todo.todoContents,
				todo.todoTime,
				todo.sendSchedule,
			]);

			for (var i = 0; i < sendSchedule.length; i++) {
				// i가 0이면 즉시, 1이면 10분전, 2면 20분전, 3이면 30분전, 4면 1시간전
				if (sendSchedule[i] === '1') {
					switch (i) {
						case 0: // 즉시
							await message.sendMessage({
								subject: todo.header,
								contents: `${todo.todoTitle} 일정이 추가되었습니다.`,
								receiver: userPhone[0].phone,
								sendTime: timestampSchedule.now,
								type: todo.type,
							});

							break;
						case 1: // 10분전
							if (timestampSchedule.m10 < timestampSchedule.now) continue; // 10분전이 TODO LIST를 등록하는 시간보다 이전 시간일 경우 이미 지나간 시간이므로 문자를 보내지 않도록 처리

							await message.pushMessageQueue({
								subject: todo.header,
								contents: `10분 후, ${todo.todoTitle} 일정이 있습니다.`,
								receiver: userPhone[0].phone,
								sendTime: timestampSchedule.m10,
								type: todo.type,
							});

							break;
						case 2: // 20분전
							if (timestampSchedule.m20 < timestampSchedule.now) continue;

							await message.pushMessageQueue({
								subject: todo.header,
								contents: `20분 후, ${todo.todoTitle} 일정이 있습니다.`,
								receiver: userPhone[0].phone,
								sendTime: timestampSchedule.m20,
								type: todo.type,
							});

							break;
						case 3: // 30분전
							if (timestampSchedule.m30 < timestampSchedule.now) continue;

							await message.pushMessageQueue({
								subject: todo.header,
								contents: `30분 후, ${todo.todoTitle} 일정이 있습니다.`,
								receiver: userPhone[0].phone,
								sendTime: timestampSchedule.m30,
								type: todo.type,
							});

							break;
						case 4: // 1시간전
							if (timestampSchedule.h1 < timestampSchedule.now) continue;

							await message.pushMessageQueue({
								subject: todo.header,
								contents: `1시간 후, ${todo.todoTitle} 일정이 있습니다.`,
								receiver: userPhone[0].phone,
								sendTime: timestampSchedule.h1,
								type: todo.type,
							});

							break;
					}
				}
			}

			await connection.commit();

			res.status(200).send({ result: 'success.', code: '200' }).end();
		} else {
			// 토큰이 정상적으로 발행되지 않았을 경우
			res
				.status(401)
				.send({ result: 'token is not valid.', code: '401' })
				.end();
		}
	} catch (error) {
		res.send({ result: 'add faild todo list.', code: '500', error: error });
	} finally {
		await connection.release();
	}
});

// 사용자의 TODO LIST를 삭제해주는 함수, DB에서 삭제하는 것이 아닌 todo_status 값을 4로 변경함으로서 삭제 표시만 하는 함수
router.delete('/:todoId', async function (req, res) {
	const connection = await pool.getConnection();

	try {
		const todoId = req.params.todoId;
		const decoded = jwt.verify(req.headers.authorization, jwtObj.secret);

		if (decoded) {
			const query =
				'UPDATE usr_todo_list SET todo_status = 4 WHERE todo_id = ? AND user_id = ?';

			await connection.beginTransaction();
			await connection.query(query, [todoId, decoded.userId]);
			await connection.commit();

			res.status(200).send({ result: 'success.', code: '200' }).end();
		} else {
			
			// 토큰이 정상적으로 발행되지 않았을 경우
			res
				.status(401)
				.send({ result: 'token is not valid.', code: '401' })
				.end();
		}
	} catch (error) {
		res.send({ result: 'delete faild todo list.', code: '500', error: error });
	} finally {
		await connection.release();
	}
});

router.put('/:todoId', async function (req, res) {
	const connection = await pool.getConnection();

	try {
		const todoId = req.params.todoId;
		const data = {
			todoTitle: req.body.todoTitle,
			todoContents: req.body.todoContents,
			todoTime: req.body.todoTime,
			sendSchedule: req.body.sendSchedule
		}
		const decoded = jwt.verify(req.headers.authorization, jwtObj.secret);

		if(decoded) {
			const query = "UPDATE usr_todo_list SET todo_title = ?, todo_contents = ?, todo_time = ?, send_flag = 0, send_schedule = ? WHERE todo_id = ? and user_id = ?";
			await connection.beginTransaction();
			await connection.query(query, [data.todoTitle, data.todoContents, data.todoTime, data.sendSchedule, todoId, decoded.userId ]);
			await connection.commit();

			res.status(200).send({ result: 'success', code: '200'}).end();
		} else {
			res.status(401).send({ result: 'token is not valid.', code: '401'}).end();
		}
	} catch (error) {
		res.status(500).send({ result: 'update faild todo list.', code: '500', error: error }).end();
	} finally {
		await connection.release();
	}
});

// 사용자의 TODO LIST를 완료 또는 미완료 시켜주는 함수
router.post('/:todoId/:todoStatus', async function (req, res) {
	const connection = await pool.getConnection();

	try {
		const todoId = req.params.todoId;
		const todoStatus = req.params.todoStatus;
		const decoded = jwt.verify(req.headers.authorization, jwtObj.secret);

		if (decoded) {
			const query =
				'UPDATE usr_todo_list SET todo_status = ? WHERE todo_id = ? AND user_id = ?';

			await connection.beginTransaction();
			await connection.query(query, [todoStatus, todoId, decoded.userId]);
			await connection.commit();

			res.status(200).send({ result: 'success.', code: '200' }).end();
		} else {
			// 토큰이 정상적으로 발행되지 않았을 경우
			res
				.status(401)
				.send({ result: 'token is not valid.', code: '401' })
				.end();
		}
	} catch (error) {
		res.status(500).send({ result: 'update faild todo list.', code: '500', error: error }).end();
	} finally {
		await connection.release();
	}
});

module.exports = router;
