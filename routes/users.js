const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const jwtObj = require('../config/jwt');
const pool = require('../config/database');
const bcrypt = require('../utils/bcrypt');

// 로그인 API
router.post('/login', async function (req, res) {
	const connection = await pool.getConnection();

	try {
		const user = {
			userId: req.body.userId,
			userPassword: req.body.userPassword,
		};

		const query = 'SELECT user_id, password, name, phone FROM usr_global WHERE user_id = ?';

		await connection.beginTransaction();
		const [data] = await connection.query(query, [user.userId]);
		await connection.commit();

		if (data.length >= 1) {
			// 사용자가 존재할 경우에는 사용자가 입력한 비밀번호가 맞는지 검증
			if (bcrypt.validBcryptHash(user.userPassword, data[0].password)) {
				const token = jwt.sign({ userId: req.body.userId }, jwtObj.secret, {
					expiresIn: '1h',
				});
				res.status(200).send({ result: 'success.', code: '200', user: {userId: data[0].user_id, userName: data[0].name, userPhone: data[0].phone, userToken: token }}).end();
			} else {
				// 사용자는 존재하지만 비밀번호가 틀렸을 경우
				res
					.status(402)
					.send({ result: 'user is not exist.', code: '402' })
					.end();
			}
		} else {
			// 사용자가 존재하지 않을 경우
			res.status(401).send({ result: 'user is not found', code: '401' }).end();
		}
	} catch (error) {
		res
			.status(500)
			.send({ result: 'database connection error.', code: '500', error: error })
			.end();
	} finally {
		await connection.release();
	}
});

// 회원가입 시 아이디 중복 확인 API
router.post('/overlap', async function(req, res) {
	const connection = await pool.getConnection();

	try {
		const user = {
			userId: req.body.userId
		};

		await connection.beginTransaction();
		const query = "SELECT user_id FROM usr_global WHERE user_id = ?";
		const [ data ] = await connection.query(query, [user.userId]);
		await connection.commit();
		
		if(data.length > 0) {
			res.status(403).send({ result: "already exist.", code: '403' }).end();
		} else {
			res.status(200).send({ result: "success.", code: '200' }).end();
		}

	} catch (error) {
		res.status(500).send({ result: 'database connection error.', code: '500', error: error }).end();
	} finally {
		await connection.release();
	}
})

// 회원가입 API
router.post('/', async function (req, res) {
	const connection = await pool.getConnection();
	
	const user = {
		userId: req.body.userId,
		userPassword: bcrypt.encryptBcrpytHash(req.body.userPassword),
		name: req.body.userName,
		phone: req.body.userPhone,
	};

	if(user.userId === "" || user.userPassword === "" || user.name === "" || user.phone === "") {
		res.status(500).send({ result: 'faild', code: '500', reason: 'parameter empty.'}).end();
	}

	try {
		const query =
			'INSERT INTO usr_global(user_id, password, name, phone) VALUES (?, ?, ?, ?)';

		await connection.beginTransaction();
		await connection.query(query, [
			user.userId,
			user.userPassword,
			user.name,
			user.phone,
		]);
		await connection.commit();

		res.status(200).send({ result: 'success.', code: '200' }).end();
	} catch (error) {
		res.status(500).send(error).end();
	} finally {
		await connection.release();
	}
});

module.exports = router;