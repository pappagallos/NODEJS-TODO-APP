const bcrypt = require('bcrypt-nodejs');

function encryptBcrpytHash(plainTextPassword) {
	const salt = bcrypt.genSaltSync(10);
	const hash = bcrypt.hashSync(plainTextPassword, salt);
	return hash;
}

function validBcryptHash(plainTextPassword, hashedPassword) {
	const isVaild = bcrypt.compareSync(plainTextPassword, hashedPassword);
	return isVaild;
}

module.exports = {
	encryptBcrpytHash,
	validBcryptHash,
};
